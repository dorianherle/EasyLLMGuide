"""
Node specifications for the example nodes.
"""

from typing import Any
from core.spec_models import NodeSpec, InputDef, OutputDef
from examples import basic_nodes


EXAMPLE_NODES = [
    # ===== TRIGGERS =====
    NodeSpec(
        name="trigger",
        category="Triggers",
        inputs={"value": InputDef(type=int)},  # External event fires this
        outputs={"out": OutputDef(type=int)},
        func=basic_nodes.trigger
    ),
    NodeSpec(
        name="terminal_input",
        category="Triggers",
        inputs={"value": InputDef(type=int)},  # Entry point - user provides value
        outputs={"out": OutputDef(type=int)},
        func=basic_nodes.terminal_input
    ),
    
    # ===== OUTPUTS =====
    NodeSpec(
        name="terminal_output",
        category="Outputs",
        inputs={"value": InputDef(type=Any)},  # Accepts any type
        outputs={"done": OutputDef(type=str)},
        func=basic_nodes.terminal_output
    ),
    NodeSpec(
        name="logger",
        category="Outputs",
        inputs={"msg": InputDef(type=Any)},  # Accepts any type
        outputs={"logged": OutputDef(type=str)},
        func=basic_nodes.logger
    ),
    
    # ===== CONSTANTS =====
    NodeSpec(
        name="const_int",
        category="Constants",
        inputs={"value": InputDef(type=int, init=0)},  # init triggers once at start
        outputs={"out": OutputDef(type=int)},
        func=basic_nodes.const_int
    ),
    NodeSpec(
        name="const_str",
        category="Constants",
        inputs={"value": InputDef(type=str, init="")},  # init triggers once at start
        outputs={"out": OutputDef(type=str)},
        func=basic_nodes.const_str
    ),
    
    # ===== LOGIC & MATH =====
    NodeSpec(
        name="add",
        category="Logic",
        inputs={"a": InputDef(type=int), "b": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.add
    ),
    NodeSpec(
        name="multiply",
        category="Logic",
        inputs={"a": InputDef(type=int), "b": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.multiply
    ),
    NodeSpec(
        name="double",
        category="Logic",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.double
    ),
    NodeSpec(
        name="triple",
        category="Logic",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.triple
    ),
    NodeSpec(
        name="square",
        category="Logic",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.square
    ),
    NodeSpec(
        name="negate",
        category="Logic",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.negate
    ),
    NodeSpec(
        name="is_even",
        category="Logic",
        inputs={"value": InputDef(type=int)},
        outputs={"yes": OutputDef(type=int), "no": OutputDef(type=int)},
        func=basic_nodes.is_even
    ),
    NodeSpec(
        name="is_positive",
        category="Logic",
        inputs={"value": InputDef(type=int)},
        outputs={"positive": OutputDef(type=int), "negative": OutputDef(type=int), "zero": OutputDef(type=int)},
        func=basic_nodes.is_positive
    ),
    NodeSpec(
        name="compare",
        category="Logic",
        inputs={"a": InputDef(type=int), "b": InputDef(type=int)},
        outputs={"greater": OutputDef(type=int), "less": OutputDef(type=int), "equal": OutputDef(type=int)},
        func=basic_nodes.compare
    ),
    
    # ===== STRING =====
    NodeSpec(
        name="to_string",
        category="String",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=str)},
        func=basic_nodes.to_string
    ),
    NodeSpec(
        name="format_text",
        category="String",
        inputs={"template": InputDef(type=str, default="Value: {}"), "value": InputDef(type=int, default=0)},
        outputs={"result": OutputDef(type=str)},
        func=basic_nodes.format_text
    ),
    NodeSpec(
        name="concat",
        category="String",
        inputs={"a": InputDef(type=str), "b": InputDef(type=str)},
        outputs={"result": OutputDef(type=str)},
        func=basic_nodes.concat
    ),
    
    # ===== UTILITY =====
    NodeSpec(
        name="delay",
        category="Utility",
        inputs={"value": InputDef(type=int), "seconds": InputDef(type=float, default=0.5)},
        outputs={"out": OutputDef(type=int)},
        func=basic_nodes.delay
    ),
    NodeSpec(
        name="passthrough",
        category="Utility",
        inputs={"value": InputDef(type=int)},
        outputs={"out": OutputDef(type=int)},
        func=basic_nodes.passthrough
    ),
]
