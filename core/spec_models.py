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
class ParticipantDef:
    """A participant in an interface (e.g., User, Bot in chat)."""
    id: str
    name: str
    can_send: bool = True    # Has output capability (triggers when they "speak")
    can_receive: bool = True  # Has input capability (displays messages to them)


@dataclass
class NodeSpec:
    name: str
    inputs: dict[str, InputDef]
    outputs: dict[str, OutputDef]
    func: Callable
    node_type: str = ""
    category: str = "Other"
    # Interface config for UI-backed nodes
    interface_type: str = ""  # "chat", "form", etc.
    participants: list = field(default_factory=list)


@dataclass
class EdgeSpec:
    source_node: str
    source_branch: str
    target_node: str
    target_input: str


# Canonical type constants
TRIGGER_TYPES = {'terminal_input', 'trigger', 'chat_trigger', 'interface_chat', 
                 'ui_chat_input', 'ui_chat_full', 'ui_text_input', 'ui_button'}
OUTPUT_TYPES = {'terminal_output'}
LOGGER_TYPES = {'logger'}
INTERFACE_TYPES = {'interface_chat'}

# UI Component types - these render on the App canvas
UI_COMPONENT_TYPES = {
    'ui_chat_input', 'ui_chat_display', 'ui_chat_full',
    'ui_text_input', 'ui_button', 'ui_text_display', 'ui_json_display'
}