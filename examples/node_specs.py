"""
Node specifications for the example nodes.
These define the inputs, outputs, and types for each node.
"""

from core.spec_models import NodeSpec, InputDef, OutputDef
from examples import basic_nodes


EXAMPLE_NODES = [
    # Input nodes
    NodeSpec(
        name="number_input",
        inputs={"value": InputDef(type=int)},
        outputs={"out": OutputDef(type=int), "status": OutputDef(type=str)},
        func=basic_nodes.number_input
    ),
    NodeSpec(
        name="text_input",
        inputs={"value": InputDef(type=str)},
        outputs={"out": OutputDef(type=str)},
        func=basic_nodes.text_input
    ),
    
    # Math nodes
    NodeSpec(
        name="add",
        inputs={"a": InputDef(type=int), "b": InputDef(type=int)},
        outputs={"result": OutputDef(type=int), "status": OutputDef(type=str)},
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
        outputs={"result": OutputDef(type=int), "status": OutputDef(type=str)},
        func=basic_nodes.double
    ),
    NodeSpec(
        name="triple",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int), "status": OutputDef(type=str)},
        func=basic_nodes.triple
    ),
    NodeSpec(
        name="square",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=int)},
        func=basic_nodes.square
    ),
    
    # Branching nodes
    NodeSpec(
        name="is_even",
        inputs={"value": InputDef(type=int)},
        outputs={"yes": OutputDef(type=int), "no": OutputDef(type=int), "status": OutputDef(type=str)},
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
    
    # String nodes
    NodeSpec(
        name="to_string",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=str)},
        func=basic_nodes.to_string
    ),
    NodeSpec(
        name="format_result",
        inputs={"value": InputDef(type=int)},
        outputs={"result": OutputDef(type=str)},
        func=basic_nodes.format_result
    ),
    NodeSpec(
        name="concat",
        inputs={"a": InputDef(type=str), "b": InputDef(type=str)},
        outputs={"result": OutputDef(type=str)},
        func=basic_nodes.concat
    ),
    
    # Output nodes
    NodeSpec(
        name="display",
        inputs={"value": InputDef(type=str)},
        outputs={"output": OutputDef(type=str), "status": OutputDef(type=str)},
        func=basic_nodes.display
    ),
    NodeSpec(
        name="display_number",
        inputs={"value": InputDef(type=int)},
        outputs={"output": OutputDef(type=str)},
        func=basic_nodes.display_number
    ),
    
    # Utility nodes
    NodeSpec(
        name="delay",
        inputs={"value": InputDef(type=int)},
        outputs={"out": OutputDef(type=int), "status": OutputDef(type=str)},
        func=basic_nodes.delay
    ),
    NodeSpec(
        name="log",
        inputs={"value": InputDef(type=int)},
        outputs={"out": OutputDef(type=int), "status": OutputDef(type=str)},
        func=basic_nodes.log
    ),
]


def get_node_by_name(name: str) -> NodeSpec | None:
    for node in EXAMPLE_NODES:
        if node.name == name:
            return node
    return None

