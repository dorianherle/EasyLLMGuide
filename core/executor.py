"""
Minimalist executor - no EVENT/DATA distinction.
All yields are just (branch, value).
"""

import inspect
from collections import deque
from typing import Any

import anyio
import networkx as nx

from core.graph_topology import get_downstream
from core.logging_setup import logger
from core.spec_models import NodeSpec


# Special node types that interact with terminal
TERMINAL_READ_NODES = ['terminal_read_int', 'terminal_read_str']
TERMINAL_WRITE_NODES = ['terminal_write']
LOGGER_NODES = ['logger']


class Executor:
    def __init__(self, graph: nx.MultiDiGraph, observers: list = None):
        self.graph = graph
        self.observers = observers or []
        self.input_queues: dict[tuple[str, str], deque] = {}
        self.running: dict[str, int] = {}
        self.scheduled: set[str] = set()
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
        
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        for input_name, input_def in spec.inputs.items():
            queue = self.input_queues[(node_id, input_name)]
            if len(queue) == 0 and input_def.default is None:
                return False
        return True
    
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
        """Get the original node type name from instance ID."""
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        return spec.func.__name__
    
    async def _run_node(self, node_id: str, task_group: anyio.abc.TaskGroup):
        self.scheduled.discard(node_id)
        self.running[node_id] += 1
        
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        args = self._pop_inputs(node_id)
        node_type = self._get_node_type(node_id)
        
        logger.info("node_start", node_id=node_id, node_type=node_type)
        await self._notify("node_start", {"node_id": node_id, "node_type": node_type})
        
        try:
            func = spec.func
            
            if inspect.isasyncgenfunction(func):
                async for item in func(**args):
                    # Support both (branch, value) and (branch, value, kind) for backwards compat
                    if len(item) == 2:
                        branch, value = item
                    else:
                        branch, value, _ = item  # Ignore kind
                    
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
        """Handle node output - route to downstream or notify for terminal/logger."""
        
        # Check if this is a terminal write
        if node_type in TERMINAL_WRITE_NODES:
            await self._notify("terminal_write", {"node_id": node_id, "value": value})
        
        # Check if this is a logger
        if node_type in LOGGER_NODES:
            await self._notify("log", {"node_id": node_id, "value": value})
        
        # Always route to downstream nodes
        logger.info("node_output", node_id=node_id, branch=branch)
        await self._notify("node_output", {"node_id": node_id, "branch": branch, "value": value})
        await self._route_output(node_id, branch, value)
        self._schedule_ready(task_group)
    
    def _schedule_ready(self, task_group: anyio.abc.TaskGroup):
        for node_id in self._get_ready_nodes():
            self.scheduled.add(node_id)
            task_group.start_soon(self._run_node, node_id, task_group)
    
    async def run(self, entry_bindings: dict[tuple[str, str], Any] = None):
        entry_bindings = entry_bindings or {}
        
        self._init_queues()
        self._inject_inits()
        self._inject_entries(entry_bindings)
        self.scheduled.clear()
        
        async with anyio.create_task_group() as tg:
            self._schedule_ready(tg)
