"""
Server with dynamic input support.
"""

import asyncio
import json
import traceback
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.spec_models import NodeSpec, InputDef, OutputDef, EdgeSpec
from core.graph_topology import build_graph, validate_graph
from core.executor import Executor
from examples.node_specs import EXAMPLE_NODES

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Node type registry
node_types: dict[str, NodeSpec] = {node.name: node for node in EXAMPLE_NODES}

# Current graph state
current_graph = None
current_instances = {}

# Websocket clients and pending inputs
websocket_clients: list[WebSocket] = []
pending_inputs: dict[str, asyncio.Future] = {}


class NodeInstance(BaseModel):
    id: str
    type: str


class GraphDefinition(BaseModel):
    instances: list[NodeInstance]
    edges: list[dict]


@app.get("/nodes")
async def get_nodes():
    result = []
    for name, spec in node_types.items():
        visible_inputs = {k: {"type": v.type.__name__} for k, v in spec.inputs.items() if v.init is None}
        result.append({
            "name": name,
            "inputs": visible_inputs,
            "outputs": {k: {"type": v.type.__name__} for k, v in spec.outputs.items()},
        })
    return result


@app.post("/graph")
async def save_graph(graph_def: GraphDefinition):
    global current_graph, current_instances
    
    print(f"[GRAPH] Instances: {[(i.id, i.type) for i in graph_def.instances]}")
    
    current_instances = {}
    instance_specs = []
    
    for inst in graph_def.instances:
        if inst.type not in node_types:
            return {"status": "error", "errors": [f"Unknown node type: {inst.type}"]}
        
        base_spec = node_types[inst.type]
        instance_spec = NodeSpec(
            name=inst.id,
            inputs=base_spec.inputs,
            outputs=base_spec.outputs,
            func=base_spec.func
        )
        instance_specs.append(instance_spec)
        current_instances[inst.id] = inst.type
    
    edges = []
    for e in graph_def.edges:
        edges.append(EdgeSpec(
            source_node=e["source"],
            source_branch=e["sourceHandle"],
            target_node=e["target"],
            target_input=e["targetHandle"]
        ))
    
    current_graph = build_graph(instance_specs, edges)
    
    errors = validate_graph(current_graph, {})
    errors = [e for e in errors if 'terminal_input' not in e]
    
    print(f"[GRAPH] Validation: {'OK' if not errors else errors}")
    
    return {
        "status": "ok" if not errors else "error",
        "errors": errors,
    }


async def run_executor():
    """Run the executor in background."""
    global current_graph, pending_inputs
    
    # Small delay to ensure websocket is ready
    await asyncio.sleep(0.1)
    
    async def ws_observer(event_type: str, data: dict):
        msg = json.dumps({
            "type": event_type,
            "data": {k: str(v) for k, v in data.items()}
        })
        for ws in websocket_clients:
            try:
                await ws.send_text(msg)
            except:
                pass
    
    async def input_handler(node_id: str) -> Any:
        future = asyncio.get_event_loop().create_future()
        pending_inputs[node_id] = future
        value = await future
        del pending_inputs[node_id]
        return value
    
    executor = Executor(current_graph, observers=[ws_observer], input_handler=input_handler)
    
    try:
        await executor.run({})
        print(f"[RUN] Completed")
        await ws_observer("run_complete", {})
    except Exception as e:
        print(f"[RUN] Error: {e}")
        traceback.print_exc()
        await ws_observer("run_error", {"error": str(e)})


@app.post("/run")
async def run_graph():
    """Start graph execution - returns immediately, progress via websocket."""
    global current_graph
    
    if current_graph is None:
        return {"error": "No graph defined"}
    
    pending_inputs.clear()
    
    # Start execution in background task
    asyncio.create_task(run_executor())
    
    return {"status": "started"}


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    websocket_clients.append(websocket)
    print(f"[WS] Client connected. Total: {len(websocket_clients)}")
    
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
                    if node_id in pending_inputs:
                        pending_inputs[node_id].set_result(value)
                        print(f"[WS] Input received for {node_id}: {value}")
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        websocket_clients.remove(websocket)
        print(f"[WS] Client disconnected. Total: {len(websocket_clients)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
