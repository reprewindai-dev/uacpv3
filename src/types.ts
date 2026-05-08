export type SurfaceId = "deterministic-engine" | "sunnyvale" | "silicon-valley" | "archives";

export type PlanStatus = "draft" | "review" | "approved" | "active" | "completed";
export type RunStatus = "queued" | "executing" | "completed" | "blocked" | "failed";
export type SkillStatus = "approved" | "review" | "quarantined";
export type RiskTier = "low" | "medium" | "high" | "critical";
export type VoteDirection = "approve" | "challenge" | "veto";

export interface PlanNode {
  id: string;
  label: string;
  stage: "intent" | "reasoning" | "governance" | "execution" | "evidence" | "continuity";
  ownerCommitteeId: string;
  pillarIds: string[];
  summary: string;
  latencyMs: number;
}

export interface PlanEdge {
  from: string;
  to: string;
}

export interface CommitteeVote {
  member: string;
  model: string;
  vote: VoteDirection;
  rationale: string;
}

export interface InstitutionalPlan {
  id: string;
  title: string;
  intent: string;
  objective: string;
  pricingModel: string;
  payingUser: string;
  status: PlanStatus;
  revision: number;
  riskTier: RiskTier;
  pillars: string[];
  committeeIds: string[];
  graph: {
    nodes: PlanNode[];
    edges: PlanEdge[];
  };
  votes: CommitteeVote[];
  guardrails: string[];
  successMetrics: string[];
  createdAt: string;
}

export interface GovernedRun {
  id: string;
  planId: string;
  status: RunStatus;
  currentStage: string;
  progress: number;
  approvals: number;
  evidenceCount: number;
  startedAt: string;
  completedAt?: string;
  output?: string;
}

export interface EventItem {
  id: string;
  type: string;
  timestamp: string;
  message: string;
  surface: SurfaceId;
  metadata?: Record<string, unknown>;
}

export interface Pillar {
  id: string;
  name: string;
  mandate: string;
  kpi: string;
}

export interface Committee {
  id: string;
  name: string;
  purpose: string;
  authority: string;
  chair: string;
  members: string[];
  escalation: string;
  allowedActions: string[];
  vetoConditions: string[];
  pillarIds: string[];
}

export interface SkillArtifact {
  id: string;
  name: string;
  category: string;
  description: string;
  allowedTools: string[];
  source: string;
  ref: string;
  treeSha: string;
  status: SkillStatus;
  pillarIds: string[];
}

export interface WorkflowArtifact {
  id: string;
  name: string;
  category: string;
  description: string;
  outcome: string;
  pillarIds: string[];
}

export interface ArchiveEntry {
  id: string;
  title: string;
  category: "plan" | "run" | "policy" | "override" | "research";
  summary: string;
  createdAt: string;
  lineage: string[];
}

export interface ResearchSignal {
  id: string;
  source: string;
  title: string;
  category: string;
  strength: number;
  publishedAt: string;
  url?: string;
}

export interface TelemetryMetric {
  label: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "stable";
}

export interface ControlTelemetry {
  latencyMs: number;
  determinismScore: number;
  committeeHealth: number;
  policyAlignment: number;
  archiveCoverage: number;
  metrics: TelemetryMetric[];
}

export interface BootstrapPayload {
  system: string;
  version: string;
  thesis: string;
  surfaces: Array<{ id: SurfaceId; name: string; purpose: string }>;
  doctrines: string[];
}
