from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


async def rich_observer(event_type: str, data: dict):
    if event_type == "node_start":
        console.print(f"[bold blue]▶ START[/] {data['node_id']}")
    
    elif event_type == "node_yield_event":
        console.print(f"  [dim]EVENT[/] {data['node_id']}.{data['branch']}: {data['value']}")
    
    elif event_type == "node_yield_data":
        console.print(f"  [green]DATA[/] {data['node_id']}.{data['branch']}")
    
    elif event_type == "node_done":
        console.print(f"[bold green]✓ DONE[/] {data['node_id']}")
    
    elif event_type == "node_error":
        console.print(f"[bold red]✗ ERROR[/] {data['node_id']}: {data.get('error', 'unknown')}")


def print_graph_status(running: dict[str, int], queues: dict):
    table = Table(title="Graph Status")
    table.add_column("Node")
    table.add_column("Running")
    table.add_column("Queued Inputs")
    
    for node_id, count in running.items():
        queue_info = []
        for (nid, inp), q in queues.items():
            if nid == node_id and len(q) > 0:
                queue_info.append(f"{inp}:{len(q)}")
        table.add_row(node_id, str(count), ", ".join(queue_info) or "-")
    
    console.print(table)

