"""
Server with dynamic input support.
"""

import asyncio
import inspect
import json
import traceback
import importlib
import importlib.util
import sys
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import shutil

from core.spec_models import NodeSpec, InputDef, OutputDef, EdgeSpec
from core.graph_topology import build_graph
from core.executor import Executor
from core.exporter import export_graph
from core.node import get_all_nodes, clear_registry
from core import storage
from examples.example_graphs import EXAMPLES

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_builtin_nodes() -> list[NodeSpec]:
    """Load all builtin node modules from nodes/ folder."""
    clear_registry()
    
    nodes_dir = Path("nodes")
    if not nodes_dir.exists():
        return []
    
    # Import each .py file in nodes/ folder (not subfolders)
    for py_file in nodes_dir.glob("*.py"):
        if py_file.name.startswith("_"):
            continue
        
        module_name = f"nodes.{py_file.stem}"
        
        # Remove from cache to allow reload
        if module_name in sys.modules:
            del sys.modules[module_name]
        
        try:
            importlib.import_module(module_name)
        except Exception as e:
            print(f"Failed to load {module_name}: {e}")
    
    return get_all_nodes()


def load_nodes_from_folder(folder_path: str) -> list[NodeSpec]:
    """Load node specs from Python files in a folder (for uploaded nodes)."""
    from core.node import _registry
    
    nodes = []
    folder = Path(folder_path)
    if not folder.exists():
        return nodes
    
    for py_file in folder.glob("*.py"):
        if py_file.name.startswith("_"):
            continue
        
        module_name = f"dynamic_nodes_{py_file.stem}"
        spec = importlib.util.spec_from_file_location(module_name, py_file)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            
            # Track registry size before import
            before = len(_registry)
            spec.loader.exec_module(module)
            after = len(_registry)
            
            # Get newly added nodes
            if after > before:
                nodes.extend(_registry[before:])
    
    return nodes


def build_node_info(specs: list[NodeSpec]) -> tuple[dict, list]:
    """Build node type registry and info list from specs."""
    types = {node.name: node for node in specs}
    info = []
    for name, spec in types.items():
        visible_inputs = {}
        for k, v in spec.inputs.items():
            if v.init is None:
                inp_info = {"type": v.type.__name__}
                if v.default is not None:
                    inp_info["default"] = v.default
                visible_inputs[k] = inp_info
        
        code = inspect.getsource(spec.func)
        node_info = {
            "name": name,
            "category": spec.category,
            "inputs": visible_inputs,
            "outputs": {k: {"type": v.type.__name__} for k, v in spec.outputs.items()},
            "code": code,
        }
        # Add interface info if present
        if spec.interface_type:
            node_info["interface_type"] = spec.interface_type
            node_info["participants"] = [
                {"id": p.id, "name": p.name, "can_send": p.can_send, "can_receive": p.can_receive}
                for p in spec.participants
            ]
        info.append(node_info)
    return types, info


# Node type registry & info cache
node_types: dict = {}
NODE_INFO: list = []


@app.on_event("startup")
async def startup_event():
    """Initialize nodes on server startup."""
    global node_types, NODE_INFO
    nodes = load_builtin_nodes()
    node_types, NODE_INFO = build_node_info(nodes)
    print(f"Loaded {len(NODE_INFO)} nodes")

# Custom uploaded nodes
custom_nodes: list[NodeSpec] = []
custom_temp_dir: Optional[str] = None

# Current graph state
current_graph = None

# Websocket clients
websocket_clients: list[WebSocket] = []


@dataclass
class NodeInstance:
    id: str
    type: str


@dataclass
class GraphDefinition:
    instances: list[dict]
    edges: list[dict]


@app.get("/applications")
async def get_applications():
    """List available applications (for backwards compatibility)."""
    # With the new system, there's just one unified set of nodes
    # Return a single "default" application
    return []


@app.post("/set-application")
async def set_application(data: dict):
    """Set application (no-op for backwards compatibility)."""
    return {"status": "ok", "application": data.get("application")}


@app.get("/nodes")
async def get_nodes(application: Optional[str] = None):
    """Get all available nodes."""
    return NODE_INFO


@app.post("/reload-nodes")
async def reload_nodes():
    """Reload all builtin nodes."""
    global node_types, NODE_INFO
    nodes = load_builtin_nodes()
    
    # Add custom nodes if any
    all_nodes = nodes + custom_nodes
    node_types, NODE_INFO = build_node_info(all_nodes)
    
    return {"status": "ok", "count": len(NODE_INFO)}


@app.post("/upload-nodes")
async def upload_nodes(files: list[UploadFile] = File(...)):
    global custom_nodes, custom_temp_dir, node_types, NODE_INFO
    
    if custom_temp_dir and Path(custom_temp_dir).exists():
        shutil.rmtree(custom_temp_dir)
    
    custom_temp_dir = tempfile.mkdtemp(prefix="nodes_")
    
    for file in files:
        if file.filename and file.filename.endswith('.py'):
            filename = Path(file.filename).name
            if filename.startswith('_'):
                continue
            file_path = Path(custom_temp_dir) / filename
            content = await file.read()
            file_path.write_bytes(content)
    
    custom_nodes = load_nodes_from_folder(custom_temp_dir)
    
    builtin_nodes = load_builtin_nodes()
    all_nodes = builtin_nodes + custom_nodes
    node_types, NODE_INFO = build_node_info(all_nodes)
    
    return {"status": "ok", "loaded": len(custom_nodes)}


@app.post("/clear-custom-nodes")
async def clear_custom_nodes_endpoint():
    global custom_nodes, custom_temp_dir, node_types, NODE_INFO
    
    custom_nodes = []
    
    if custom_temp_dir and Path(custom_temp_dir).exists():
        shutil.rmtree(custom_temp_dir)
        custom_temp_dir = None
    
    builtin_nodes = load_builtin_nodes()
    node_types, NODE_INFO = build_node_info(builtin_nodes)
    
    return {"status": "ok"}


@app.get("/graph")
async def get_graph():
    """Get current graph state."""
    return {
        "nodes": [],
        "edges": [],
        "subgraphs": [],
        "globalVariables": {}
    }

@app.post("/graph")
async def save_graph(graph_def: dict):
    global current_graph

    instances = graph_def.get("instances", [])
    edges = graph_def.get("edges", [])
    global_vars = graph_def.get("globalVariables", {})
    
    instance_specs = []
    
    for inst in instances:
        if inst["type"] == "subgraph":
            continue
            
        if inst["type"] not in node_types:
            return {"status": "error", "errors": [f"Unknown node type: {inst['type']}"]}
        
        base_spec = node_types[inst["type"]]
        
        # Handle instance-specific overrides
        inputs = base_spec.inputs.copy()
        defaults = inst.get("defaults", {})
        global_bindings = inst.get("globalBindings", {})
        
        # Resolve global bindings first (they take precedence)
        for input_name, var_name in global_bindings.items():
            if var_name in global_vars:
                defaults[input_name] = global_vars[var_name]
        
        # Create new InputDefs for overridden defaults
        if defaults:
            new_inputs = {}
            for name, input_def in inputs.items():
                if name in defaults:
                    # Create copy with new default
                    new_inputs[name] = InputDef(
                        type=input_def.type,
                        init=input_def.init,
                        default=defaults[name]
                    )
                else:
                    new_inputs[name] = input_def
            inputs = new_inputs

        instance_spec = NodeSpec(
            name=inst["id"],
            node_type=base_spec.node_type,
            category=base_spec.category,
            inputs=inputs,
            outputs=base_spec.outputs,
            func=base_spec.func,
            interface_type=base_spec.interface_type,
            participants=base_spec.participants
        )
        instance_specs.append(instance_spec)
    
    valid_node_ids = {s.name for s in instance_specs}
    
    edge_specs = [
        EdgeSpec(
            source_node=e["source"],
            source_branch=e["sourceHandle"],
            target_node=e["target"],
            target_input=e["targetHandle"]
        ) for e in edges
        if e["source"] in valid_node_ids and e["target"] in valid_node_ids
    ]
    
    current_graph = build_graph(instance_specs, edge_specs)
    
    return {"status": "ok", "errors": []}


async def notify_clients(event_type: str, data: dict):
    processed = {}
    for k, v in data.items():
        if isinstance(v, (list, dict)):
            processed[k] = v
        else:
            processed[k] = str(v)
    
    msg = json.dumps({"type": event_type, "data": processed})
    for ws in list(websocket_clients):
        try:
            await ws.send_text(msg)
        except:
            pass


input_queue: asyncio.Queue = None


async def input_handler():
    """Wait for any trigger input from websocket."""
    global input_queue
    if input_queue is None:
        input_queue = asyncio.Queue()
    return await input_queue.get()


@app.post("/run")
async def run_graph():
    """Start graph execution - returns immediately, progress via websocket."""
    global current_graph, input_queue
    
    if current_graph is None:
        return {"error": "No graph defined"}
    
    input_queue = asyncio.Queue()
    
    async def run_task():
        await asyncio.sleep(0.1)
        executor = Executor(current_graph, observers=[notify_clients], input_handler=input_handler)
        try:
            await executor.run()
            await notify_clients("run_complete", {})
        except Exception as e:
            traceback.print_exc()
            await notify_clients("run_error", {"error": str(e)})

    asyncio.create_task(run_task())
    
    return {"status": "started"}


@app.post("/export")
async def export_to_python(graph_def: dict):
    """Export graph to standalone Python code."""
    
    node_type_info = {}
    for name, spec in node_types.items():
        node_type_info[name] = {
            "inputs": {k: {"type": v.type.__name__} for k, v in spec.inputs.items()},
            "outputs": {k: {"type": v.type.__name__} for k, v in spec.outputs.items()},
        }
    
    instances = graph_def.get("instances", [])
    edges = graph_def.get("edges", [])
    
    code = export_graph(instances, edges, node_type_info)
    
    return {"code": code}


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    websocket_clients.append(websocket)

    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
                if msg.get("type") == "input_response":
                    node_id = msg.get("node_id")
                    value = msg.get("value")
                    try:
                        value = int(value)
                    except (ValueError, TypeError):
                        pass
                    if input_queue:
                        await input_queue.put((node_id, value))
                elif msg.get("type") == "chat_message":
                    # Handle chat UI sending messages to chat nodes
                    chat_id = msg.get("chat_id")
                    message = msg.get("message")
                    if chat_id and message and input_queue:
                        # Send to all chat nodes with this chat_id
                        await input_queue.put((f"chat_{chat_id}", message))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        websocket_clients.remove(websocket)


@app.post("/update-node-code")
async def update_node_code(data: dict):
    """Update node code - rewrites the function in its source file."""
    global node_types, NODE_INFO
    
    node_name = data.get("node_name")
    new_code = data.get("code")
    
    if node_name not in node_types:
        return {"status": "error", "message": f"Node {node_name} not found"}
    
    spec = node_types[node_name]
    try:
        source_file = inspect.getfile(spec.func)
    except:
        return {"status": "error", "message": "Cannot find source file"}
    
    with open(source_file, 'r') as f:
        content = f.read()
    
    old_code = inspect.getsource(spec.func)
    new_content = content.replace(old_code, new_code)
    
    with open(source_file, 'w') as f:
        f.write(new_content)
    
    return {"status": "ok", "message": "Code updated, server will reload automatically"}


@app.get("/examples")
async def get_examples():
    return {key: {"name": val["name"]} for key, val in EXAMPLES.items()}


@app.get("/examples/{key}")
async def get_example(key: str):
    if key not in EXAMPLES:
        return {"error": "Example not found"}
    return EXAMPLES[key]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("core.server:app", host="0.0.0.0", port=8000, reload=True)
