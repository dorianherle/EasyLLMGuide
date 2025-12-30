"""
Export graph to standalone Python code with trigger-based dataflow model.

The exported code uses an IO adapter pattern where:
- Triggers are entry points that receive external events
- Data flows downstream immediately when available  
- Multi-input nodes wait until all inputs arrive
"""

import networkx as nx
from typing import Any


TRIGGER_TYPES = ("terminal_input", "trigger")
OUTPUT_TYPES = ("terminal_output",)


def export_graph(instances: list[dict], edges: list[dict], node_types: dict) -> str:
    """
    Export a graph to Python code.
    
    Args:
        instances: List of {"id": "node-1", "type": "double"}
        edges: List of {"source": "n1", "sourceHandle": "out", "target": "n2", "targetHandle": "value"}
        node_types: Dict of node_type -> {"inputs": {...}, "outputs": {...}}
    
    Returns:
        Generated Python code as string
    """
    # Build graph structure
    g = nx.DiGraph()
    for inst in instances:
        g.add_node(inst["id"], type=inst["type"])
    
    for edge in edges:
        g.add_edge(
            edge["source"], 
            edge["target"],
            src_handle=edge["sourceHandle"],
            dst_handle=edge["targetHandle"]
        )
    
    # Find triggers and outputs
    triggers = []
    outputs = []
    
    for node_id in g.nodes:
        node_type = g.nodes[node_id]["type"]
        if node_type in TRIGGER_TYPES:
            triggers.append(node_id)
        elif node_type in OUTPUT_TYPES:
            outputs.append(node_id)
    
    # Topological sort (skip if has cycles)
    try:
        sorted_nodes = list(nx.topological_sort(g))
    except nx.NetworkXUnfeasible:
        return _export_error("Graph has cycles - cannot export to simple Python")
    
    # Collect function imports
    functions_used = set()
    for node_id in g.nodes:
        node_type = g.nodes[node_id]["type"]
        if node_type not in TRIGGER_TYPES and node_type not in OUTPUT_TYPES and node_type != "logger":
            functions_used.add(node_type)
    
    # Determine trigger types
    trigger_specs = []
    for node_id in triggers:
        type_name = "Any"
        for _, target, data in g.out_edges(node_id, data=True):
            target_type = g.nodes[target]["type"]
            if target_type in node_types:
                target_handle = data["dst_handle"]
                if target_handle in node_types[target_type].get("inputs", {}):
                    type_name = node_types[target_type]["inputs"][target_handle].get("type", "Any")
                    break
        trigger_specs.append({"id": node_id, "type": type_name})
    
    # Generate code
    lines = []
    lines.append('"""')
    lines.append('Auto-generated workflow (trigger-based dataflow)')
    lines.append(f'Triggers: {", ".join(s["id"].replace("-", "_") for s in trigger_specs)}')
    lines.append(f'Outputs: {len(outputs)} terminal outputs')
    lines.append('"""')
    lines.append('')
    
    if functions_used:
        lines.append(f'from examples.basic_nodes import {", ".join(sorted(functions_used))}')
    
    lines.append('from core.io_adapter import IOAdapter, DictIO, ConsoleIO')
    
    lines.append('')
    lines.append('')
    lines.append('async def workflow(io):')
    lines.append('    """')
    lines.append('    Run the workflow with the given IO adapter.')
    lines.append('    ')
    lines.append('    Args:')
    lines.append('        io: Object with async input(name, type) and output(name, value) methods')
    lines.append('    ')
    lines.append('    The io adapter handles triggers (inputs) and outputs.')
    lines.append('    Data flows downstream immediately when available.')
    lines.append('    """')
    
    # Track variable names for each node's output
    var_map = {}
    
    for node_id in sorted_nodes:
        node_type = g.nodes[node_id]["type"]
        var_name = _make_var_name(node_id)
        
        if node_type in TRIGGER_TYPES:
            # Get input from trigger (via IO adapter)
            trigger_name = node_id.replace("-", "_")
            type_hint = "int"
            for spec in trigger_specs:
                if spec["id"] == node_id:
                    type_hint = spec["type"]
                    break
            lines.append(f'    {var_name} = await io.input("{trigger_name}", {type_hint})')
            var_map[node_id] = var_name
            
        elif node_type in OUTPUT_TYPES:
            # Send output via IO adapter
            output_name = node_id.replace("-", "_")
            input_var = _get_input_var(g, node_id, "value", var_map)
            lines.append(f'    await io.output("{output_name}", {input_var})')
            
        elif node_type == "logger":
            input_var = _get_input_var(g, node_id, "msg", var_map)
            lines.append(f'    print(f"[LOG] {{{input_var}}}")')
            
        else:
            # Regular function call
            lines.append(f'    ')
            lines.append(f'    # {node_type}')
            
            # Get input arguments
            args = []
            if node_type in node_types:
                for input_name in node_types[node_type].get("inputs", {}):
                    input_var = _get_input_var(g, node_id, input_name, var_map)
                    args.append(f'{input_name}={input_var}')
            
            # Check if it's a branching node
            out_edges = list(g.out_edges(node_id, data=True))
            output_handles = set(e[2]["src_handle"] for e in out_edges)
            
            if len(output_handles) > 1:
                # Branching node
                lines.append(f'    async for branch, value in {node_type}({", ".join(args)}):')
                for handle in sorted(output_handles):
                    lines.append(f'        if branch == "{handle}":')
                    lines.append(f'            {var_name}_{handle} = value')
                    var_map[f"{node_id}:{handle}"] = f"{var_name}_{handle}"
                var_map[node_id] = f"{var_name}_value"
            else:
                # Single output
                lines.append(f'    async for _, {var_name} in {node_type}({", ".join(args)}):')
                lines.append(f'        pass')
                var_map[node_id] = var_name
    
    lines.append('')
    lines.append('')
    lines.append('if __name__ == "__main__":')
    lines.append('    import asyncio')
    lines.append('    ')
    lines.append('    async def main():')
    lines.append('        # ConsoleIO prompts for trigger values interactively')
    lines.append('        io = ConsoleIO()')
    lines.append('        await workflow(io)')
    lines.append('    ')
    lines.append('    asyncio.run(main())')
    
    return '\n'.join(lines)


def _make_var_name(node_id: str) -> str:
    """Convert node ID to valid Python variable name."""
    return node_id.replace("-", "_").replace(" ", "_")


def _get_input_var(g: nx.DiGraph, node_id: str, input_name: str, var_map: dict) -> str:
    """Get the variable name that provides input to this node."""
    for source, target, data in g.in_edges(node_id, data=True):
        if data["dst_handle"] == input_name:
            src_handle = data["src_handle"]
            key_with_handle = f"{source}:{src_handle}"
            if key_with_handle in var_map:
                return var_map[key_with_handle]
            elif source in var_map:
                return var_map[source]
    return "None  # No input connected"


def _export_error(message: str) -> str:
    """Generate error comment."""
    return f'# Export Error: {message}\n# Please simplify your graph and try again.'
