import { strict as assert } from "node:assert";
import test from "node:test";
import type { GPCPipelineGraph } from "../src/types/gpc";
import { useCanvasStore } from "../src/stores/gpc_stores";
import {
  applyTestEvent,
  buildActiveGraph,
  buildCompileRequest,
  createTestDeployState,
  parseCompilationResponse,
  type TestDeployState,
} from "../src/gpc/contracts";

const graph: GPCPipelineGraph = {
  pipeline_id: "pipeline_sales",
  tenant_id: "tenant_acme",
  nodes: [
    { id: "input", node_type: "input.intent", config: { source: "sales.csv" } },
    { id: "output", node_type: "output.result", config: {} },
  ],
  edges: [
    {
      id: "edge_1",
      source_node_id: "input",
      source_port_id: "out",
      target_node_id: "output",
      target_port_id: "in",
    },
  ],
};

test("graph identity survives canvas load and export", () => {
  useCanvasStore.getState().loadGraph(graph);
  const exported = useCanvasStore.getState().exportGraph();
  assert.equal(exported.pipeline_id, "pipeline_sales");
  assert.equal(exported.tenant_id, "tenant_acme");
  assert.deepEqual(exported.nodes, graph.nodes);
  assert.deepEqual(exported.edges, graph.edges);
});
test("active graph snapshot preserves identity and serializes the complete graph", () => {
  const active = buildActiveGraph({
    pipeline_id: graph.pipeline_id,
    tenant_id: graph.tenant_id,
    nodes: graph.nodes,
    edges: graph.edges,
  });
  assert.deepEqual(active, { ...graph, schema_version: "1.0" });
});

test("graph identity survives the compile request serialization", () => {
  const request = buildCompileRequest(graph);
  assert.equal(request.pipeline_id, "pipeline_sales");
  assert.equal(request.tenant_id, "tenant_acme");
  assert.deepEqual(request.graph, graph);
});

test("malformed compilation responses are rejected honestly", () => {
  assert.throws(() => parseCompilationResponse({ success: true }), /python_code/);
  assert.throws(
    () => parseCompilationResponse({ success: true, python_code: "def run(): pass", node_count: 0, execution_order: [], parallel_levels: [] }),
    /node_count/,
  );
});

test("empty graphs are not accepted as successful compilation results", () => {
  assert.throws(
    () => parseCompilationResponse({ success: true, python_code: "return {}", node_count: 0, execution_order: [], parallel_levels: [] }),
    /node_count must be greater than zero/,
  );
});

test("test/deploy state records success and failure without claiming deployment", () => {
  let state: TestDeployState = createTestDeployState();
  state = applyTestEvent(state, {
    event: "node_complete",
    node_id: "input",
    success: true,
    preview: { node_id: "input", rows: 2, columns: ["status"], sample: [["ok"]], timestamp: 1 },
  });
  assert.equal(state.results[0]?.status, "success");
  state = applyTestEvent(state, { event: "complete", success: true, message: "Test completed" });
  assert.equal(state.status, "ready_to_deploy");
  state = applyTestEvent(state, { event: "error", error: "sandbox failed" });
  assert.equal(state.status, "failure");
  assert.equal(state.error, "sandbox failed");
});
