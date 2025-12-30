"""Test script for Even/Odd Flow to verify race condition fix."""

import asyncio
import anyio
from core.executor import Executor
from core.graph_topology import build_graph
from core.spec_models import EdgeSpec
from examples.node_specs import EXAMPLE_NODES

# Build the Even/Odd Flow graph
nodes = {node.name: node for node in EXAMPLE_NODES}

graph = build_graph(
    nodes=[
        nodes["terminal_input"],
        nodes["is_even"],
        nodes["double"],
        nodes["triple"],
        nodes["terminal_output"],
    ],
    edges=[
        EdgeSpec(source_node="terminal_input", source_branch="out", target_node="is_even", target_input="value"),
        EdgeSpec(source_node="is_even", source_branch="yes", target_node="double", target_input="value"),
        EdgeSpec(source_node="is_even", source_branch="no", target_node="triple", target_input="value"),
        EdgeSpec(source_node="double", source_branch="result", target_node="terminal_output", target_input="value"),
        EdgeSpec(source_node="triple", source_branch="result", target_node="terminal_output", target_input="value"),
    ]
)

# Collect outputs
outputs = []

async def observer(event_type: str, data: dict):
    if event_type == "terminal_output":
        outputs.append(data["value"])
    if event_type == "node_error":
        print(f"ERROR: {data['node_id']}: {data['error']}")
        raise Exception(f"Node error: {data['error']}")

async def input_handler(trigger_id: str):
    return None

async def test():
    executor = Executor(graph, observers=[observer], input_handler=input_handler)
    
    # Initialize executor
    executor._init_queues()
    executor._inject_inits()
    executor._stopped = False
    
    async with anyio.create_task_group() as tg:
        executor._task_group = tg
        
        # Test with even number (should double: 4 -> 8)
        outputs.clear()
        await executor.fire_trigger("terminal_input", 4)
        await asyncio.sleep(0.1)
        assert "8" in outputs, f"Expected '8' in outputs, got {outputs}"
        print("PASS: Even number test passed: 4 -> 8")
        
        # Test with odd number (should triple: 5 -> 15)
        outputs.clear()
        await executor.fire_trigger("terminal_input", 5)
        await asyncio.sleep(0.1)
        assert "15" in outputs, f"Expected '15' in outputs, got {outputs}"
        print("PASS: Odd number test passed: 5 -> 15")
        
        # Test multiple rapid fires to stress test race condition
        outputs.clear()
        await asyncio.gather(
            executor.fire_trigger("terminal_input", 2),
            executor.fire_trigger("terminal_input", 3),
            executor.fire_trigger("terminal_input", 6),
        )
        await asyncio.sleep(0.2)
        assert "4" in outputs, f"Expected '4' in outputs, got {outputs}"
        assert "9" in outputs, f"Expected '9' in outputs, got {outputs}"
        assert "12" in outputs, f"Expected '12' in outputs, got {outputs}"
        print("PASS: Multiple rapid fires test passed")
        
        executor.stop()
    
    print("\nAll tests passed! Race condition fix verified.")

if __name__ == "__main__":
    asyncio.run(test())

