"""
Demo script showing the minimalist graph system.

Run with: python -m examples.demo
"""

import asyncio
from core.spec_models import NodeSpec, InputDef, OutputDef, EdgeSpec
from core.graph_topology import build_graph, validate_graph
from core.executor import Executor
from core.logging_setup import logger
from examples.node_specs import EXAMPLE_NODES, get_node_by_name


def create_math_chain():
    """
    Creates a simple math chain:
    constant(5) -> square -> double -> to_string -> terminal_write
    
    Result: 5² = 25, 25×2 = 50, outputs "50"
    """
    # Get node specs
    constant = get_node_by_name("constant")
    square = get_node_by_name("square")
    double = get_node_by_name("double")
    to_string = get_node_by_name("to_string")
    terminal_write = get_node_by_name("terminal_write")
    
    # Create instances with unique IDs
    instances = [
        NodeSpec(name="const-1", inputs=constant.inputs, outputs=constant.outputs, func=constant.func),
        NodeSpec(name="sq-1", inputs=square.inputs, outputs=square.outputs, func=square.func),
        NodeSpec(name="dbl-1", inputs=double.inputs, outputs=double.outputs, func=double.func),
        NodeSpec(name="str-1", inputs=to_string.inputs, outputs=to_string.outputs, func=to_string.func),
        NodeSpec(name="term-1", inputs=terminal_write.inputs, outputs=terminal_write.outputs, func=terminal_write.func),
    ]
    
    # Connect them
    edges = [
        EdgeSpec(source_node="const-1", source_branch="out", target_node="sq-1", target_input="value"),
        EdgeSpec(source_node="sq-1", source_branch="result", target_node="dbl-1", target_input="value"),
        EdgeSpec(source_node="dbl-1", source_branch="result", target_node="str-1", target_input="value"),
        EdgeSpec(source_node="str-1", source_branch="result", target_node="term-1", target_input="value"),
    ]
    
    return instances, edges


def create_even_odd_flow():
    """
    Creates an even/odd branching flow:
    constant -> is_even -> double (if yes) / triple (if no) -> to_string -> terminal_write
    """
    constant = get_node_by_name("constant")
    is_even = get_node_by_name("is_even")
    double = get_node_by_name("double")
    triple = get_node_by_name("triple")
    to_string = get_node_by_name("to_string")
    terminal_write = get_node_by_name("terminal_write")
    
    instances = [
        NodeSpec(name="const-1", inputs=constant.inputs, outputs=constant.outputs, func=constant.func),
        NodeSpec(name="check-1", inputs=is_even.inputs, outputs=is_even.outputs, func=is_even.func),
        NodeSpec(name="dbl-1", inputs=double.inputs, outputs=double.outputs, func=double.func),
        NodeSpec(name="trpl-1", inputs=triple.inputs, outputs=triple.outputs, func=triple.func),
        NodeSpec(name="str-1", inputs=to_string.inputs, outputs=to_string.outputs, func=to_string.func),
        NodeSpec(name="term-1", inputs=terminal_write.inputs, outputs=terminal_write.outputs, func=terminal_write.func),
    ]
    
    edges = [
        EdgeSpec(source_node="const-1", source_branch="out", target_node="check-1", target_input="value"),
        EdgeSpec(source_node="check-1", source_branch="yes", target_node="dbl-1", target_input="value"),
        EdgeSpec(source_node="check-1", source_branch="no", target_node="trpl-1", target_input="value"),
        EdgeSpec(source_node="dbl-1", source_branch="result", target_node="str-1", target_input="value"),
        EdgeSpec(source_node="trpl-1", source_branch="result", target_node="str-1", target_input="value"),
        EdgeSpec(source_node="str-1", source_branch="result", target_node="term-1", target_input="value"),
    ]
    
    return instances, edges


async def run_demo():
    print("=" * 50)
    print("Minimalist Graph System Demo")
    print("=" * 50)
    
    # Demo 1: Math Chain
    print("\n[Demo 1] Math Chain: 5 -> square -> double -> terminal")
    print("-" * 40)
    
    instances, edges = create_math_chain()
    graph = build_graph(instances, edges)
    
    # Entry point: const-1.value = 5
    entry_bindings = {("const-1", "value"): 5}
    
    errors = validate_graph(graph, entry_bindings)
    if errors:
        print(f"Validation errors: {errors}")
        return
    
    terminal_outputs = []
    
    async def observer(event_type, data):
        if event_type == "terminal_write":
            terminal_outputs.append(data["value"])
            print(f"  [TERMINAL] {data['value']}")
        elif event_type == "node_start":
            print(f"  ▶ {data['node_id']}")
        elif event_type == "node_done":
            print(f"  ✓ {data['node_id']}")
    
    executor = Executor(graph, observers=[observer])
    await executor.run(entry_bindings)
    
    print(f"\nResult: {terminal_outputs}")
    
    # Demo 2: Even/Odd Flow
    print("\n" + "=" * 50)
    print("[Demo 2] Even/Odd Flow: 7 -> is_even -> triple -> terminal")
    print("-" * 40)
    
    instances, edges = create_even_odd_flow()
    graph = build_graph(instances, edges)
    
    entry_bindings = {("const-1", "value"): 7}  # 7 is odd -> triple -> 21
    
    errors = validate_graph(graph, entry_bindings)
    if errors:
        print(f"Validation errors: {errors}")
        return
    
    terminal_outputs = []
    executor = Executor(graph, observers=[observer])
    await executor.run(entry_bindings)
    
    print(f"\nResult: {terminal_outputs}")
    
    # Demo 3: Same flow with even number
    print("\n" + "=" * 50)
    print("[Demo 3] Even/Odd Flow: 8 -> is_even -> double -> terminal")
    print("-" * 40)
    
    entry_bindings = {("const-1", "value"): 8}  # 8 is even -> double -> 16
    
    terminal_outputs = []
    executor = Executor(graph, observers=[observer])
    await executor.run(entry_bindings)
    
    print(f"\nResult: {terminal_outputs}")


if __name__ == "__main__":
    asyncio.run(run_demo())
