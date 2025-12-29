"""
Basic example nodes demonstrating the graph system.

Each function returns tuples of (branch_name, value, kind)
- kind="DATA" feeds downstream nodes
- kind="EVENT" is for status updates only
"""

# ============ INPUT NODES ============

async def number_input(value: int):
    """Starting node - takes a number input from user."""
    yield ("status", f"Received input: {value}", "EVENT")
    yield ("out", value, "DATA")


async def text_input(value: str):
    """Starting node - takes text input from user."""
    yield ("out", value, "DATA")


# ============ MATH NODES ============

async def add(a: int, b: int):
    """Add two numbers."""
    result = a + b
    yield ("status", f"Adding {a} + {b}", "EVENT")
    yield ("result", result, "DATA")


async def multiply(a: int, b: int):
    """Multiply two numbers."""
    result = a * b
    yield ("result", result, "DATA")


async def double(value: int):
    """Double a number."""
    yield ("status", "Doubling...", "EVENT")
    yield ("result", value * 2, "DATA")


async def triple(value: int):
    """Triple a number."""
    yield ("status", "Tripling...", "EVENT")
    yield ("result", value * 3, "DATA")


async def square(value: int):
    """Square a number."""
    yield ("result", value * value, "DATA")


# ============ BRANCHING NODES ============

async def is_even(value: int):
    """Check if number is even - outputs to 'yes' or 'no' branch."""
    if value % 2 == 0:
        yield ("status", f"{value} is even", "EVENT")
        yield ("yes", value, "DATA")
    else:
        yield ("status", f"{value} is odd", "EVENT")
        yield ("no", value, "DATA")


async def is_positive(value: int):
    """Check if number is positive - outputs to 'positive' or 'negative' branch."""
    if value > 0:
        yield ("positive", value, "DATA")
    elif value < 0:
        yield ("negative", value, "DATA")
    else:
        yield ("zero", value, "DATA")


async def compare(a: int, b: int):
    """Compare two numbers - outputs to 'greater', 'less', or 'equal' branch."""
    if a > b:
        yield ("greater", a, "DATA")
    elif a < b:
        yield ("less", b, "DATA")
    else:
        yield ("equal", a, "DATA")


# ============ STRING NODES ============

async def to_string(value: int):
    """Convert number to string."""
    yield ("result", str(value), "DATA")


async def format_result(value: int):
    """Format a number as a nice result string."""
    yield ("result", f"Result: {value}", "DATA")


async def concat(a: str, b: str):
    """Concatenate two strings."""
    yield ("result", a + b, "DATA")


# ============ OUTPUT NODES ============

async def display(value: str):
    """Display output - this is a terminal node."""
    yield ("status", "Displaying result", "EVENT")
    yield ("output", value, "DATA")


async def display_number(value: int):
    """Display a number as output."""
    yield ("output", f"Final answer: {value}", "DATA")


# ============ UTILITY NODES ============

async def delay(value: int):
    """Pass through with a small delay (simulates processing)."""
    import asyncio
    yield ("status", "Processing...", "EVENT")
    await asyncio.sleep(0.5)
    yield ("status", "Done!", "EVENT")
    yield ("out", value, "DATA")


async def log(value: int):
    """Log a value and pass it through."""
    yield ("status", f"LOG: {value}", "EVENT")
    yield ("out", value, "DATA")

