"""
IO Adapter pattern for exported workflows.
Implement input() and output() methods to connect workflows to any UI.
"""

from typing import Any, Type


class DictIO:
    """Dict-based IO for testing. Inputs provided upfront, outputs collected."""
    
    def __init__(self, inputs: dict):
        self.inputs = inputs
        self.outputs = {}
    
    async def input(self, name: str, type_hint: Type) -> Any:
        if name not in self.inputs:
            raise KeyError(f"Input '{name}' not provided")
        return self.inputs[name]
    
    async def output(self, name: str, value: Any) -> None:
        self.outputs[name] = value


class ConsoleIO:
    """Console-based IO for CLI applications."""
    
    async def input(self, name: str, type_hint: Type) -> Any:
        prompt = f"{name} ({type_hint.__name__}): "
        raw = input(prompt)
        
        if type_hint == int:
            return int(raw)
        elif type_hint == float:
            return float(raw)
        elif type_hint == bool:
            return raw.lower() in ('true', 'yes', '1', 'y')
        return raw
    
    async def output(self, name: str, value: Any) -> None:
        print(f"→ {name}: {value}")


class CallbackIO:
    """Callback-based IO for custom integrations."""
    
    def __init__(self, on_input, on_output):
        self.input = on_input
        self.output = on_output
