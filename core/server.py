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
from typing import Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile
import shutil

from core.spec_models import NodeSpec, InputDef, OutputDef, EdgeSpec
from core.graph_topology import build_graph, validate_graph
from core.executor import Executor
from core.exporter import export_graph
from examples.node_specs import EXAMPLE_NODES

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
            
            # Look for NODES list or any NodeSpec objects
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

# Default node type registry & info cache
node_types, NODE_INFO = build_node_info(EXAMPLE_NODES)

# Custom uploaded nodes
custom_nodes: list[NodeSpec] = []
custom_temp_dir: Optional[str] = None

# Current graph state
current_graph = None

# Websocket clients
websocket_clients: list[WebSocket] = []


class NodeInstance(BaseModel):
    id: str
    type: str


class GraphDefinition(BaseModel):
    instances: list[NodeInstance]
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
    
    # Clean up old temp dir
    if custom_temp_dir and Path(custom_temp_dir).exists():
        shutil.rmtree(custom_temp_dir)
    
    # Create new temp dir
    custom_temp_dir = tempfile.mkdtemp(prefix="nodes_")
    
    # Save uploaded files
    for file in files:
        if file.filename and file.filename.endswith('.py'):
            # Get just the filename, not the path
            filename = Path(file.filename).name
            if filename.startswith('_'):
                continue
            file_path = Path(custom_temp_dir) / filename
            content = await file.read()
            file_path.write_bytes(content)
    
    # Load nodes from temp dir
    custom_nodes = load_nodes_from_folder(custom_temp_dir)
    
    # Rebuild node info
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
async def save_graph(graph_def: GraphDefinition):
    global current_graph
    
    instance_specs = []
    
    for inst in graph_def.instances:
        if inst.type not in node_types:
            return {"status": "error", "errors": [f"Unknown node type: {inst.type}"]}
        
        base_spec = node_types[inst.type]
        instance_spec = NodeSpec(
            name=inst.id,
            node_type=inst.type,
            category=base_spec.category,
            inputs=base_spec.inputs,
            outputs=base_spec.outputs,
            func=base_spec.func
        )
        instance_specs.append(instance_spec)
    
    edges = [
        EdgeSpec(
            source_node=e["source"],
            source_branch=e["sourceHandle"],
            target_node=e["target"],
            target_input=e["targetHandle"]
        ) for e in graph_def.edges
    ]
    
    current_graph = build_graph(instance_specs, edges)
    
    errors = validate_graph(current_graph, {})
    
    return {
        "status": "ok" if not errors else "error",
        "errors": errors,
    }


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
    """Wait for any trigger input from websocket, return (node_id, value)."""
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
    
    # Fresh queue for this run
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
async def export_to_python(graph_def: GraphDefinition):
    """Export graph to standalone Python code."""
    
    # Build node_types dict for the exporter
    node_type_info = {}
    for name, spec in node_types.items():
        node_type_info[name] = {
            "inputs": {k: {"type": v.type.__name__} for k, v in spec.inputs.items()},
            "outputs": {k: {"type": v.type.__name__} for k, v in spec.outputs.items()},
        }
    
    instances = [{"id": i.id, "type": i.type} for i in graph_def.instances]
    
    code = export_graph(instances, graph_def.edges, node_type_info)
    
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
                    # Put into queue for executor to pick up
                    if input_queue:
                        await input_queue.put((node_id, value))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        websocket_clients.remove(websocket)


EXAMPLES = {
    "even_odd": {
        "name": "Even/Odd Flow",
        "nodes": [
            {"id": "in-1", "type": "custom", "position": {"x": 50, "y": 150}, "data": {"label": "terminal_input", "inputs": {"value": {"type": "int"}}, "outputs": {"out": {"type": "int"}}}},
            {"id": "check-1", "type": "custom", "position": {"x": 260, "y": 150}, "data": {"label": "is_even", "inputs": {"value": {"type": "int"}}, "outputs": {"yes": {"type": "int"}, "no": {"type": "int"}}}},
            {"id": "double-1", "type": "custom", "position": {"x": 480, "y": 50}, "data": {"label": "double", "inputs": {"value": {"type": "int"}}, "outputs": {"result": {"type": "int"}}}},
            {"id": "triple-1", "type": "custom", "position": {"x": 480, "y": 250}, "data": {"label": "triple", "inputs": {"value": {"type": "int"}}, "outputs": {"result": {"type": "int"}}}},
            {"id": "out-1", "type": "custom", "position": {"x": 700, "y": 150}, "data": {"label": "terminal_output", "inputs": {"value": {"type": "Any"}}, "outputs": {"done": {"type": "str"}}}}
        ],
        "edges": [
            {"id": "e1", "source": "in-1", "target": "check-1", "sourceHandle": "out", "targetHandle": "value"},
            {"id": "e2", "source": "check-1", "target": "double-1", "sourceHandle": "yes", "targetHandle": "value"},
            {"id": "e3", "source": "check-1", "target": "triple-1", "sourceHandle": "no", "targetHandle": "value"},
            {"id": "e4", "source": "double-1", "target": "out-1", "sourceHandle": "result", "targetHandle": "value"},
            {"id": "e5", "source": "triple-1", "target": "out-1", "sourceHandle": "result", "targetHandle": "value"}
        ]
    },
    "math_chain": {
        "name": "Math Chain + Logger",
        "nodes": [
            {"id": "in-1", "type": "custom", "position": {"x": 50, "y": 100}, "data": {"label": "terminal_input", "inputs": {"value": {"type": "int"}}, "outputs": {"out": {"type": "int"}}}},
            {"id": "sq-1", "type": "custom", "position": {"x": 250, "y": 100}, "data": {"label": "square", "inputs": {"value": {"type": "int"}}, "outputs": {"result": {"type": "int"}}}},
            {"id": "dbl-1", "type": "custom", "position": {"x": 450, "y": 100}, "data": {"label": "double", "inputs": {"value": {"type": "int"}}, "outputs": {"result": {"type": "int"}}}},
            {"id": "log-1", "type": "custom", "position": {"x": 450, "y": 220}, "data": {"label": "logger", "inputs": {"msg": {"type": "Any"}}, "outputs": {"logged": {"type": "str"}}}},
            {"id": "out-1", "type": "custom", "position": {"x": 650, "y": 100}, "data": {"label": "terminal_output", "inputs": {"value": {"type": "Any"}}, "outputs": {"done": {"type": "str"}}}}
        ],
        "edges": [
            {"id": "e1", "source": "in-1", "target": "sq-1", "sourceHandle": "out", "targetHandle": "value"},
            {"id": "e2", "source": "sq-1", "target": "dbl-1", "sourceHandle": "result", "targetHandle": "value"},
            {"id": "e3", "source": "sq-1", "target": "log-1", "sourceHandle": "result", "targetHandle": "msg"},
            {"id": "e4", "source": "dbl-1", "target": "out-1", "sourceHandle": "result", "targetHandle": "value"}
        ]
    },
    "branching": {
        "name": "Positive/Negative",
        "nodes": [
            {"id": "in-1", "type": "custom", "position": {"x": 50, "y": 150}, "data": {"label": "terminal_input", "inputs": {"value": {"type": "int"}}, "outputs": {"out": {"type": "int"}}}},
            {"id": "check-1", "type": "custom", "position": {"x": 260, "y": 150}, "data": {"label": "is_positive", "inputs": {"value": {"type": "int"}}, "outputs": {"positive": {"type": "int"}, "negative": {"type": "int"}, "zero": {"type": "int"}}}},
            {"id": "out-1", "type": "custom", "position": {"x": 500, "y": 150}, "data": {"label": "terminal_output", "inputs": {"value": {"type": "Any"}}, "outputs": {"done": {"type": "str"}}}}
        ],
        "edges": [
            {"id": "e1", "source": "in-1", "target": "check-1", "sourceHandle": "out", "targetHandle": "value"},
            {"id": "e2", "source": "check-1", "target": "out-1", "sourceHandle": "positive", "targetHandle": "value"},
            {"id": "e3", "source": "check-1", "target": "out-1", "sourceHandle": "negative", "targetHandle": "value"},
            {"id": "e4", "source": "check-1", "target": "out-1", "sourceHandle": "zero", "targetHandle": "value"}
        ]
    }
}


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
