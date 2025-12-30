"""
IO Adapter pattern for exported workflows.
Developers implement these methods to connect workflows to any UI.
"""

from typing import Any, Type
from abc import ABC, abstractmethod


class IOAdapter(ABC):
    """
    Base class for workflow IO.
    Implement input() and output() to connect to any UI framework.
    """
    
    @abstractmethod
    async def input(self, name: str, type_hint: Type) -> Any:
        """
        Request input from user/system.
        
        Args:
            name: Name of the input (e.g., "photo", "value")
            type_hint: Expected type (int, str, Image, etc.)
        
        Returns:
            The input value
        """
        pass
    
    @abstractmethod
    async def output(self, name: str, value: Any) -> None:
        """
        Send output to user/system.
        
        Args:
            name: Name of the output (e.g., "result", "preview")
            value: The value to output
        """
        pass


class DictIO(IOAdapter):
    """
    Simple dict-based IO for testing and batch processing.
    All inputs provided upfront, outputs collected in dict.
    """
    
    def __init__(self, inputs: dict):
        self.inputs = inputs
        self.outputs = {}
    
    async def input(self, name: str, type_hint: Type) -> Any:
        if name not in self.inputs:
            raise KeyError(f"Input '{name}' not provided")
        return self.inputs[name]
    
    async def output(self, name: str, value: Any) -> None:
        self.outputs[name] = value


class ConsoleIO(IOAdapter):
    """
    Console-based IO for CLI applications.
    """
    
    async def input(self, name: str, type_hint: Type) -> Any:
        prompt = f"{name} ({type_hint.__name__}): "
        raw = input(prompt)
        
        if type_hint == int:
            return int(raw)
        elif type_hint == float:
            return float(raw)
        elif type_hint == bool:
            return raw.lower() in ('true', 'yes', '1', 'y')
        else:
            return raw
    
    async def output(self, name: str, value: Any) -> None:
        print(f"→ {name}: {value}")


class CallbackIO(IOAdapter):
    """
    Callback-based IO for custom integrations.
    """
    
    def __init__(self, on_input, on_output):
        self._on_input = on_input
        self._on_output = on_output
    
    async def input(self, name: str, type_hint: Type) -> Any:
        return await self._on_input(name, type_hint)
    
    async def output(self, name: str, value: Any) -> None:
        await self._on_output(name, value)

