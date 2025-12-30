"""
Executor with dynamic input support.
terminal_input nodes request input during execution.
"""

import asyncio
import inspect
from collections import deque
from typing import Any, Callable

import anyio
import networkx as nx

from core.graph_topology import get_downstream
from core.logging_setup import logger
from core.spec_models import NodeSpec


TERMINAL_OUTPUT_NODES = ['terminal_output']
LOGGER_NODES = ['logger']
TERMINAL_INPUT_NODES = ['terminal_input']


class Executor:
    def __init__(self, graph: nx.MultiDiGraph, observers: list = None, input_handler: Callable = None):
        self.graph = graph
        self.observers = observers or []
        self.input_handler = input_handler  # async callback to get input
        self.input_queues: dict[tuple[str, str], deque] = {}
        self.running: dict[str, int] = {}
        self.scheduled: set[str] = set()
        self.completed: set[str] = set()  # Track completed nodes
        self.max_concurrency_per_node = 1
        
    def _init_queues(self):
        for node_id in self.graph.nodes:
            spec: NodeSpec = self.graph.nodes[node_id]["spec"]
            self.running[node_id] = 0
            for input_name in spec.inputs:
                self.input_queues[(node_id, input_name)] = deque()
    
    def _inject_inits(self):
        for node_id in self.graph.nodes:
            spec: NodeSpec = self.graph.nodes[node_id]["spec"]
            # Skip terminal_input - they get input dynamically
            if self._get_node_type(node_id) in TERMINAL_INPUT_NODES:
                continue
            for input_name, input_def in spec.inputs.items():
                if input_def.init is not None:
                    self.input_queues[(node_id, input_name)].append(input_def.init)
    
    def _inject_entries(self, entry_bindings: dict[tuple[str, str], Any]):
        for (node_id, input_name), value in entry_bindings.items():
            if (node_id, input_name) in self.input_queues:
                self.input_queues[(node_id, input_name)].append(value)
    
    def _is_ready(self, node_id: str) -> bool:
        if self.running[node_id] >= self.max_concurrency_per_node:
            return False
        if node_id in self.scheduled:
            return False
        if node_id in self.completed:
            return False
        
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        node_type = self._get_node_type(node_id)
        
        # terminal_input is ready only when a downstream node needs it
        if node_type in TERMINAL_INPUT_NODES:
            return self._is_terminal_input_needed(node_id)
        
        has_any_queued_input = False
        for input_name, input_def in spec.inputs.items():
            queue = self.input_queues[(node_id, input_name)]
            if len(queue) > 0:
                has_any_queued_input = True
            elif input_def.default is None and input_def.init is None:
                return False
        return has_any_queued_input
    
    def _is_terminal_input_needed(self, terminal_node_id: str) -> bool:
        """Check if a terminal_input should fire - when downstream nodes have all OTHER inputs ready."""
        downstream = get_downstream(self.graph, terminal_node_id, "out")
        
        for target_node, target_input in downstream:
            target_spec: NodeSpec = self.graph.nodes[target_node]["spec"]
            
            # Check if all OTHER inputs of the target node are satisfied
            other_inputs_ready = True
            for input_name, input_def in target_spec.inputs.items():
                if input_name == target_input:
                    continue  # Skip the input we would provide
                
                queue = self.input_queues[(target_node, input_name)]
                has_value = len(queue) > 0
                has_default = input_def.default is not None
                has_init = input_def.init is not None
                
                # Check if this input comes from another terminal_input that's also waiting
                comes_from_terminal = self._input_comes_from_terminal(target_node, input_name)
                
                if not has_value and not has_default and not has_init and not comes_from_terminal:
                    other_inputs_ready = False
                    break
            
            if other_inputs_ready:
                return True
        
        return False
    
    def _input_comes_from_terminal(self, node_id: str, input_name: str) -> bool:
        """Check if an input comes from a terminal_input node."""
        for u, v, data in self.graph.in_edges(node_id, data=True):
            if data["dst_input"] == input_name:
                if self._get_node_type(u) in TERMINAL_INPUT_NODES:
                    return True
        return False
    
    def _get_ready_nodes(self) -> list[str]:
        return [n for n in self.graph.nodes if self._is_ready(n)]
    
    def _pop_inputs(self, node_id: str) -> dict[str, Any]:
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        args = {}
        for input_name, input_def in spec.inputs.items():
            queue = self.input_queues[(node_id, input_name)]
            if len(queue) > 0:
                args[input_name] = queue.popleft()
            else:
                args[input_name] = input_def.default
        return args
    
    async def _notify(self, event_type: str, data: dict):
        for observer in self.observers:
            await observer(event_type, data)
    
    async def _route_output(self, node_id: str, branch: str, value: Any):
        downstream = get_downstream(self.graph, node_id, branch)
        for target_node, target_input in downstream:
            self.input_queues[(target_node, target_input)].append(value)
    
    def _get_node_type(self, node_id: str) -> str:
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        return spec.func.__name__
    
    async def _run_node(self, node_id: str, task_group: anyio.abc.TaskGroup):
        self.scheduled.discard(node_id)
        self.running[node_id] += 1
        
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        node_type = self._get_node_type(node_id)
        
        # Handle terminal_input specially - request input from user
        if node_type in TERMINAL_INPUT_NODES:
            logger.info("input_needed", node_id=node_id)
            await self._notify("input_needed", {"node_id": node_id, "input": "value", "type": "int"})
            
            if self.input_handler:
                value = await self.input_handler(node_id)
                args = {"value": value}
                self.completed.add(node_id)  # Mark as completed so it doesn't run again
            else:
                self.running[node_id] -= 1
                return
        else:
            args = self._pop_inputs(node_id)
        
        logger.info("node_start", node_id=node_id, node_type=node_type)
        await self._notify("node_start", {"node_id": node_id, "node_type": node_type})
        
        try:
            func = spec.func
            
            if inspect.isasyncgenfunction(func):
                async for item in func(**args):
                    if len(item) == 2:
                        branch, value = item
                    else:
                        branch, value, _ = item
                    await self._handle_output(node_id, node_type, branch, value, task_group)
                    
            elif inspect.iscoroutinefunction(func):
                result = await func(**args)
                if result:
                    items = result if isinstance(result, list) else [result]
                    for item in items:
                        if len(item) == 2:
                            branch, value = item
                        else:
                            branch, value, _ = item
                        await self._handle_output(node_id, node_type, branch, value, task_group)
            else:
                result = func(**args)
                if result:
                    items = result if isinstance(result, list) else [result]
                    for item in items:
                        if len(item) == 2:
                            branch, value = item
                        else:
                            branch, value, _ = item
                        await self._handle_output(node_id, node_type, branch, value, task_group)
                        
        except Exception as e:
            logger.error("node_error", node_id=node_id, error=str(e))
            await self._notify("node_error", {"node_id": node_id, "error": str(e)})
        finally:
            self.running[node_id] -= 1
            logger.info("node_done", node_id=node_id)
            await self._notify("node_done", {"node_id": node_id})
            self._schedule_ready(task_group)
    
    async def _handle_output(self, node_id: str, node_type: str, branch: str, value: Any, task_group):
        if node_type in TERMINAL_OUTPUT_NODES:
            await self._notify("terminal_output", {"node_id": node_id, "value": value})
        
        if node_type in LOGGER_NODES:
            await self._notify("log", {"node_id": node_id, "value": value})
        
        logger.info("node_output", node_id=node_id, branch=branch)
        await self._notify("node_output", {"node_id": node_id, "branch": branch, "value": value})
        await self._route_output(node_id, branch, value)
        self._schedule_ready(task_group)
    
    def _schedule_ready(self, task_group: anyio.abc.TaskGroup):
        for node_id in self._get_ready_nodes():
            # Don't auto-schedule terminal_input - they need special handling
            if self._get_node_type(node_id) in TERMINAL_INPUT_NODES:
                # Only schedule if not already waiting
                if node_id not in self.scheduled:
                    self.scheduled.add(node_id)
                    task_group.start_soon(self._run_node, node_id, task_group)
            else:
                self.scheduled.add(node_id)
                task_group.start_soon(self._run_node, node_id, task_group)
    
    async def run(self, entry_bindings: dict[tuple[str, str], Any] = None):
        entry_bindings = entry_bindings or {}
        
        self._init_queues()
        self._inject_inits()
        self._inject_entries(entry_bindings)
        self.scheduled.clear()
        self.completed.clear()
        
        async with anyio.create_task_group() as tg:
            self._schedule_ready(tg)
