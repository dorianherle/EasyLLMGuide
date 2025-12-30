"""
Node specifications for the example nodes.
Minimalist design - no EVENT, everything is DATA.
"""

from typing import Any
from core.spec_models import NodeSpec, InputDef, OutputDef
from examples import basic_nodes


EXAMPLE_NODES = [
    # ===== TERMINAL I/O =====
    NodeSpec(
        name="terminal_input",
        inputs={"value": InputDef(type=int)},  # Entry point - user provides value
        outputs={"out": OutputDef(type=int)},
        func=basic_nodes.terminal_input
    ),
    NodeSpec(
        name="terminal_output",
        inputs={"value": InputDef(type=Any)},  # Accepts any type
        outputs={"done": OutputDef(type=str)},
        func=basic_nodes.terminal_output
    ),
    
    # ===== CONSTANTS =====
    NodeSpec(
        name="const_int",
        inputs={"value": InputDef(type=int, init=0)},  # init triggers once at start
        outputs={"out": OutputDef(type=int)},
        func=basic_nodes.const_int
    ),
    NodeSpec(
        name="const_str",
        inputs={"value": InputDef(type=str, init="")},  # init triggers once at start
        outputs={"out": OutputDef(type=str)},
        func=basic_nodes.const_str
    ),
    
    # ===== LOGGER =====
    NodeSpec(
        name="logger",
        inputs={"msg": InputDef(type=Any)},  # Accepts any type
        outputs={"logged": OutputDef(type=str)},
        func=basic_nodes.logger
    ),
    
    # ===== MATH =====
    NodeSpec(
        name="add",
        inputs={"a": InputDef(type=int), "b": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.add
    ),
    NodeSpec(
        name="multiply",
        inputs={"a": InputDef(type=int), "b": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.multiply
    ),
    NodeSpec(
        name="double",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.double
    ),
    NodeSpec(
        name="triple",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.triple
    ),
    NodeSpec(
        name="square",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.square
    ),
    NodeSpec(
        name="negate",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.negate
    ),
    
    # ===== BRANCHING =====
    NodeSpec(
        name="is_even",
        inputs={"value": InputDef(type=int)},
        outputs={"yes": OutputDef(type=int), "no": OutputDef(type=int)},
        func=basic_nodes.is_even
    ),
    NodeSpec(
        name="is_positive",
        inputs={"value": InputDef(type=int)},
        outputs={"positive": OutputDef(type=int), "negative": OutputDef(type=int), "zero": OutputDef(type=int)},
        func=basic_nodes.is_positive
    ),
    NodeSpec(
        name="compare",
        inputs={"a": InputDef(type=int), "b": InputDef(type=int)},
        outputs={"greater": OutputDef(type=int), "less": OutputDef(type=int), "equal": OutputDef(type=int)},
        func=basic_nodes.compare
    ),
    
    # ===== STRING =====
    NodeSpec(
        name="to_string",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=str)},
        func=basic_nodes.to_string
    ),
    NodeSpec(
        name="format_text",
        inputs={"template": InputDef(type=str, default="Value: {}"), "value": InputDef(type=int, default=0)},
        outputs={"result": OutputDef(type=str)},
        func=basic_nodes.format_text
    ),
    NodeSpec(
        name="concat",
        inputs={"a": InputDef(type=str), "b": InputDef(type=str)},
        outputs={"result": OutputDef(type=str)},
        func=basic_nodes.concat
    ),
    
    # ===== UTILITY =====
    NodeSpec(
        name="delay",
        inputs={"value": InputDef(type=int), "seconds": InputDef(type=float, default=0.5)},
        outputs={"out": OutputDef(type=int)},
        func=basic_nodes.delay
    ),
    NodeSpec(
        name="passthrough",
        inputs={"value": InputDef(type=int)},
        outputs={"out": OutputDef(type=int)},
        func=basic_nodes.passthrough
    ),
]


def get_node_by_name(name: str) -> NodeSpec | None:
    for node in EXAMPLE_NODES:
        if node.name == name:
            return node
    return None
