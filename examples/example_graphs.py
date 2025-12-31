"""Example graph definitions for the UI."""

EXAMPLES = {
    "even_odd": {
        "name": "Even/Odd Flow",
        "nodes": [
            {"id": "in-1", "type": "custom", "position": {"x": 50, "y": 150}, "data": {"label": "terminal_input", "inputs": {"value": {"type": "int"}}, "outputs": {"out": {"type": "int"}}}},
            {"id": "check-1", "type": "custom", "position": {"x": 260, "y": 150}, "data": {"label": "is_even", "inputs": {"value": {"type": "int"}}, "outputs": {"yes": {"type": "int"}, "no": {"type": "int"}}}},
            {"id": "double-1", "type": "custom", "position": {"x": 480, "y": 50}, "data": {"label": "double", "inputs": {"value": {"type": "int"}}, "outputs": {"result": {"type": "int"}}}},
            {"id": "triple-1", "type": "custom", "position": {"x": 480, "y": 250}, "data": {"label": "triple", "inputs": {"value": {"type": "int"}}, "outputs": {"result": {"type": "int"}}}},
            {"id": "out-1", "type": "custom", "position": {"x": 700, "y": 150}, "data": {"label": "terminal_output", "inputs": {"value": {"type": "Any"}}, "outputs": {"done": {"type": "str"}}}}
        ],
        "edges": [
            {"id": "e1", "source": "in-1", "target": "check-1", "sourceHandle": "out", "targetHandle": "value"},
            {"id": "e2", "source": "check-1", "target": "double-1", "sourceHandle": "yes", "targetHandle": "value"},
            {"id": "e3", "source": "check-1", "target": "triple-1", "sourceHandle": "no", "targetHandle": "value"},
            {"id": "e4", "source": "double-1", "target": "out-1", "sourceHandle": "result", "targetHandle": "value"},
            {"id": "e5", "source": "triple-1", "target": "out-1", "sourceHandle": "result", "targetHandle": "value"}
        ]
    },
    "math_chain": {
        "name": "Math Chain + Logger",
        "nodes": [
            {"id": "in-1", "type": "custom", "position": {"x": 50, "y": 100}, "data": {"label": "terminal_input", "inputs": {"value": {"type": "int"}}, "outputs": {"out": {"type": "int"}}}},
            {"id": "sq-1", "type": "custom", "position": {"x": 250, "y": 100}, "data": {"label": "square", "inputs": {"value": {"type": "int"}}, "outputs": {"result": {"type": "int"}}}},
            {"id": "dbl-1", "type": "custom", "position": {"x": 450, "y": 100}, "data": {"label": "double", "inputs": {"value": {"type": "int"}}, "outputs": {"result": {"type": "int"}}}},
            {"id": "log-1", "type": "custom", "position": {"x": 450, "y": 220}, "data": {"label": "logger", "inputs": {"msg": {"type": "Any"}}, "outputs": {"logged": {"type": "str"}}}},
            {"id": "out-1", "type": "custom", "position": {"x": 650, "y": 100}, "data": {"label": "terminal_output", "inputs": {"value": {"type": "Any"}}, "outputs": {"done": {"type": "str"}}}}
        ],
        "edges": [
            {"id": "e1", "source": "in-1", "target": "sq-1", "sourceHandle": "out", "targetHandle": "value"},
            {"id": "e2", "source": "sq-1", "target": "dbl-1", "sourceHandle": "result", "targetHandle": "value"},
            {"id": "e3", "source": "sq-1", "target": "log-1", "sourceHandle": "result", "targetHandle": "msg"},
            {"id": "e4", "source": "dbl-1", "target": "out-1", "sourceHandle": "result", "targetHandle": "value"}
        ]
    },
    "branching": {
        "name": "Positive/Negative",
        "nodes": [
            {"id": "in-1", "type": "custom", "position": {"x": 50, "y": 150}, "data": {"label": "terminal_input", "inputs": {"value": {"type": "int"}}, "outputs": {"out": {"type": "int"}}}},
            {"id": "check-1", "type": "custom", "position": {"x": 260, "y": 150}, "data": {"label": "is_positive", "inputs": {"value": {"type": "int"}}, "outputs": {"positive": {"type": "int"}, "negative": {"type": "int"}, "zero": {"type": "int"}}}},
            {"id": "out-1", "type": "custom", "position": {"x": 500, "y": 150}, "data": {"label": "terminal_output", "inputs": {"value": {"type": "Any"}}, "outputs": {"done": {"type": "str"}}}}
        ],
        "edges": [
            {"id": "e1", "source": "in-1", "target": "check-1", "sourceHandle": "out", "targetHandle": "value"},
            {"id": "e2", "source": "check-1", "target": "out-1", "sourceHandle": "positive", "targetHandle": "value"},
            {"id": "e3", "source": "check-1", "target": "out-1", "sourceHandle": "negative", "targetHandle": "value"},
            {"id": "e4", "source": "check-1", "target": "out-1", "sourceHandle": "zero", "targetHandle": "value"}
        ]
    }
}

