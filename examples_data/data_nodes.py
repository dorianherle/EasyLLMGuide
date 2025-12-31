"""
Data processing node definitions for testing custom folder loading.
"""

from core.spec_models import NodeSpec, InputDef, OutputDef


def filter_list(items: list, condition: str) -> dict:
    """Filter list items based on condition (gt, lt, eq followed by number)."""
    op = condition[:2]
    val = int(condition[2:])
    if op == "gt":
        result = [x for x in items if x > val]
    elif op == "lt":
        result = [x for x in items if x < val]
    elif op == "eq":
        result = [x for x in items if x == val]
    else:
        result = items
    return {"filtered": result}


def map_multiply(items: list, factor: int) -> dict:
    """Multiply each item in list by factor."""
    result = [x * factor for x in items]
    return {"mapped": result}


def reduce_sum(items: list) -> dict:
    """Sum all items in list."""
    total = sum(items)
    return {"sum": total}


def sort_list(items: list, descending: bool) -> dict:
    """Sort list ascending or descending."""
    result = sorted(items, reverse=descending)
    return {"sorted": result}


def unique_values(items: list) -> dict:
    """Get unique values from list."""
    seen = []
    for x in items:
        if x not in seen:
            seen.append(x)
    return {"unique": seen, "count": len(seen)}


def range_generator(start: int, end: int) -> dict:
    """Generate a range of numbers."""
    result = list(range(start, end))
    return {"range": result}


NODES = [
    NodeSpec(
        name="filter_list",
        category="Data",
        inputs={
            "items": InputDef(type=list),
            "condition": InputDef(type=str),
        },
        outputs={
            "filtered": OutputDef(type=list),
        },
        func=filter_list,
    ),
    NodeSpec(
        name="map_multiply",
        category="Data",
        inputs={
            "items": InputDef(type=list),
            "factor": InputDef(type=int),
        },
        outputs={
            "mapped": OutputDef(type=list),
        },
        func=map_multiply,
    ),
    NodeSpec(
        name="reduce_sum",
        category="Data",
        inputs={
            "items": InputDef(type=list),
        },
        outputs={
            "sum": OutputDef(type=int),
        },
        func=reduce_sum,
    ),
    NodeSpec(
        name="sort_list",
        category="Data",
        inputs={
            "items": InputDef(type=list),
            "descending": InputDef(type=bool),
        },
        outputs={
            "sorted": OutputDef(type=list),
        },
        func=sort_list,
    ),
    NodeSpec(
        name="unique_values",
        category="Data",
        inputs={
            "items": InputDef(type=list),
        },
        outputs={
            "unique": OutputDef(type=list),
            "count": OutputDef(type=int),
        },
        func=unique_values,
    ),
    NodeSpec(
        name="range_generator",
        category="Data",
        inputs={
            "start": InputDef(type=int),
            "end": InputDef(type=int),
        },
        outputs={
            "range": OutputDef(type=list),
        },
        func=range_generator,
    ),
]

