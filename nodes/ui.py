"""
UI Component nodes - simple input/output nodes that connect to UI components.
For building complex graphs that interact with beautiful UI components.
"""

from core.node import node


# ===== CHAT COMPONENTS =====

@node(
    category="UI",
    node_type="ui_chat_input",
    outputs={"sent": bool}
)
async def chat_input(chat_id: str, message: str):
    """
    Send a message to a chat UI component.
    Connect this node to send messages to the chat interface.
    """
    if message and chat_id:
        # Import here to avoid circular imports
        from core.server import notify_clients

        # Send message to chat UI
        await notify_clients({
            "type": "ui_update",
            "data": {
                "chat_id": chat_id,
                "input": "bot_message",
                "value": message
            }
        })

        yield ("sent", True)


@node(
    category="UI",
    node_type="ui_chat_output",
    outputs={"message": str}
)
async def chat_output(chat_id: str, message: str = None):
    """
    Receive messages from a chat UI component.
    This node outputs messages when users send them from the chat interface.
    """
    if message:
        yield ("message", message)


# ===== BASIC INPUT COMPONENTS =====

@node(
    category="UI",
    node_type="ui_text_input",
    outputs={"value": str}
)
async def text_input(value: str = None, label: str = "Input", placeholder: str = "Type here..."):
    """
    Simple text input field.
    UI: Single line text input with label.
    """
    if value is not None:
        yield ("value", value)


@node(
    category="UI",
    node_type="ui_button",
    outputs={"clicked": bool}
)
async def button(value: bool = None, label: str = "Submit"):
    """
    Clickable button.
    UI: Button that fires when clicked.
    """
    if value is not None:
        yield ("clicked", True)


# ===== BASIC OUTPUT COMPONENTS =====

@node(
    category="UI",
    node_type="ui_text_display",
    outputs={}
)
async def text_display(content: str = "", label: str = "Output"):
    """
    Text display area.
    UI: Shows text/markdown content.
    """
    pass


@node(
    category="UI",
    node_type="ui_json_display",
    outputs={}
)
async def json_display(data: dict = None, label: str = "Data"):
    """
    JSON viewer.
    UI: Formatted, collapsible JSON tree.
    """
    pass
