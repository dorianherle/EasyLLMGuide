"""
Decorator-based node registration system.
"""

import inspect
from typing import Any, get_type_hints
from core.spec_models import NodeSpec, InputDef, OutputDef, ParticipantDef

# Global registry
_registry: list[NodeSpec] = []


def node(
    category: str = "Other",
    outputs: dict = None,
    node_type: str = "",
    interface_type: str = "",
    participants: list = None,
):
    """
    Decorator to register an async generator as a node.
    
    Inputs are auto-extracted from function signature type hints.
    Outputs must be specified explicitly.
    
    Usage:
        @node(category="Math", outputs={"result": int})
        async def add(a: int, b: int):
            yield ("result", a + b)
    """
    def decorator(func):
        hints = get_type_hints(func) if hasattr(func, '__annotations__') else {}
        sig = inspect.signature(func)
        
        # Build inputs from function signature
        inputs = {}
        for name, param in sig.parameters.items():
            ptype = hints.get(name, Any)
            
            # Handle default values
            default = None
            init = None
            if param.default != inspect.Parameter.empty:
                default = param.default
            
            inputs[name] = InputDef(type=ptype, init=init, default=default)
        
        # Build outputs
        out = {}
        if outputs:
            for k, v in outputs.items():
                out[k] = OutputDef(type=v)
        
        # Build participants list if provided
        parts = []
        if participants:
            for p in participants:
                parts.append(ParticipantDef(**p))
        
        spec = NodeSpec(
            name=func.__name__,
            category=category,
            inputs=inputs,
            outputs=out,
            func=func,
            node_type=node_type or "",
            interface_type=interface_type,
            participants=parts,
        )
        
        _registry.append(spec)
        func._node_spec = spec
        return func
    
    return decorator


def get_all_nodes() -> list[NodeSpec]:
    """Return all registered nodes."""
    return _registry


def clear_registry():
    """Clear the registry (for testing)."""
    _registry.clear()
