export type SurfaceId = "deterministic-engine" | "sunnyvale" | "silicon-valley" | "archives";

export type PlanStatus = "draft" | "review" | "approved" | "active" | "completed";
export type RunStatus = "queued" | "executing" | "completed" | "blocked" | "failed";
export type SkillStatus = "approved" | "review" | "quarantined";
export type RiskTier = "low" | "medium" | "high" | "critical";
export type VoteDirection = "approve" | "challenge" | "veto";
export type ResearchSourceHealth = "online" | "degraded" | "offline";
export type RunStageStatus = "completed" | "failed";
export type GovernanceProposalType = "committee" | "skill" | "workflow";
export type GovernanceProposalStatus = "proposed";
export type OperatorRunStatus = "queued" | "running" | "completed" | "failed" | "paused" | "escalated";
export type WorkerRuntimeStatus = "idle" | "running" | "paused" | "error";
export type BackendEventSeverity = "info" | "warning" | "critical";

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
  workflowIds: string[];
  skillIds: string[];
  escalationRuleIds: string[];
  graph: {
    nodes: PlanNode[];
    edges: PlanEdge[];
  };
  votes: CommitteeVote[];
  guardrails: string[];
  successMetrics: string[];
  researchQuery?: string;
  researchReferences?: CompiledArtifactReference[];
  proposals?: GovernanceProposal[];
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
  stages?: RunStageRecord[];
  artifact?: CompiledArtifact;
  errors?: string[];
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

export interface EscalationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  route: string[];
  severity: RiskTier;
  ownerCommitteeId: string;
  pillarIds: string[];
}

export interface OperatorCommittee {
  id: string;
  name: string;
  purpose: string;
  pillarIds: string[];
  workerIds: string[];
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
  metadata?: Record<string, unknown>;
}

export interface GovernanceProposal {
  id: string;
  type: GovernanceProposalType;
  name: string;
  rationale: string;
  status: GovernanceProposalStatus;
}

export interface ResearchSignal {
  id: string;
  source: string;
  title: string;
  category: string;
  strength: number;
  publishedAt: string;
  url?: string;
  abstract?: string;
  authors?: string[];
  doi?: string;
}

export interface ResearchSourceStatus {
  id: string;
  name: string;
  status: ResearchSourceHealth;
  lastSyncAt?: string;
  lastLatencyMs?: number;
  itemCount: number;
  error?: string;
}

export interface RunStageRecord {
  stage: string;
  status: RunStageStatus;
  startedAt: string;
  completedAt: string;
  summary: string;
  sourceCount?: number;
}

export interface CompiledArtifactPhaseOutput {
  stage: string;
  summary: string;
}

export interface CompiledArtifactReference {
  title: string;
  source: string;
  url?: string;
  publishedAt?: string;
}

export interface CompiledArtifact {
  id: string;
  title: string;
  objective: string;
  summary: string;
  sourceCount: number;
  signalSources: string[];
  workflowIds: string[];
  skillIds: string[];
  governanceSummary: string;
  nextAction: string;
  archiveRecordIds: string[];
  phaseOutputs: CompiledArtifactPhaseOutput[];
  references: CompiledArtifactReference[];
  createdAt: string;
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
  sourceHealth: number;
  activeRunCount: number;
  totalSignals: number;
  lastResearchSyncAt?: string;
  metrics: TelemetryMetric[];
}

export interface BootstrapPayload {
  system: string;
  version: string;
  thesis: string;
  surfaces: Array<{ id: SurfaceId; name: string; purpose: string }>;
  doctrines: string[];
  status?: string;
  identity?: string;
  userEmail?: string;
}

export interface GovernanceRegistry {
  version: string;
  updatedAt: string;
  updatedBy: string;
  pillars: Pillar[];
  committees: Committee[];
  skills: SkillArtifact[];
  workflows: WorkflowArtifact[];
  escalationRules: EscalationRule[];
  operatorCommittees: OperatorCommittee[];
  workers: OperatorWorker[];
  minimumLiveWorkerIds: string[];
}

export interface OperatorWorker {
  id: string;
  displayName: string;
  committeeId: string;
  primaryPillar: string;
  secondaryPillars: string[];
  purpose: string;
  schedule: string;
  intervalMinutes: number;
  inputSources: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  outputArtifact: string;
  archiveEventType: string;
  escalationRuleId: string;
  statusFields: string[];
  requiredSecrets: string[];
}

export interface WorkerRuntimeState {
  workerId: string;
  status: WorkerRuntimeStatus;
  paused: boolean;
  lastHeartbeatAt?: string;
  lastRunAt?: string;
  lastRunId?: string;
  nextRunAt?: string;
  lastError?: string;
}

export interface OperatorRun {
  id: string;
  workerId: string;
  committeeId: string;
  pillarId: string;
  startedAt: string;
  completedAt?: string;
  status: OperatorRunStatus;
  inputs: string[];
  actionsTaken: string[];
  evidenceCreated: string[];
  archiveRef?: string;
  escalations: string[];
  errors: string[];
  nextRecommendation: string;
}

export interface BackendProductEvent {
  eventId: string;
  eventType: string;
  source: "backend";
  workspaceId?: string;
  tenantId?: string;
  userId?: string;
  entityType: string;
  entityId: string;
  severity: BackendEventSeverity;
  status: string;
  timestamp: string;
  payload: Record<string, unknown>;
  pillarIds: string[];
  committeeIds: string[];
  workerIds: string[];
  archiveId?: string;
}

export interface BackendTruthSummary {
  liveUsers: number;
  signups: number;
  evaluationsStarted: number;
  runsCompleted: number;
  pipelineTests: number;
  endpointCalls: number;
  failedRoutes: number;
  reserveBalance: number;
  revenue: number;
  evidenceExports: number;
  mfaEvents: number;
  marketplaceInstalls: number;
  lastEventAt?: string;
}

export interface CommandCenterSnapshot {
  backend: BackendTruthSummary;
  institution: {
    workerCount: number;
    activeWorkerCount: number;
    pausedWorkerCount: number;
    operatorRunCount: number;
    openEscalations: number;
    archiveCount: number;
    planCount: number;
    governedRunCount: number;
  };
}

export type OperatingSignalKind = "evaluation" | "growth" | "field-intelligence";
export type OperatingSignalStatus = "open" | "watch" | "escalated" | "ready";
export type SunnyvaleDataMode = "live" | "research-only" | "waiting";

export interface OperatingSignal {
  id: string;
  kind: OperatingSignalKind;
  title: string;
  summary: string;
  category: string;
  accountLabel: string;
  workspaceId?: string;
  tier?: string;
  evaluationStage?: string;
  lastActivityAt?: string;
  runsUsed?: number;
  runsLimit?: number;
  endpointStatus?: string;
  evidenceActivity?: string;
  billingState?: string;
  reserveState?: string;
  mfaState?: string;
  errorsCount?: number;
  score: number;
  riskScore: number;
  confidence: number;
  evidence: string[];
  recommendedAction: string;
  assignedWorkerIds: string[];
  committeeId?: string;
  pillarIds: string[];
  archiveRef?: string;
  status: OperatingSignalStatus;
  sourceEventIds: string[];
}

export interface SunnyvaleOverview {
  totalSignals: number;
  activeEvaluations: number;
  seriousSignals: number;
  reserveBalance: number;
  workerConfidence: number;
  liveWorkers: number;
  failedRoutes: number;
  evidenceExports: number;
  lastBackendEventAt?: string;
}

export interface SunnyvaleInternalSnapshot {
  mode: SunnyvaleDataMode;
  asOf: string;
  overview: SunnyvaleOverview;
  evaluationSignals: OperatingSignal[];
  growthOpportunities: OperatingSignal[];
  fieldIntelligence: OperatingSignal[];
}

export interface EngineSignal {
  id: string;
  title: string;
  strength: number;
  timestamp: string;
  category: string;
}

export interface EngineConvergenceMetric {
  label: string;
  value: string;
  description: string;
  progress: number;
}

export interface HorowitzSignal {
  id: string;
  value: number;
  trend: "up" | "down" | "stable";
  history?: number[];
}

export interface EngineObservability {
  quantum_coherence: number;
  classical_latency: number;
  uacp_pressure: number;
  gopher_policy_alignment: number;
  market_convergence: EngineConvergenceMetric[];
  horowitz_signals: HorowitzSignal[];
}
