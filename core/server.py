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
current_instances = {}  # instance_id -> node_type_name
current_entry_points = []  # List of (instance_id, input_name) that need values
websocket_clients: list[WebSocket] = []


class NodeInstance(BaseModel):
    id: str
    type: str  # references node_types


class GraphDefinition(BaseModel):
    instances: list[NodeInstance]
    edges: list[dict]


class RunRequest(BaseModel):
    inputs: dict = {}  # instance_id.input_name -> value


@app.get("/nodes")
async def get_nodes():
    """Get available node types."""
    result = []
    for name, spec in node_types.items():
        result.append({
            "name": name,
            "inputs": {k: {"type": v.type.__name__} for k, v in spec.inputs.items()},
            "outputs": {k: {"type": v.type.__name__} for k, v in spec.outputs.items()},
        })
    return result


@app.post("/graph")
async def save_graph(graph_def: GraphDefinition):
    """Save graph and return entry points (unconnected inputs)."""
    global current_graph, current_instances, current_entry_points
    
    print(f"[GRAPH] Instances: {[(i.id, i.type) for i in graph_def.instances]}")
    print(f"[GRAPH] Edges: {graph_def.edges}")
    
    # Build instance map and create NodeSpecs for each instance
    current_instances = {}
    instance_specs = []
    
    for inst in graph_def.instances:
        if inst.type not in node_types:
            return {"status": "error", "errors": [f"Unknown node type: {inst.type}"]}
        
        base_spec = node_types[inst.type]
        # Create a spec for this instance (using instance ID as node name)
        instance_spec = NodeSpec(
            name=inst.id,
            inputs=base_spec.inputs,
            outputs=base_spec.outputs,
            func=base_spec.func
        )
        instance_specs.append(instance_spec)
        current_instances[inst.id] = inst.type
    
    # Convert edges to use instance IDs
    edges = []
    for e in graph_def.edges:
        edges.append(EdgeSpec(
            source_node=e["source"],
            source_branch=e["sourceHandle"],
            target_node=e["target"],
            target_input=e["targetHandle"]
        ))
    
    current_graph = build_graph(instance_specs, edges)
    
    # Find entry points: inputs with no incoming edges
    current_entry_points = []
    connected_inputs = set()
    for e in edges:
        connected_inputs.add((e.target_node, e.target_input))
    
    for inst in graph_def.instances:
        base_spec = node_types[inst.type]
        for input_name, input_def in base_spec.inputs.items():
            if (inst.id, input_name) not in connected_inputs:
                # This input has no source - it's an entry point
                if input_def.init is None and input_def.default is None:
                    current_entry_points.append({
                        "instance": inst.id,
                        "input": input_name,
                        "type": input_def.type.__name__
                    })
    
    # Validate with entry points marked
    entry_bindings = {(ep["instance"], ep["input"]): None for ep in current_entry_points}
    errors = validate_graph(current_graph, entry_bindings)
    
    print(f"[GRAPH] Entry points: {current_entry_points}")
    print(f"[GRAPH] Validation: {'OK' if not errors else errors}")
    
    return {
        "status": "ok" if not errors else "error",
        "errors": errors,
        "entry_points": current_entry_points
    }


@app.post("/run")
async def run_graph(req: RunRequest):
    """Run the graph with provided input values."""
    global current_graph, current_entry_points
    
    print(f"[RUN] Inputs: {req.inputs}")
    
    if current_graph is None:
        return {"error": "No graph defined"}
    
    # Check all entry points have values
    missing = []
    for ep in current_entry_points:
        key = f"{ep['instance']}.{ep['input']}"
        if key not in req.inputs:
            missing.append(key)
    
    if missing:
        return {"error": f"Missing inputs: {', '.join(missing)}"}
    
    outputs = []
    
    async def ws_observer(event_type: str, data: dict):
        if event_type == "node_yield_data" and data.get("branch") == "output":
            outputs.append(data.get("value"))
        
        msg = json.dumps({
            "type": event_type,
            "data": {k: str(v) for k, v in data.items()}
        })
        for ws in websocket_clients:
            try:
                await ws.send_text(msg)
            except:
                pass
    
    executor = Executor(current_graph, observers=[ws_observer])
    
    # Convert inputs to bindings
    bindings = {}
    for key, value in req.inputs.items():
        parts = key.split(".")
        if len(parts) == 2:
            try:
                value = int(value)
            except (ValueError, TypeError):
                pass
            bindings[(parts[0], parts[1])] = value
            print(f"[RUN] Binding: {parts[0]}.{parts[1]} = {value}")
    
    try:
        await executor.run(bindings)
        print(f"[RUN] Completed. Outputs: {outputs}")
        return {"status": "completed", "outputs": outputs}
    except Exception as e:
        print(f"[RUN] Error: {e}")
        traceback.print_exc()
        return {"error": str(e), "outputs": outputs}


@app.get("/entry_points")
async def get_entry_points():
    """Get current graph's entry points."""
    return {"entry_points": current_entry_points}


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    websocket_clients.append(websocket)
    print(f"[WS] Client connected. Total: {len(websocket_clients)}")
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_clients.remove(websocket)
        print(f"[WS] Client disconnected. Total: {len(websocket_clients)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
