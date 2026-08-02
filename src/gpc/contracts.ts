import type {
  ExecutionEvent,
  GPCPipelineGraph,
  PipelineCompilationResult,
  PreviewData,
} from "../types/gpc";

export type CanvasGraphSnapshot = Pick<GPCPipelineGraph, "pipeline_id" | "tenant_id" | "nodes" | "edges">;

export function buildActiveGraph(snapshot: CanvasGraphSnapshot): GPCPipelineGraph {
  return {
    pipeline_id: snapshot.pipeline_id,
    tenant_id: snapshot.tenant_id,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    schema_version: "1.0",
  };
}


export type GpcCompileRequest = {
  pipeline_id: string;
  tenant_id: string;
  graph: GPCPipelineGraph;
};

export function buildCompileRequest(graph: GPCPipelineGraph): GpcCompileRequest {
  if (!graph.pipeline_id.trim()) throw new Error("pipeline_id is required");
  if (!graph.tenant_id.trim()) throw new Error("tenant_id is required");
  if (graph.tenant_id === "default") throw new Error("authenticated tenant_id is required");
  if (graph.nodes.length === 0) throw new Error("graph must contain at least one node");
  return { pipeline_id: graph.pipeline_id, tenant_id: graph.tenant_id, graph };
}

export function parseCompilationResponse(payload: unknown): PipelineCompilationResult {
  if (!payload || typeof payload !== "object") throw new Error("Compilation response must be an object");
  const result = payload as Partial<PipelineCompilationResult>;
  if (result.success !== true) throw new Error("Compilation was not successful");
  if (typeof result.python_code !== "string" || result.python_code.trim().length === 0) {
    throw new Error("Compilation response is missing python_code");
  }
  if (!Number.isInteger(result.node_count) || result.node_count <= 0) {
    throw new Error("node_count must be greater than zero");
  }
  if (!Array.isArray(result.execution_order) || result.execution_order.length === 0) {
    throw new Error("Compilation response is missing execution_order");
  }
  if (!Array.isArray(result.parallel_levels)) {
    throw new Error("Compilation response is missing parallel_levels");
  }
  return result as PipelineCompilationResult;
}

export type TestDeployStatus = "idle" | "running" | "ready_to_deploy" | "failure";

export type TestDeployResult = {
  nodeId: string;
  status: "success" | "failure";
  preview?: PreviewData;
  error?: string;
};

export type TestDeployState = {
  status: TestDeployStatus;
  results: TestDeployResult[];
  error?: string;
};

export function createTestDeployState(): TestDeployState {
  return { status: "idle", results: [] };
}

export function applyTestEvent(state: TestDeployState, event: ExecutionEvent): TestDeployState {
  if (event.event === "start" || event.event === "node_start") {
    return { ...state, status: "running", error: undefined };
  }
  if (event.event === "node_complete" && event.node_id && event.preview) {
    return {
      ...state,
      status: "running",
      results: [...state.results, { nodeId: event.node_id, status: event.success === false ? "failure" : "success", preview: event.preview }],
    };
  }
  if (event.event === "complete" && event.success === true) {
    return { ...state, status: "ready_to_deploy", error: undefined };
  }
  if (event.event === "error" || event.success === false) {
    return { ...state, status: "failure", error: event.error || event.message || "GPC test failed" };
  }
  return state;
}
