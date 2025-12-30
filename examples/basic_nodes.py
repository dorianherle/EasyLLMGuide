"""
Basic example nodes for the graph system.
Minimalist design - all yields are just (branch, value).
"""

# ============ TERMINAL I/O NODES ============

async def terminal_input(value: int):
    """
    Terminal INPUT - Entry point for user input.
    User provides value in the terminal when running.
    """
    yield ("out", value)


async def terminal_output(value):
    """
    Terminal OUTPUT - Displays any value in terminal.
    Accepts any type, converts to string.
    """
    yield ("done", str(value))


# ============ CONSTANTS ============

async def const_int(value: int = 0):
    """Integer constant - set a fixed value."""
    yield ("out", value)


async def const_str(value: str = ""):
    """String constant - set a fixed text."""
    yield ("out", value)


# ============ LOGGER NODE ============

async def logger(msg):
    """Logger node - sends any value to log panel."""
    yield ("logged", str(msg))


# ============ MATH NODES ============

async def add(a: int, b: int):
    """Add two numbers."""
    yield ("result", a + b)


async def multiply(a: int, b: int):
    """Multiply two numbers."""
    yield ("result", a * b)


async def double(value: int):
    """Double a number."""
    yield ("result", value * 2)


async def triple(value: int):
    """Triple a number."""
    yield ("result", value * 3)


async def square(value: int):
    """Square a number."""
    yield ("result", value * value)


async def negate(value: int):
    """Negate a number."""
    yield ("result", -value)


# ============ BRANCHING NODES ============

async def is_even(value: int):
    """Check if number is even - outputs to 'yes' or 'no' branch."""
    if value % 2 == 0:
        yield ("yes", value)
    else:
        yield ("no", value)


async def is_positive(value: int):
    """Check if number is positive."""
    if value > 0:
        yield ("positive", value)
    elif value < 0:
        yield ("negative", value)
    else:
        yield ("zero", value)


async def compare(a: int, b: int):
    """Compare two numbers."""
    if a > b:
        yield ("greater", a)
    elif a < b:
        yield ("less", b)
    else:
        yield ("equal", a)


# ============ STRING NODES ============

async def to_string(value: int):
    """Convert number to string."""
    yield ("result", str(value))


async def format_text(template: str = "Value: {}", value: int = 0):
    """Format a string with a value."""
    yield ("result", template.format(value))


async def concat(a: str, b: str):
    """Concatenate two strings."""
    yield ("result", a + b)


# ============ UTILITY NODES ============

async def delay(value: int, seconds: float = 0.5):
    """Pass through with a delay."""
    import asyncio
    await asyncio.sleep(seconds)
    yield ("out", value)


async def passthrough(value: int):
    """Pass value through unchanged."""
    yield ("out", value)
