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
        
        if src_type != dst_type:
            errors.append(f"Edge {u}->{v}: type mismatch {src_type} -> {dst_type}")
    
    # Check input coverage
    for node_id in g.nodes:
        spec: NodeSpec = g.nodes[node_id]["spec"]
        
        incoming = {}
        for u, v, data in g.in_edges(node_id, data=True):
            incoming[data["dst_input"]] = True
        
        for input_name, input_def in spec.inputs.items():
            has_edge = input_name in incoming
            has_entry = (node_id, input_name) in entry_bindings
            has_init = input_def.init is not None
            has_default = input_def.default is not None
            
            if not (has_edge or has_entry or has_init or has_default):
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

