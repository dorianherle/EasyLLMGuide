"""
Trigger-based dataflow executor.

Execution model:
- Triggers are entry points that can fire at any time
- Data propagates downstream immediately when available
- Multi-input nodes buffer until ALL inputs have at least one value
- Each firing consumes one value from each input queue
- Interface nodes are both triggers AND can receive display data
"""

import asyncio
import traceback
from collections import deque
from typing import Any, Callable

import anyio
import networkx as nx

from core.graph_topology import get_downstream
from core.spec_models import NodeSpec, TRIGGER_TYPES, OUTPUT_TYPES, LOGGER_TYPES, INTERFACE_TYPES, UI_COMPONENT_TYPES


class Executor:
    def __init__(self, graph: nx.MultiDiGraph, observers: list = None, input_handler: Callable = None):
        self.graph = graph
        self.observers = observers or []
        self.input_handler = input_handler
        self.input_queues: dict[tuple[str, str], deque] = {}
        self.running: dict[str, int] = {}
        self._task_group = None
        self._stopped = False
        
    def _init_queues(self):
        """Initialize input queues for all nodes."""
        for node_id in self.graph.nodes:
            spec: NodeSpec = self.graph.nodes[node_id]["spec"]
            self.running[node_id] = 0
            for input_name in spec.inputs:
                self.input_queues[(node_id, input_name)] = deque()
    
    def _inject_inits(self):
        """Inject initial values for inputs with init defined."""
        for node_id in self.graph.nodes:
            spec: NodeSpec = self.graph.nodes[node_id]["spec"]
            node_type = self._get_node_type(node_id)
            if node_type in TRIGGER_TYPES:
                continue
            for input_name, input_def in spec.inputs.items():
                if input_def.init is not None:
                    self.input_queues[(node_id, input_name)].append(input_def.init)
    
    def _get_node_type(self, node_id: str) -> str:
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        return spec.node_type or spec.func.__name__
    
    def _is_trigger(self, node_id: str) -> bool:
        """Check if node is a trigger (entry point)."""
        return self._get_node_type(node_id) in TRIGGER_TYPES
    
    def _is_interface(self, node_id: str) -> bool:
        """Check if node is an interface (has UI)."""
        return self._get_node_type(node_id) in INTERFACE_TYPES
    
    def _is_ui_component(self, node_id: str) -> bool:
        """Check if node is a UI component (renders on App canvas)."""
        return self._get_node_type(node_id) in UI_COMPONENT_TYPES
    
    def _has_incoming_edge(self, node_id: str, input_name: str) -> bool:
        """Check if an input has an incoming edge (is connected)."""
        for u, v, data in self.graph.in_edges(node_id, data=True):
            if data.get("dst_input") == input_name:
                return True
        return False
    
    def _all_inputs_ready(self, node_id: str) -> bool:
        """
        Check if all required inputs have data available.
        
        Rules:
        - Connected inputs MUST have queued data
        - Unconnected inputs can use defaults
        """
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        
        for input_name, input_def in spec.inputs.items():
            queue = self.input_queues[(node_id, input_name)]
            has_queued = len(queue) > 0
            is_connected = self._has_incoming_edge(node_id, input_name)
            has_default = input_def.default is not None
            
            if is_connected:
                if not has_queued:
                    return False
            else:
                if not has_queued and not has_default:
                    return False
        
        return True
    
    def _has_any_incoming_edge(self, node_id: str) -> bool:
        """Check if node has any incoming edges."""
        return self.graph.in_degree(node_id) > 0
    
    def _downstream_queues_empty(self, node_id: str) -> bool:
        """Check if all downstream queues from this node are empty."""
        for _, target_node, data in self.graph.out_edges(node_id, data=True):
            target_input = data.get("dst_input")
            if target_input:
                queue = self.input_queues.get((target_node, target_input))
                if queue and len(queue) > 0:
                    return False  # Queue has data, don't fire yet
        return True  # All downstream queues are empty
    
    def _is_ready(self, node_id: str) -> bool:
        """Check if a node is ready to fire."""
        if self.running[node_id] > 0:
            return False
        
        if self._is_trigger(node_id):
            return False
        
        # Nodes with no incoming edges (constants) fire when downstream queues are empty
        if not self._has_any_incoming_edge(node_id):
            if not self._downstream_queues_empty(node_id):
                return False
        
        return self._all_inputs_ready(node_id)
    
    def _get_ready_nodes(self) -> list[str]:
        """Get all nodes ready to fire."""
        return [n for n in self.graph.nodes if self._is_ready(n)]
    
    def _pop_inputs(self, node_id: str) -> dict[str, Any]:
        """Pop one value from each input queue."""
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
        """Notify all observers of an event."""
        for observer in self.observers:
            await observer(event_type, data)
    
    async def _route_output(self, node_id: str, branch: str, value: Any):
        """Route output to downstream nodes' input queues."""
        for target_node, target_input in get_downstream(self.graph, node_id, branch):
            self.input_queues[(target_node, target_input)].append(value)
            
            # If target is a UI component, notify UI to display the data
            if self._is_ui_component(target_node):
                await self._notify("ui_update", {
                    "node_id": target_node,
                    "input": target_input,
                    "value": value
                })
            
            # Legacy interface handling
            elif self._is_interface(target_node):
                spec: NodeSpec = self.graph.nodes[target_node]["spec"]
                chat_id = spec.inputs.get("chat_id", {})
                chat_id_value = chat_id.default if hasattr(chat_id, 'default') else "default"
                await self._notify("interface_display", {
                    "node_id": target_node,
                    "chat_id": chat_id_value,
                    "input": target_input,
                    "value": value
                })
    
    async def _run_node(self, node_id: str):
        """Execute a single node."""
        # running counter was already incremented by _schedule_ready
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        node_type = self._get_node_type(node_id)
        args = self._pop_inputs(node_id)
        
        await self._notify("node_start", {"node_id": node_id, "node_type": node_type})
        
        try:
            async for branch, value in spec.func(**args):
                await self._handle_output(node_id, node_type, branch, value)
        except Exception as e:
            tb = traceback.format_exc()
            print(f"[ERROR] Node {node_id}: {e}\n{tb}")
            await self._notify("node_error", {"node_id": node_id, "error": str(e)})
        finally:
            self.running[node_id] -= 1
            await self._notify("node_done", {"node_id": node_id})
            self._schedule_ready()
    
    async def _handle_output(self, node_id: str, node_type: str, branch: str, value: Any):
        """Handle node output - notify and route downstream."""
        if node_type in OUTPUT_TYPES:
            await self._notify("terminal_output", {"node_id": node_id, "value": value})
        
        if node_type in LOGGER_TYPES:
            await self._notify("log", {"node_id": node_id, "value": value})
        
        await self._notify("node_output", {"node_id": node_id, "branch": branch, "value": value})
        await self._route_output(node_id, branch, value)
        self._schedule_ready()
    
    def _schedule_ready(self):
        """Schedule all ready nodes for execution."""
        if self._task_group is None or self._stopped:
            return
        ready = self._get_ready_nodes()
        if ready:
            print(f"[DEBUG] Scheduling nodes: {ready}")
        for node_id in ready:
            # Increment running BEFORE starting the task to prevent double-scheduling
            self.running[node_id] += 1
            self._task_group.start_soon(self._run_node, node_id)
    
    async def fire_trigger(self, node_id: str, value: Any):
        """
        Fire a trigger node with a value.
        This is the main entry point for external events.
        """
        if not self._is_trigger(node_id):
            raise ValueError(f"Node {node_id} is not a trigger")
        
        if self._stopped:
            return
        
        spec: NodeSpec = self.graph.nodes[node_id]["spec"]
        node_type = self._get_node_type(node_id)
        
        self.running[node_id] += 1
        await self._notify("node_start", {"node_id": node_id, "node_type": node_type})
        
        try:
            async for branch, out_value in spec.func(value=value):
                await self._handle_output(node_id, node_type, branch, out_value)
        except Exception as e:
            tb = traceback.format_exc()
            print(f"[ERROR] Trigger {node_id}: {e}\n{tb}")
            await self._notify("node_error", {"node_id": node_id, "error": str(e)})
        finally:
            self.running[node_id] -= 1
            await self._notify("node_done", {"node_id": node_id})
    
    def get_triggers(self) -> list[str]:
        """Get all trigger node IDs in the graph."""
        return [n for n in self.graph.nodes if self._is_trigger(n)]
    
    def get_interfaces(self) -> list[str]:
        """Get all interface node IDs in the graph."""
        return [n for n in self.graph.nodes if self._is_interface(n)]
    
    async def run(self):
        """
        Start the executor and keep it running for trigger inputs.
        Triggers can fire at any time via fire_trigger().
        """
        self._init_queues()
        self._inject_inits()
        self._stopped = False
        
        # Notify frontend about available triggers
        triggers = self.get_triggers()
        for trigger_id in triggers:
            node_type = self._get_node_type(trigger_id)
            
            # UI component triggers
            if node_type in UI_COMPONENT_TYPES:
                await self._notify("ui_trigger_available", {
                    "node_id": trigger_id,
                    "node_type": node_type,
                })
            
            # Legacy interface nodes
            elif node_type in INTERFACE_TYPES:
                spec: NodeSpec = self.graph.nodes[trigger_id]["spec"]
                participants = []
                for p in spec.participants:
                    participants.append({
                        "id": p.id,
                        "name": p.name,
                        "can_send": p.can_send,
                        "can_receive": p.can_receive
                    })
                # Get chat_id from defaults
                chat_id = spec.inputs.get("chat_id", {})
                chat_id_value = chat_id.default if hasattr(chat_id, 'default') else "default"
                await self._notify("interface_available", {
                    "node_id": trigger_id,
                    "chat_id": chat_id_value,
                    "interface_type": spec.interface_type,
                    "participants": participants,
                    "inputs": list(spec.inputs.keys()),
                    "outputs": list(spec.outputs.keys()),
                })
            else:
                # Regular trigger
                await self._notify("trigger_available", {
                    "node_id": trigger_id, 
                    "input": "value",
                    "type": "int",
                    "trigger_type": "terminal"
                })
        
        async with anyio.create_task_group() as tg:
            self._task_group = tg
            self._schedule_ready()
            
            # Keep alive waiting for trigger inputs via websocket
            if triggers and self.input_handler:
                while not self._stopped:
                    # Wait for any trigger input
                    trigger_id, value = await self.input_handler()
                    if trigger_id and value is not None:
                        await self.fire_trigger(trigger_id, value)
    
    def stop(self):
        """Stop the executor."""
        self._stopped = True


