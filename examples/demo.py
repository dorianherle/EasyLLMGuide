"""
Demo: Simple number processing flow with branching.

Flow:
  [number_input] → [is_even] 
                      → yes → [double] → [display_number]
                      → no  → [triple] → [display_number]

Run with: python -m examples.demo
"""

import asyncio
from core.graph_topology import build_graph, validate_graph
from core.executor import Executor
from core.dev_console import rich_observer
from core.spec_models import EdgeSpec
from examples.node_specs import get_node_by_name


async def main():
    # Get the nodes we need
    nodes = [
        get_node_by_name("number_input"),
        get_node_by_name("is_even"),
        get_node_by_name("double"),
        get_node_by_name("triple"),
        get_node_by_name("display_number"),
    ]
    
    # Define edges (connections between nodes)
    edges = [
        # number_input.out → is_even.value
        EdgeSpec(source_node="number_input", source_branch="out", 
                 target_node="is_even", target_input="value"),
        
        # is_even.yes → double.value (even numbers get doubled)
        EdgeSpec(source_node="is_even", source_branch="yes",
                 target_node="double", target_input="value"),
        
        # is_even.no → triple.value (odd numbers get tripled)
        EdgeSpec(source_node="is_even", source_branch="no",
                 target_node="triple", target_input="value"),
        
        # double.result → display_number.value
        EdgeSpec(source_node="double", source_branch="result",
                 target_node="display_number", target_input="value"),
        
        # triple.result → display_number.value  
        EdgeSpec(source_node="triple", source_branch="result",
                 target_node="display_number", target_input="value"),
    ]
    
    # Build and validate the graph
    graph = build_graph(nodes, edges)
    errors = validate_graph(graph)
    
    if errors:
        print("Validation errors:")
        for err in errors:
            print(f"  - {err}")
        return
    
    print("Graph validated successfully!\n")
    
    # Run with different inputs
    for test_value in [10, 7, 42, 15]:
        print(f"\n{'='*40}")
        print(f"Running with input: {test_value}")
        print('='*40)
        
        executor = Executor(graph, observers=[rich_observer])
        
        # Provide the input value
        entry_bindings = {
            ("number_input", "value"): test_value
        }
        
        await executor.run(entry_bindings)


if __name__ == "__main__":
    asyncio.run(main())

