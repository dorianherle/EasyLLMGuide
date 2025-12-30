# EasyLLMGuide Documentation

A visual node-based graph execution system.

---

## Quick Start

**Backend:**
```bash
python -m uvicorn core.server:app --reload --port 8000
```

**Frontend:**
```bash
cd ui
npm run dev
```

---

## Node System

### Triggers
Entry points for execution.
- **trigger**: Generic external event receiver.
- **terminal_input**: Specific type of trigger that prompts for user input via CLI/UI.

### Logic & Math
Processors that transform data.
- **add, multiply**: Basic arithmetic.
- **is_even, is_positive**: Branching logic.

### Outputs
Sinks for results.
- **terminal_output**: Prints result to UI console.
- **logger**: Appends to the Log Panel.

---

## How It Works (Behind the Scenes)

### 1. The Graph (`core/graph_topology.py`)
When you save a flow, the frontend sends a JSON definition. The backend converts this into a **NetworkX MultiDiGraph**. 
- **Nodes** store their static spec (inputs/outputs) and runtime type.
- **Edges** map a source output ("result") to a target input ("value").
- - The graph is validated for type safety (e.g., preventing a `str` output connecting to an `int` input).

### 2. The Execution Engine (`core/executor.py`)
The system uses a **push-based dataflow** model managed by an `Executor` class.

1.  **Initialization**:
    -   Input queues (deques) are created for every input port of every node.
    -   `init` values (constants) are pre-filled into these queues.

2.  **Triggering**:
    -   The system waits for a **Trigger Node** (like `terminal_input`) to fire.
    -   When fired, the trigger produces a value on its output branch.

3.  **Propagation Loop**:
    -   **Routing**: The executor looks up downstream connections via `get_downstream()` and pushes the value into the target nodes' input queues.
    -   **Readiness Check**: The executor checks if any node is "ready". A node is ready when **all** its connected input queues have at least one item.
    -   **Scheduling**: Ready nodes are submitted to an `anyio.TaskGroup` to run concurrently.

4.  **Node Execution**:
    -   The node's async function (e.g., `double(value)`) is called with arguments popped from the queues.
    -   The function yields a `(branch, value)` tuple.
    -   This output is routed downstream, and the loop repeats until no nodes are ready.

### 3. Frontend-Backend Bridge (`core/server.py`)
Communication happens via **WebSockets**:
-   **Events**: The executor emits events (`node_start`, `node_output`, `log`) which are JSON-serialized and pushed to the UI.
-   **Input Requests**: If a `terminal_input` node runs, it pauses execution and sends an `input_needed` event. The UI shows a prompt, and the user's response is sent back to resume the graph.

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for deeper design notes and guidelines.

### Adding Nodes
Define a `NodeSpec` in `examples/node_specs.py` with a `category` (e.g., "Triggers", "Logic").
The UI automatically groups nodes based on this category.
