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
    },
    "simple_chatbot": {
        "name": "Simple Chatbot",
        "nodes": [
            {"id": "api-key-1", "type": "custom", "position": {"x": 50, "y": 100}, "data": {"label": "text_input", "inputs": {"value": {"type": "str"}}, "outputs": {"text": {"type": "str"}}}},
            {"id": "system-1", "type": "custom", "position": {"x": 50, "y": 200}, "data": {"label": "text_input", "inputs": {"value": {"type": "str"}}, "outputs": {"text": {"type": "str"}}}},
            {"id": "chat-1", "type": "custom", "position": {"x": 50, "y": 350}, "data": {"label": "chat", "inputs": {"display": {"type": "str"}}, "outputs": {"out": {"type": "str"}}}},
            {"id": "gemini-1", "type": "custom", "position": {"x": 350, "y": 200}, "data": {"label": "gemini_chat", "inputs": {"api_key": {"type": "str"}, "system_prompt": {"type": "str"}, "user_message": {"type": "str"}, "schema": {"type": "str"}}, "outputs": {"response": {"type": "str"}, "parsed": {"type": "dict"}}}}
        ],
        "edges": [
            {"id": "e1", "source": "api-key-1", "target": "gemini-1", "sourceHandle": "text", "targetHandle": "api_key"},
            {"id": "e2", "source": "system-1", "target": "gemini-1", "sourceHandle": "text", "targetHandle": "system_prompt"},
            {"id": "e3", "source": "chat-1", "target": "gemini-1", "sourceHandle": "out", "targetHandle": "user_message"},
            {"id": "e4", "source": "gemini-1", "target": "chat-1", "sourceHandle": "response", "targetHandle": "display"}
        ]
    },
    "ui_echo_bot": {
        "name": "UI Echo Bot",
        "nodes": [
            {"id": "chat_box_1", "type": "custom", "position": {"x": 50, "y": 100}, "data": {"label": "chat_box", "nodeType": "ui_chat_full", "inputs": {"value": {"type": "str"}, "bot_response": {"type": "str"}}, "outputs": {"user_message": {"type": "str"}}}},
            {"id": "echo_1", "type": "custom", "position": {"x": 350, "y": 100}, "data": {"label": "echo", "inputs": {"message": {"type": "str"}}, "outputs": {"response": {"type": "str"}}}}
        ],
        "edges": [
            {"id": "e1", "source": "chat_box_1", "target": "echo_1", "sourceHandle": "user_message", "targetHandle": "message"},
            {"id": "e2", "source": "echo_1", "target": "chat_box_1", "sourceHandle": "response", "targetHandle": "bot_response"}
        ]
    }
}


