"""
LLM-related node definitions for testing custom folder loading.
"""

from core.spec_models import NodeSpec, InputDef, OutputDef


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

