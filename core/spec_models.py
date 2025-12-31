from dataclasses import dataclass, field
from typing import Any, Callable, Type


@dataclass
class InputDef:
    type: Type
    init: Any = None
    default: Any = None


@dataclass
class OutputDef:
    type: Type


@dataclass
class NodeSpec:
    name: str
    inputs: dict[str, InputDef]
    outputs: dict[str, OutputDef]
    func: Callable
    node_type: str = ""
    category: str = "Other"


@dataclass
class EdgeSpec:
    source_node: str
    source_branch: str
    target_node: str
    target_input: str


# Canonical type constants
TRIGGER_TYPES = {'terminal_input', 'trigger'}
OUTPUT_TYPES = {'terminal_output'}
LOGGER_TYPES = {'logger'}
