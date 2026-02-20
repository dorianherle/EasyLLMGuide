# EasyLLMGuide

A visual node-based graph editor for building LLM-powered applications.

## Setup

```bash
pip install -r requirements.txt
cd ui && npm install
```

## Run

```bash
# Terminal 1: Backend
python -m core.server

# Terminal 2: Frontend
cd ui && npm run dev
```

## LLM Nodes

### gemini_chat
Call Gemini API with structured output support.

**Inputs:**
- `api_key` (str): Your Gemini API key
- `system_prompt` (str): System instructions
- `user_message` (str): User's message
- `schema` (str): JSON Schema for structured output (optional)

**Outputs:**
- `response` (str): Raw response text
- `parsed` (dict): Parsed JSON if schema was provided

**Example Schema:**
```json
{
  "type": "object",
  "properties": {
    "answer": {"type": "string"},
    "confidence": {"type": "number"}
  },
  "required": ["answer"]
}
```

### chat_trigger
Entry point for chat-based interactions.

**Inputs:**
- `message` (str): User message from chat UI

**Outputs:**
- `message` (str): Passes through the message