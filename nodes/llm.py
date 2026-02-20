"""
LLM-related nodes.
"""

from core.node import node


@node(category="LLM", outputs={"response": str, "parsed": dict})
async def gemini_chat(api_key: str = "YOUR_API_KEY", system_prompt: str = "You are a helpful assistant.", user_message: str = "", schema: str = ""):
    """Call Gemini API with structured output support."""
    import json
    from google import genai
    
    client = genai.Client(api_key=api_key)
    
    full_prompt = f"{system_prompt}\n\nUser: {user_message}"
    
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
    
    parsed = None
    if schema:
        try:
            parsed = json.loads(text)
        except:
            pass
    
    yield ("response", text)
    if parsed is not None:
        yield ("parsed", parsed)


@node(category="LLM", outputs={"response": str})
async def echo(message: str = ""):
    """Simple echo - returns the message back. Good for testing."""
    yield ("response", f"Echo: {message}")


@node(category="Constants", outputs={"text": str})
async def text_constant(value: str = "Hello world"):
    """Output a constant text value."""
    yield ("text", value)


@node(category="Constants", outputs={"schema": str})
async def json_schema_constant(value: str = '{"type": "object", "properties": {"answer": {"type": "string"}, "confidence": {"type": "number"}}, "required": ["answer", "confidence"]}'):
    """Output a JSON schema. Default: {answer: string, confidence: number}"""
    yield ("schema", value)


# ===== INTERFACE =====

@node(
    category="Interface",
    node_type="interface_chat",
    interface_type="chat",
    participants=[
        {"id": "sender", "name": "Sender", "can_send": True, "can_receive": False},
        {"id": "receiver", "name": "Receiver", "can_send": False, "can_receive": True},
    ],
    outputs={"out": str}
)
async def chat(chat_id: str = "default", display: str = None, value: str = None):
    """Chat interface - send messages in, display messages out."""
    if value is not None:
        yield ("out", value)
    if display is not None:
        yield ("displayed", display)
