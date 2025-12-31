from typing import Any, Callable, Type
from pydantic import BaseModel


class InputDef(BaseModel):
    type: Type
    init: Any | None = None
    default: Any | None = None

    class Config:
        arbitrary_types_allowed = True


class OutputDef(BaseModel):
    type: Type

    class Config:
        arbitrary_types_allowed = True


class NodeSpec(BaseModel):
    name: str
    node_type: str = ""  # The original type name (e.g. "double")
    category: str = "Other"  # UI category
    inputs: dict[str, InputDef]
    outputs: dict[str, OutputDef]
    func: Callable

    class Config:
        arbitrary_types_allowed = True


class EdgeSpec(BaseModel):
    source_node: str
    source_branch: str
    target_node: str
    target_input: str


# Canonical type constants (single source of truth)
TRIGGER_TYPES = {'terminal_input', 'trigger'}
OUTPUT_TYPES = {'terminal_output'}
LOGGER_TYPES = {'logger'}

