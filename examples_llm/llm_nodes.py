"""
LLM-related node definitions for testing custom folder loading.
"""

from core.spec_models import NodeSpec, InputDef, OutputDef
import os


def gemini_chat(api_key: str, system_prompt: str, user_message: str, schema: str) -> dict:
    """Call Gemini API with structured output support."""
    import json
    from google import genai
    
    client = genai.Client(api_key=api_key)
    
    # Build the prompt
    full_prompt = f"{system_prompt}\n\nUser: {user_message}"
    
    # Build config
    config = {}
    if schema:
        schema_dict = json.loads(schema)
        config["response_mime_type"] = "application/json"
        config["response_json_schema"] = schema_dict
    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=full_prompt,
        config=config if config else None
    )
    
    text = response.text
    
    # Parse JSON if schema was given
    parsed = None
    if schema:
        try:
            parsed = json.loads(text)
        except:
            pass
    
    return {"response": text, "parsed": parsed}


async def chat_node(chat_id: str, message: str = None):
    """
    Simple chat node - connects to a chat UI component.
    - Input: message (send to UI) and chat_id parameter
    - Output: user_message (receive from UI)
    """
    if message:
        # Send message to chat UI
        from core.server import notify_clients
        await notify_clients({
            "type": "ui_update",
            "data": {
                "chat_id": chat_id,
                "input": "bot_message",
                "value": message
            }
        })
        yield ("sent", True)

    # Always output the message (whether from graph input or external trigger)
    yield ("user_message", message or "")


def prompt_template(template: str, variables: str) -> dict:
    """Fill a prompt template with variables."""
    import json
    vars_dict = json.loads(variables) if variables else {}
    result = template
    for k, v in vars_dict.items():
        result = result.replace(f"{{{k}}}", str(v))
    return {"filled": result}


def token_counter(text: str) -> dict:
    """Roughly count tokens in text (approx 4 chars per token)."""
    count = len(text) // 4
    return {"count": count}


def text_splitter(text: str, chunk_size: int) -> dict:
    """Split text into chunks."""
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunks.append(text[i:i + chunk_size])
    return {"chunks": chunks, "count": len(chunks)}


def json_parser(text: str) -> dict:
    """Parse JSON from text."""
    import json
    try:
        parsed = json.loads(text)
        return {"data": parsed, "valid": True}
    except:
        return {"data": None, "valid": False}


def text_joiner(texts: list, separator: str) -> dict:
    """Join multiple texts with separator."""
    result = separator.join(str(t) for t in texts)
    return {"joined": result}


NODES = [
    NodeSpec(
        name="gemini_chat",
        category="LLM",
        inputs={
            "api_key": InputDef(type=str),
            "system_prompt": InputDef(type=str),
            "user_message": InputDef(type=str),
            "schema": InputDef(type=str, default=""),
        },
        outputs={
            "response": OutputDef(type=str),
            "parsed": OutputDef(type=dict),
        },
        func=gemini_chat,
    ),
    NodeSpec(
        name="chat",
        category="UI",
        inputs={
            "chat_id": InputDef(type=str),
            "message": InputDef(type=str),
        },
        outputs={
            "user_message": OutputDef(type=str),
        },
        func=chat_node,
        interface_type="ui",
    ),
    NodeSpec(
        name="prompt_template",
        category="LLM",
        inputs={
            "template": InputDef(type=str),
            "variables": InputDef(type=str),
        },
        outputs={
            "filled": OutputDef(type=str),
        },
        func=prompt_template,
    ),
    NodeSpec(
        name="token_counter",
        category="LLM",
        inputs={
            "text": InputDef(type=str),
        },
        outputs={
            "count": OutputDef(type=int),
        },
        func=token_counter,
    ),
    NodeSpec(
        name="text_splitter",
        category="LLM",
        inputs={
            "text": InputDef(type=str),
            "chunk_size": InputDef(type=int),
        },
        outputs={
            "chunks": OutputDef(type=list),
            "count": OutputDef(type=int),
        },
        func=text_splitter,
    ),
    NodeSpec(
        name="json_parser",
        category="LLM",
        inputs={
            "text": InputDef(type=str),
        },
        outputs={
            "data": OutputDef(type=dict),
            "valid": OutputDef(type=bool),
        },
        func=json_parser,
    ),
    NodeSpec(
        name="text_joiner",
        category="LLM",
        inputs={
            "texts": InputDef(type=list),
            "separator": InputDef(type=str),
        },
        outputs={
            "joined": OutputDef(type=str),
        },
        func=text_joiner,
    ),
]

