from typing import Any
import networkx as nx
from core.spec_models import NodeSpec, EdgeSpec


def build_graph(nodes: list[NodeSpec], edges: list[EdgeSpec]) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()
    
    for node in nodes:
        g.add_node(node.name, spec=node)
    
    for edge in edges:
        g.add_edge(
            edge.source_node,
            edge.target_node,
            src_branch=edge.source_branch,
            dst_input=edge.target_input
        )
    
    return g


TRIGGER_TYPES = {'terminal_input', 'trigger'}


def validate_graph(g: nx.MultiDiGraph, entry_bindings: dict[tuple[str, str], any] = None) -> list[str]:
    """Validate the graph and return list of errors (empty if valid)."""
    errors = []
    entry_bindings = entry_bindings or {}
    
    # Check type matching on edges
    for u, v, data in g.edges(data=True):
        src_spec: NodeSpec = g.nodes[u]["spec"]
        dst_spec: NodeSpec = g.nodes[v]["spec"]
        
        src_branch = data["src_branch"]
        dst_input = data["dst_input"]
        
        if src_branch not in src_spec.outputs:
            errors.append(f"Edge {u}->{v}: source branch '{src_branch}' not in {u}'s outputs")
            continue
        if dst_input not in dst_spec.inputs:
            errors.append(f"Edge {u}->{v}: target input '{dst_input}' not in {v}'s inputs")
            continue
        
        src_type = src_spec.outputs[src_branch].type
        dst_type = dst_spec.inputs[dst_input].type
        
        # Allow Any type to match anything
        if src_type != dst_type and src_type is not Any and dst_type is not Any:
            errors.append(f"Edge {u}->{v}: type mismatch {src_type} -> {dst_type}")
    
    # Check input coverage
    for node_id in g.nodes:
        spec: NodeSpec = g.nodes[node_id]["spec"]
        node_type = spec.node_type or spec.func.__name__
        
        # Skip validation for triggers - they receive external input
        if node_type in TRIGGER_TYPES:
            continue
        
        incoming = {}
        for u, v, data in g.in_edges(node_id, data=True):
            inp = data["dst_input"]
            incoming[inp] = incoming.get(inp, 0) + 1
        
        for input_name, input_def in spec.inputs.items():
            edge_count = incoming.get(input_name, 0)
            has_entry = (node_id, input_name) in entry_bindings
            has_init = input_def.init is not None
            has_default = input_def.default is not None
            
            # Multiple connections are OK in dataflow model (values are queued)
            # But we still warn since it might be unintentional
            # Uncomment if you want to allow without warning:
            # if edge_count > 1:
            #     errors.append(f"Node '{node_id}' input '{input_name}' has multiple connections ({edge_count})")
            
            if edge_count == 0 and not (has_entry or has_init or has_default):
                errors.append(f"Node '{node_id}' input '{input_name}' has no source")
    
    # Check cycles have init or entry
    sccs = list(nx.strongly_connected_components(g))
    for scc in sccs:
        if len(scc) <= 1:
            continue
        
        has_starter = False
        for node_id in scc:
            spec: NodeSpec = g.nodes[node_id]["spec"]
            for input_name, input_def in spec.inputs.items():
                if input_def.init is not None or (node_id, input_name) in entry_bindings:
                    has_starter = True
                    break
            if has_starter:
                break
        
        if not has_starter:
            errors.append(f"Cycle {scc} has no init or entry binding to start it")
    
    return errors


def get_downstream(g: nx.MultiDiGraph, node_id: str, branch: str) -> list[tuple[str, str]]:
    """Get list of (target_node, target_input) for a given output branch."""
    result = []
    for u, v, data in g.out_edges(node_id, data=True):
        if data["src_branch"] == branch:
            result.append((v, data["dst_input"]))
    return result

