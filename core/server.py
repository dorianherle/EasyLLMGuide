"""
Server with dynamic input support.
"""

import asyncio
import inspect
import json
import traceback
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
from examples.node_specs import EXAMPLE_NODES
from examples.example_graphs import EXAMPLES

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_nodes_from_folder(folder_path: str) -> list[NodeSpec]:
    """Load node specs from Python files in a folder."""
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
            spec.loader.exec_module(module)
            
            if hasattr(module, "NODES"):
                nodes.extend(module.NODES)
            else:
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if isinstance(attr, NodeSpec):
                        nodes.append(attr)
    
    return nodes


def build_node_info(specs: list[NodeSpec]) -> tuple[dict, list]:
    """Build node type registry and info list from specs."""
    types = {node.name: node for node in specs}
    info = []
    for name, spec in types.items():
        visible_inputs = {k: {"type": v.type.__name__} for k, v in spec.inputs.items() if v.init is None}
        code = inspect.getsource(spec.func)
        info.append({
            "name": name,
            "category": spec.category,
            "inputs": visible_inputs,
            "outputs": {k: {"type": v.type.__name__} for k, v in spec.outputs.items()},
            "code": code,
        })
    return types, info


# Node type registry & info cache
node_types, NODE_INFO = build_node_info(EXAMPLE_NODES)

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


@app.get("/nodes")
async def get_nodes():
    global node_types, NODE_INFO
    all_nodes = EXAMPLE_NODES + custom_nodes
    node_types, NODE_INFO = build_node_info(all_nodes)
    return NODE_INFO


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
    
    all_nodes = EXAMPLE_NODES + custom_nodes
    node_types, NODE_INFO = build_node_info(all_nodes)
    
    return {"status": "ok", "loaded": len(custom_nodes)}


@app.post("/clear-custom-nodes")
async def clear_custom_nodes_endpoint():
    global custom_nodes, custom_temp_dir, node_types, NODE_INFO
    
    custom_nodes = []
    
    if custom_temp_dir and Path(custom_temp_dir).exists():
        shutil.rmtree(custom_temp_dir)
        custom_temp_dir = None
    
    node_types, NODE_INFO = build_node_info(EXAMPLE_NODES)
    
    return {"status": "ok"}


@app.post("/graph")
async def save_graph(graph_def: dict):
    global current_graph
    
    instances = graph_def.get("instances", [])
    edges = graph_def.get("edges", [])
    
    instance_specs = []
    
    for inst in instances:
        if inst["type"] == "subgraph":
            continue
            
        if inst["type"] not in node_types:
            return {"status": "error", "errors": [f"Unknown node type: {inst['type']}"]}
        
        base_spec = node_types[inst["type"]]
        instance_spec = NodeSpec(
            name=inst["id"],
            node_type=inst["type"],
            category=base_spec.category,
            inputs=base_spec.inputs,
            outputs=base_spec.outputs,
            func=base_spec.func
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
    msg = json.dumps({
        "type": event_type,
        "data": {k: str(v) for k, v in data.items()}
    })
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
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        websocket_clients.remove(websocket)


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
    uvicorn.run(app, host="0.0.0.0", port=8000)
