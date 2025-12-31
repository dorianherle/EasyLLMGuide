EasyLLMGuide – System Notes (for cleanup)

Purpose
- Visual editor builds a dataflow graph; backend executes it; optional export to plain Python.
- Keep contract simple: NodeSpec + EdgeSpec → graph → executor → events to UI.

Core data contracts
- NodeSpec: name, inputs{InputDef(type, init?, default?)}, outputs{OutputDef(type)}, func(async generator).
- EdgeSpec: source_node, source_branch, target_node, target_input.
- GraphDefinition (API): instances[{id,type}], edges[{source, sourceHandle, target, targetHandle}].
- Trigger nodes (terminal_input, trigger) are entry points; terminal_output/loggers are sinks/side-effects.

Runtime flow (backend)
- /graph builds NetworkX MultiDiGraph via build_graph(), attaches NodeSpec per node id, then validate_graph() for type mismatches, missing sources, and unstartered cycles.
- /run spawns run_executor() in background; executor drives events via ws_observer (node_start/done/output/error, terminal_output, log, run_complete/error).
- Executor: init queues per (node,input), injects init defaults (except triggers), schedules ready nodes (all connected inputs have data or defaults), routes outputs with get_downstream().
- Trigger handling: get_triggers() → notify input_needed → input_handler resolves pending_inputs → fire_trigger().
- Stopping: Executor.stop() sets flag; no cancel of running tasks today.

Export flow
- /export builds a DiGraph of instances/edges and emits a linear async workflow().
- Requires DAG; cycles return an error comment.
- Triggers become io.input calls; terminal_output becomes io.output; logger prints.

Frontend shape (ui/src)
- App.jsx orchestrates; FlowEditor.jsx hosts React Flow graph; NodeLibrary.jsx is palette; CodePanel.jsx shows node source; LogPanel/RunPanel display events; api.js wraps HTTP+WS.
- Ports colored via typeColors.js; edges deleted with CustomEdge; subgraphs handled by SubgraphNode + NameDialog + ContextMenu.

Extension points
- New node: add async generator in examples/basic_nodes.py and NodeSpec entry in examples/node_specs.py.
- New IO surface for exported workflows: subclass IOAdapter (see core/io_adapter.py) or use DictIO/ConsoleIO/CallbackIO.
- New server-side node types can reuse existing InputDef defaults/init semantics; keep funcs async generators yielding (branch, value).

APIs (concise)
- GET /nodes → list of types with visible (non-init) inputs, outputs, source code.
- POST /graph → {status, errors[]} after validation; also updates current_graph/current_instances.
- POST /run → starts execution; progress/events over WS /ws/events.
- POST /export → {code} string for standalone workflow.
- WS /ws/events: inbound input_response{node_id,value}; outbound input_needed, terminal_output, log, node_start/done/output/error, run_complete/run_error.

Invariants to keep lean
- Node func name == logical type; executor infers type via spec.func.__name__.
- Inputs with init fire once on start (except triggers). Defaults only used when no edge.
- Multiple inbound edges allowed but queues consume one per firing.
- Type Any skips validation mismatches.

Quick bloat-scan checklist (next pass)
- Duplicate state: current_graph/current_instances/pending_inputs versus executor; narrow if possible.
- Recompute-heavy calls: /nodes regenerates inspect.getsource each time.
- Error handling: broad excepts in ws_observer, websocket loop may hide failures.
- Exporter prints log inline; consider aligning with logger node contract.
- Frontend panels/styles: check App.css for unused styles, React components for dead props/handlers.


