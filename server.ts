import "dotenv/config";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import cors from "cors";
import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { XMLParser } from "fast-xml-parser";
import { createServer as createViteServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";
import type {
  ArchiveEntry,
  BackendProductEvent,
  BackendTruthSummary,
  BootstrapPayload,
  Committee,
  CommitteeVote,
  CompiledArtifact,
  CompiledArtifactPhaseOutput,
  CompiledArtifactReference,
  ControlTelemetry,
  EscalationRule,
  EventItem,
  GovernanceProposal,
  GovernanceRegistry,
  GovernedRun,
  OperatorCommittee,
  OperatorRun,
  OperatorWorker,
  Pillar,
  ResearchSignal,
  ResearchSourceStatus,
  RiskTier,
  RunStageRecord,
  SkillArtifact,
  SurfaceId,
  WorkerRuntimeState,
  WorkflowArtifact,
  InstitutionalPlan,
  CommandCenterSnapshot,
} from "./src/types";

const PORT = Number(process.env.PORT || 3000);
const TOOL_NAME = "uacpv3-control-plane";
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || process.env.USER_EMAIL || "founder@uacp.local";
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "control-plane-state.json");
const REGISTRY_FILE = path.join(DATA_DIR, "governance-registry.json");
const ADMIN_API_KEY = process.env.UACP_ADMIN_KEY || "";
const INTERNAL_API_KEY = process.env.UACP_INTERNAL_API_KEY || ADMIN_API_KEY;
const MAX_EVENTS = 120;
const MAX_ARCHIVES = 80;
const MAX_SIGNALS = 40;
const MAX_BACKEND_EVENTS = 200;
const MAX_OPERATOR_RUNS = 240;
const HISTORY_WINDOW = 25;
const RESEARCH_REFRESH_INTERVAL_MS = 1000 * 60 * 15;
const OPERATOR_TICK_INTERVAL_MS = 1000 * 60;
const DEFAULT_RESEARCH_QUERY =
  process.env.DEFAULT_RESEARCH_QUERY ||
  "governance agents orchestration workflow committees skills institutional control plane";

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const parser = new XMLParser({ ignoreAttributes: false });

const surfaces: BootstrapPayload["surfaces"] = [
  { id: "deterministic-engine", name: "Deterministic Engine", purpose: "Live signal intake, graph compilation, and run telemetry." },
  { id: "sunnyvale", name: "Sunnyvale", purpose: "Execution floor for approvals, runs, workers, and workflows." },
  { id: "silicon-valley", name: "Silicon Valley", purpose: "Founder control console for governance, risk, and source health." },
  { id: "archives", name: "Archives", purpose: "Replayable evidence, compiled artifacts, and ordered event memory." },
];

const defaultGovernanceRegistry: GovernanceRegistry = {
  version: "1.0.0",
  updatedAt: "2026-05-08T00:00:00.000Z",
  updatedBy: "system-bootstrap",
  pillars: [
    { id: "governance", name: "Governance", mandate: "Keep the institution constitutional and replayable.", kpi: "Policy SLA" },
    { id: "product", name: "Product", mandate: "Translate institutional objectives into offers and UX.", kpi: "Activation rate" },
    { id: "engineering", name: "Engineering", mandate: "Ship reliable execution systems and control-plane primitives.", kpi: "Deployment quality" },
    { id: "growth", name: "Growth", mandate: "Acquire demand and compound distribution.", kpi: "Qualified pipeline" },
    { id: "sales", name: "Sales", mandate: "Convert pipeline into retained revenue.", kpi: "Closed ARR" },
    { id: "operations", name: "Operations", mandate: "Run queues, approvals, service delivery, and worker throughput.", kpi: "Cycle time" },
    { id: "finance", name: "Finance", mandate: "Protect margin, billing, and capital allocation.", kpi: "Gross margin" },
    { id: "compliance-risk", name: "Compliance / Risk", mandate: "Constrain execution by law, policy, and exposure.", kpi: "Risk incidents" },
    { id: "knowledge-research", name: "Knowledge / Research", mandate: "Turn public signals into institutional edge.", kpi: "Signal-to-shipment ratio" },
  ],
  committees: [
    {
      id: "founder-council",
      name: "Founder Council",
      purpose: "Final approval, veto, and escalation authority.",
      authority: "constitutional",
      chair: "UACP V3",
      members: ["UACP V3", "Policy Steward", "Revenue Operator"],
      escalation: "Direct founder override",
      allowedActions: ["approve_plans", "veto_runs", "reassign_committees"],
      vetoConditions: ["regulatory breach", "margin-negative execution", "missing research evidence"],
      pillarIds: ["governance", "finance", "compliance-risk"],
    },
    {
      id: "signal-council",
      name: "Signal Council",
      purpose: "Convert live research and market signals into opportunities and operating pressure.",
      authority: "advisory",
      chair: "Research Director",
      members: ["Research Scout", "Competitor Analyst", "Model Council Chair"],
      escalation: "Founder Council",
      allowedActions: ["publish_briefs", "recommend_targets", "open_investigations"],
      vetoConditions: ["no live sources", "low-evidence thesis"],
      pillarIds: ["knowledge-research", "growth", "product"],
    },
    {
      id: "execution-board",
      name: "Execution Board",
      purpose: "Route approved work into governed runs and service delivery.",
      authority: "operational",
      chair: "Operations Marshal",
      members: ["Workflow Captain", "Engineering Lead", "Revenue Operator"],
      escalation: "Founder Council",
      allowedActions: ["queue_runs", "assign_skills", "open_approvals"],
      vetoConditions: ["unapproved skill usage", "missing archive evidence"],
      pillarIds: ["operations", "engineering", "sales"],
    },
  ],
  skills: [
    {
      id: "marketing-competitive-analysis",
      name: "marketing-competitive-analysis",
      category: "skill",
      description: "Research competitors and expose positioning, workflow, and execution gaps using public evidence.",
      allowedTools: ["read", "browser"],
      source: "internal-registry/market-systems",
      ref: "v1.4.0",
      treeSha: "sha-9d8c1f1",
      status: "approved",
      pillarIds: ["growth", "knowledge-research"],
    },
    {
      id: "sales-call-prep",
      name: "sales-call-prep",
      category: "skill",
      description: "Prepare operator-grade account context, call strategy, and objection handling.",
      allowedTools: ["read", "browser", "write"],
      source: "internal-registry/revenue-systems",
      ref: "v2.0.1",
      treeSha: "sha-4ac77aa",
      status: "approved",
      pillarIds: ["sales", "growth"],
    },
    {
      id: "legal-compliance",
      name: "legal-compliance",
      category: "skill",
      description: "Constrain privacy, regulatory, and data subject workflows before execution.",
      allowedTools: ["read", "write"],
      source: "internal-registry/risk-systems",
      ref: "v1.9.3",
      treeSha: "sha-c13f9b2",
      status: "approved",
      pillarIds: ["compliance-risk", "governance"],
    },
    {
      id: "finance-audit-support",
      name: "finance-audit-support",
      category: "skill",
      description: "Support audit evidence, revenue control checks, and operating reviews.",
      allowedTools: ["read", "write"],
      source: "internal-registry/finance-systems",
      ref: "v1.1.8",
      treeSha: "sha-f82a11d",
      status: "review",
      pillarIds: ["finance", "governance"],
    },
  ],
  workflows: [
    {
      id: "competitive-intelligence",
      name: "Competitive intelligence",
      category: "workflow",
      description: "Monitor launches, pricing shifts, and partnership signals with live public-source evidence.",
      outcome: "Competitor weakness map",
      pillarIds: ["growth", "knowledge-research"],
    },
    {
      id: "model-council",
      name: "Model council",
      category: "workflow",
      description: "Run multi-model or deterministic council deliberation and capture convergence or dissent.",
      outcome: "Committee vote packet",
      pillarIds: ["governance", "knowledge-research"],
    },
    {
      id: "product-teardown",
      name: "Product teardown",
      category: "workflow",
      description: "Capture pricing, onboarding, feature gaps, and UX weaknesses from public artifacts.",
      outcome: "Actionable disruption brief",
      pillarIds: ["product", "growth", "sales"],
    },
  ],
  escalationRules: [
    {
      id: "missing-live-evidence",
      name: "Missing live evidence",
      description: "Escalate when a plan or run reaches governance without attributable live research.",
      trigger: "No live research references are attached to the plan or run.",
      route: ["signal-council", "founder-council"],
      severity: "high",
      ownerCommitteeId: "founder-council",
      pillarIds: ["governance", "knowledge-research", "compliance-risk"],
    },
    {
      id: "unapproved-skill-attempt",
      name: "Unapproved skill attempt",
      description: "Escalate when execution requires a skill that is not approved in the registry.",
      trigger: "A governed run requests a skill outside the approved registry set.",
      route: ["execution-board", "founder-council"],
      severity: "critical",
      ownerCommitteeId: "execution-board",
      pillarIds: ["operations", "engineering", "governance"],
    },
    {
      id: "regulated-objective-review",
      name: "Regulated objective review",
      description: "Escalate regulated, privacy, or compliance-heavy objectives through explicit founder review.",
      trigger: "The intent or evidence indicates regulated, privacy, legal, or compliance-sensitive work.",
      route: ["founder-council"],
      severity: "high",
      ownerCommitteeId: "founder-council",
      pillarIds: ["compliance-risk", "governance", "sales"],
    },
  ],
  operatorCommittees: [
    {
      id: "marketplace-operations",
      name: "Marketplace Operations",
      purpose: "Run marketplace health, intake, routing, and operational arbitration.",
      pillarIds: ["operations", "sales", "finance"],
      workerIds: ["herald", "harvest", "bouncer", "gauge", "arbiter"],
    },
    {
      id: "governance-evidence",
      name: "Governance & Evidence",
      purpose: "Protect evidence integrity, policy judgment, and escalation discipline.",
      pillarIds: ["governance", "finance", "compliance-risk", "knowledge-research"],
      workerIds: ["ledger", "oracle", "builder-arbiter", "sheriff"],
    },
    {
      id: "growth-intelligence",
      name: "Growth & Intelligence",
      purpose: "Convert public signals and buyer motion into governed growth actions.",
      pillarIds: ["growth", "sales", "knowledge-research"],
      workerIds: ["signal", "scout", "mint", "welcome"],
    },
    {
      id: "builder-systems",
      name: "Builder Systems",
      purpose: "Discover, shape, and forge builder opportunities without bypassing governance.",
      pillarIds: ["engineering", "product", "knowledge-research"],
      workerIds: ["builder-scout", "builder-forge", "builder-arbiter"],
    },
    {
      id: "experience-assurance",
      name: "Experience Assurance",
      purpose: "Keep the product experience truthful, fresh, and regression-resistant.",
      pillarIds: ["product", "operations", "compliance-risk"],
      workerIds: ["sentinel", "mirror", "polish", "glide", "pulse", "sheriff", "welcome"],
    },
  ],
  workers: [
    {
      id: "herald",
      displayName: "Herald",
      committeeId: "marketplace-operations",
      primaryPillar: "operations",
      secondaryPillars: ["sales"],
      purpose: "Announce, route, and log incoming marketplace actions and operator-facing triggers.",
      schedule: "Every 15 minutes",
      intervalMinutes: 15,
      inputSources: ["events", "archives", "research-signals"],
      allowedActions: ["route_notifications", "write_run_digest", "open_escalation"],
      forbiddenActions: ["modify_registry", "approve_payouts"],
      outputArtifact: "marketplace-intake-digest",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "missing-live-evidence",
      statusFields: ["status", "last_run", "next_run", "heartbeat"],
      requiredSecrets: []
    },
    {
      id: "harvest",
      displayName: "Harvest",
      committeeId: "marketplace-operations",
      primaryPillar: "operations",
      secondaryPillars: ["growth"],
      purpose: "Collect live demand, inventory, and signal opportunities into governed execution queues.",
      schedule: "Every 30 minutes",
      intervalMinutes: 30,
      inputSources: ["research-signals", "telemetry", "events"],
      allowedActions: ["collect_signals", "score_queue_pressure", "write_ops_digest"],
      forbiddenActions: ["bypass_committee_review"],
      outputArtifact: "harvest-queue-brief",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "missing-live-evidence",
      statusFields: ["status", "last_run", "queue_pressure"],
      requiredSecrets: []
    },
    {
      id: "bouncer",
      displayName: "Bouncer",
      committeeId: "marketplace-operations",
      primaryPillar: "compliance-risk",
      secondaryPillars: ["operations"],
      purpose: "Gate unsafe or out-of-policy actions before they enter the live execution floor.",
      schedule: "Every 10 minutes",
      intervalMinutes: 10,
      inputSources: ["events", "runs", "telemetry"],
      allowedActions: ["deny_unsafe_admission", "flag_policy_mismatch", "write_gate_report"],
      forbiddenActions: ["override_founder_veto"],
      outputArtifact: "admission-gate-report",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "blocked_actions"],
      requiredSecrets: []
    },
    {
      id: "gauge",
      displayName: "Gauge",
      committeeId: "marketplace-operations",
      primaryPillar: "operations",
      secondaryPillars: ["finance", "growth"],
      purpose: "Track operating telemetry, route health, conversion, and usage drift.",
      schedule: "Every 15 minutes",
      intervalMinutes: 15,
      inputSources: ["telemetry", "observability", "runs"],
      allowedActions: ["write_telemetry_snapshot", "flag_metric_anomaly", "recommend_followup"],
      forbiddenActions: ["change_metrics_history"],
      outputArtifact: "telemetry-digest",
      archiveEventType: "telemetry_snapshot_written",
      escalationRuleId: "missing-live-evidence",
      statusFields: ["status", "last_run", "last_snapshot", "heartbeat"],
      requiredSecrets: []
    },
    {
      id: "ledger",
      displayName: "Ledger",
      committeeId: "governance-evidence",
      primaryPillar: "governance",
      secondaryPillars: ["finance", "compliance-risk"],
      purpose: "Protect evidence truth, archive integrity, and traceability across runs.",
      schedule: "Every 15 minutes",
      intervalMinutes: 15,
      inputSources: ["archives", "runs", "events"],
      allowedActions: ["verify_archive_lineage", "write_evidence_report", "flag_missing_evidence"],
      forbiddenActions: ["delete_archive_records"],
      outputArtifact: "evidence-integrity-report",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "missing-live-evidence",
      statusFields: ["status", "last_run", "archive_coverage"],
      requiredSecrets: []
    },
    {
      id: "signal",
      displayName: "Signal",
      committeeId: "growth-intelligence",
      primaryPillar: "growth",
      secondaryPillars: ["knowledge-research"],
      purpose: "Turn live public-source evidence into actionable market pressure summaries.",
      schedule: "Every 30 minutes",
      intervalMinutes: 30,
      inputSources: ["research-signals", "research-status"],
      allowedActions: ["summarize_signal_pressure", "rank_opportunities", "write_growth_brief"],
      forbiddenActions: ["invent_sources"],
      outputArtifact: "signal-pressure-brief",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "missing-live-evidence",
      statusFields: ["status", "last_run", "signal_count"],
      requiredSecrets: []
    },
    {
      id: "oracle",
      displayName: "Oracle",
      committeeId: "governance-evidence",
      primaryPillar: "knowledge-research",
      secondaryPillars: ["governance"],
      purpose: "Interpret live evidence into governance-ready judgment packets.",
      schedule: "Hourly",
      intervalMinutes: 60,
      inputSources: ["research-signals", "plans", "archives"],
      allowedActions: ["write_council_brief", "surface_uncertainty", "recommend_escalation"],
      forbiddenActions: ["self-approve_governance"],
      outputArtifact: "council-judgment-packet",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "brief_count"],
      requiredSecrets: []
    },
    {
      id: "mint",
      displayName: "Mint",
      committeeId: "growth-intelligence",
      primaryPillar: "finance",
      secondaryPillars: ["growth", "sales"],
      purpose: "Translate demand and workflow pressure into monetization and pricing recommendations.",
      schedule: "Hourly",
      intervalMinutes: 60,
      inputSources: ["telemetry", "plans", "research-signals"],
      allowedActions: ["write_pricing_digest", "flag_margin_risk", "recommend_offer_changes"],
      forbiddenActions: ["execute_billing_changes"],
      outputArtifact: "monetization-brief",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "pricing_pressure"],
      requiredSecrets: []
    },
    {
      id: "scout",
      displayName: "Scout",
      committeeId: "growth-intelligence",
      primaryPillar: "knowledge-research",
      secondaryPillars: ["growth"],
      purpose: "Search for competitor weakness, broken workflows, and opportunity gaps.",
      schedule: "Every 45 minutes",
      intervalMinutes: 45,
      inputSources: ["research-signals", "events", "archives"],
      allowedActions: ["scan_opportunities", "write_gap_map", "recommend_builder_targets"],
      forbiddenActions: ["copy_external_products"],
      outputArtifact: "gap-map",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "missing-live-evidence",
      statusFields: ["status", "last_run", "gap_count"],
      requiredSecrets: []
    },
    {
      id: "arbiter",
      displayName: "Arbiter",
      committeeId: "marketplace-operations",
      primaryPillar: "governance",
      secondaryPillars: ["operations"],
      purpose: "Resolve conflicts in marketplace routing and adjudicate queue priorities.",
      schedule: "Every 30 minutes",
      intervalMinutes: 30,
      inputSources: ["plans", "runs", "events"],
      allowedActions: ["rank_queue_priority", "write_adjudication_note", "open_escalation"],
      forbiddenActions: ["edit_registry_without_admin"],
      outputArtifact: "queue-adjudication-note",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "pending_conflicts"],
      requiredSecrets: []
    },
    {
      id: "builder-scout",
      displayName: "Builder Scout",
      committeeId: "builder-systems",
      primaryPillar: "knowledge-research",
      secondaryPillars: ["engineering", "product"],
      purpose: "Locate builder opportunities that can become original tools or repair kits.",
      schedule: "Every 90 minutes",
      intervalMinutes: 90,
      inputSources: ["research-signals", "archives", "plans"],
      allowedActions: ["open_builder_opportunity", "write_clean_room_brief", "recommend_scope"],
      forbiddenActions: ["clone_external_repos"],
      outputArtifact: "builder-opportunity-brief",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "missing-live-evidence",
      statusFields: ["status", "last_run", "opportunity_count"],
      requiredSecrets: []
    },
    {
      id: "builder-forge",
      displayName: "Builder Forge",
      committeeId: "builder-systems",
      primaryPillar: "engineering",
      secondaryPillars: ["product"],
      purpose: "Turn approved builder opportunities into governed implementation packets.",
      schedule: "Every 120 minutes",
      intervalMinutes: 120,
      inputSources: ["plans", "archives", "events"],
      allowedActions: ["prepare_build_spec", "write_acceptance_packet", "flag_missing_dependencies"],
      forbiddenActions: ["ship_without_approval"],
      outputArtifact: "builder-implementation-packet",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "unapproved-skill-attempt",
      statusFields: ["status", "last_run", "active_specs"],
      requiredSecrets: []
    },
    {
      id: "builder-arbiter",
      displayName: "Builder Arbiter",
      committeeId: "governance-evidence",
      primaryPillar: "governance",
      secondaryPillars: ["engineering", "knowledge-research"],
      purpose: "Judge builder proposals for legal, policy, and operational admissibility.",
      schedule: "Every 90 minutes",
      intervalMinutes: 90,
      inputSources: ["plans", "archives", "research-signals"],
      allowedActions: ["approve_builder_route", "deny_builder_route", "write_builder_decision"],
      forbiddenActions: ["implement_code_changes"],
      outputArtifact: "builder-decision-record",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "builder_decisions"],
      requiredSecrets: []
    },
    {
      id: "sentinel",
      displayName: "Sentinel",
      committeeId: "experience-assurance",
      primaryPillar: "product",
      secondaryPillars: ["operations"],
      purpose: "Watch end-to-end product uptime and execution path health.",
      schedule: "Every 15 minutes",
      intervalMinutes: 15,
      inputSources: ["telemetry", "events", "runs"],
      allowedActions: ["verify_route_health", "write_uptime_report", "escalate_outage"],
      forbiddenActions: ["mask_failures"],
      outputArtifact: "uptime-report",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "route_health", "heartbeat"],
      requiredSecrets: []
    },
    {
      id: "mirror",
      displayName: "Mirror",
      committeeId: "experience-assurance",
      primaryPillar: "product",
      secondaryPillars: ["engineering"],
      purpose: "Compare UI truth against backend truth and expose drift.",
      schedule: "Every 15 minutes",
      intervalMinutes: 15,
      inputSources: ["telemetry", "observability", "archives"],
      allowedActions: ["compare_surface_truth", "write_drift_report", "flag_mismatch"],
      forbiddenActions: ["rewrite_archives"],
      outputArtifact: "truth-drift-report",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "missing-live-evidence",
      statusFields: ["status", "last_run", "drift_count", "heartbeat"],
      requiredSecrets: []
    },
    {
      id: "polish",
      displayName: "Polish",
      committeeId: "experience-assurance",
      primaryPillar: "product",
      secondaryPillars: ["sales"],
      purpose: "Guard product quality, clarity, and finish in customer-facing flows.",
      schedule: "Hourly",
      intervalMinutes: 60,
      inputSources: ["plans", "archives", "events"],
      allowedActions: ["write_quality_report", "flag_clutter", "recommend_copy_fix"],
      forbiddenActions: ["deploy_unreviewed_ui"],
      outputArtifact: "quality-pass-report",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "quality_findings", "heartbeat"],
      requiredSecrets: []
    },
    {
      id: "glide",
      displayName: "Glide",
      committeeId: "experience-assurance",
      primaryPillar: "product",
      secondaryPillars: ["sales"],
      purpose: "Inspect onboarding and user motion for friction and conversion drag.",
      schedule: "Every 45 minutes",
      intervalMinutes: 45,
      inputSources: ["telemetry", "plans", "research-signals"],
      allowedActions: ["write_onboarding_report", "flag_friction", "recommend_flow_change"],
      forbiddenActions: ["alter_conversion_data"],
      outputArtifact: "flow-friction-report",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "friction_count"],
      requiredSecrets: []
    },
    {
      id: "pulse",
      displayName: "Pulse",
      committeeId: "experience-assurance",
      primaryPillar: "operations",
      secondaryPillars: ["product"],
      purpose: "Keep live command panels, telemetry cards, and freshness indicators honest.",
      schedule: "Every 15 minutes",
      intervalMinutes: 15,
      inputSources: ["telemetry", "events", "observability"],
      allowedActions: ["measure_panel_freshness", "write_staleness_report", "flag_stale_surface"],
      forbiddenActions: ["fabricate_refreshes"],
      outputArtifact: "panel-freshness-report",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "missing-live-evidence",
      statusFields: ["status", "last_run", "freshness_state", "heartbeat"],
      requiredSecrets: []
    },
    {
      id: "sheriff",
      displayName: "Sheriff",
      committeeId: "governance-evidence",
      primaryPillar: "compliance-risk",
      secondaryPillars: ["product", "governance"],
      purpose: "Catch regressions, unsafe drift, and policy violations before they compound.",
      schedule: "Every 15 minutes",
      intervalMinutes: 15,
      inputSources: ["runs", "events", "telemetry", "archives"],
      allowedActions: ["flag_regression", "write_incident_report", "open_escalation"],
      forbiddenActions: ["suppress_policy_findings"],
      outputArtifact: "regression-watch-report",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "regression_count", "heartbeat"],
      requiredSecrets: []
    },
    {
      id: "welcome",
      displayName: "Welcome",
      committeeId: "growth-intelligence",
      primaryPillar: "sales",
      secondaryPillars: ["growth", "product"],
      purpose: "Own first-contact clarity, evaluator entry paths, and guided next actions.",
      schedule: "Every 30 minutes",
      intervalMinutes: 30,
      inputSources: ["plans", "telemetry", "research-signals"],
      allowedActions: ["write_entrypoint_brief", "recommend_next_action", "flag_missing_guidance"],
      forbiddenActions: ["change_pricing_unilaterally"],
      outputArtifact: "welcome-journey-brief",
      archiveEventType: "worker_run_completed",
      escalationRuleId: "regulated-objective-review",
      statusFields: ["status", "last_run", "journey_health"],
      requiredSecrets: []
    }
  ],
  minimumLiveWorkerIds: [
    "gauge",
    "ledger",
    "sentinel",
    "mirror",
    "pulse",
    "sheriff",
    "polish"
  ]
};

type RuntimeStats = {
  planCompileDurationsMs: number[];
  runDurationsMs: number[];
  researchRefreshDurationsMs: number[];
  determinismHistory: number[];
  runCompletionHistory: number[];
  policyAlignmentHistory: number[];
  archiveCoverageHistory: number[];
  sourceHealthHistory: number[];
  pressureHistory: number[];
  lastResearchSyncAt?: string;
  lastGovernanceRegistryHash?: string;
  lastGovernanceRegistrySyncAt?: string;
};

type RuntimeState = {
  plans: InstitutionalPlan[];
  runs: GovernedRun[];
  operatorRuns: OperatorRun[];
  workerRuntime: WorkerRuntimeState[];
  backendEvents: BackendProductEvent[];
  backendSummary: BackendTruthSummary;
  events: EventItem[];
  archives: ArchiveEntry[];
  researchSignals: ResearchSignal[];
  researchStatus: ResearchSourceStatus[];
  stats: RuntimeStats;
};

type ResearchFetchResult = {
  signals: ResearchSignal[];
  statuses: ResearchSourceStatus[];
  durationMs: number;
};

type GovernanceEvaluation = {
  passed: boolean;
  approvals: number;
  issues: string[];
  summary: string;
  skillIds: string[];
  workflowIds: string[];
};

type TelemetrySnapshot = {
  latencyMs: number;
  determinismScore: number;
  committeeHealth: number;
  policyAlignment: number;
  archiveCoverage: number;
  sourceHealth: number;
  activeRunCount: number;
  totalSignals: number;
  runSuccessRate: number;
  runFailureRate: number;
  researchFreshness: number;
  workerPriming: number;
  planReadiness: number;
  latestRunIntegrity: number;
  executionPressure: number;
  lastResearchSyncAt?: string;
};

function emptyBackendTruthSummary(): BackendTruthSummary {
  return {
    liveUsers: 0,
    signups: 0,
    evaluationsStarted: 0,
    runsCompleted: 0,
    pipelineTests: 0,
    endpointCalls: 0,
    failedRoutes: 0,
    reserveBalance: 0,
    revenue: 0,
    evidenceExports: 0,
    mfaEvents: 0,
    marketplaceInstalls: 0,
    lastEventAt: undefined,
  };
}

function cloneRegistry(registry: GovernanceRegistry): GovernanceRegistry {
  return JSON.parse(JSON.stringify(registry)) as GovernanceRegistry;
}

function activePillars() {
  return governanceRegistry.pillars;
}

function activeCommittees() {
  return governanceRegistry.committees;
}

function activeSkills() {
  return governanceRegistry.skills;
}

function activeWorkflows() {
  return governanceRegistry.workflows;
}

function activeEscalationRules() {
  return governanceRegistry.escalationRules;
}

function activeOperatorCommittees() {
  return governanceRegistry.operatorCommittees;
}

function activeWorkers() {
  return governanceRegistry.workers;
}

function minimumLiveWorkerIds() {
  return governanceRegistry.minimumLiveWorkerIds;
}

function workerById(workerId: string) {
  return activeWorkers().find((worker) => worker.id === workerId);
}

function operatorCommitteeById(committeeId: string) {
  return activeOperatorCommittees().find((committee) => committee.id === committeeId);
}

function isoAfterMinutes(minutes: number, base = Date.now()) {
  return new Date(base + minutes * 60 * 1000).toISOString();
}

function makeWorkerRuntime(worker: OperatorWorker): WorkerRuntimeState {
  const initialNextRunAt = minimumLiveWorkerIds().includes(worker.id)
    ? now()
    : isoAfterMinutes(worker.intervalMinutes);
  return {
    workerId: worker.id,
    status: "idle",
    paused: false,
    lastHeartbeatAt: undefined,
    lastRunAt: undefined,
    lastRunId: undefined,
    nextRunAt: initialNextRunAt,
    lastError: undefined,
  };
}

function syncWorkerRuntimeState() {
  const current = new Map(state.workerRuntime.map((runtime) => [runtime.workerId, runtime]));
  state.workerRuntime = activeWorkers().map((worker) => {
    const existing = current.get(worker.id);
    return existing
      ? {
          ...existing,
          workerId: worker.id,
          nextRunAt: existing.nextRunAt || isoAfterMinutes(worker.intervalMinutes),
        }
      : makeWorkerRuntime(worker);
  });
}

const clients = new Set<WebSocket>();
let state: RuntimeState = emptyState();
let persistQueue = Promise.resolve();
let governanceRegistry: GovernanceRegistry = cloneRegistry(defaultGovernanceRegistry);

function emptyState(): RuntimeState {
  return {
    plans: [],
    runs: [],
    operatorRuns: [],
    workerRuntime: [],
    backendEvents: [],
    backendSummary: emptyBackendTruthSummary(),
    events: [],
    archives: [],
    researchSignals: [],
    researchStatus: [],
    stats: {
      planCompileDurationsMs: [],
      runDurationsMs: [],
      researchRefreshDurationsMs: [],
      determinismHistory: [],
      runCompletionHistory: [],
      policyAlignmentHistory: [],
      archiveCoverageHistory: [],
      sourceHealthHistory: [],
      pressureHistory: [],
      lastGovernanceRegistryHash: undefined,
      lastGovernanceRegistrySyncAt: undefined,
    },
  };
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pushWindow(values: number[], value: number) {
  values.push(value);
  if (values.length > HISTORY_WINDOW) {
    values.splice(0, values.length - HISTORY_WINDOW);
  }
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function trimText(value: string, length: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= length ? compact : `${compact.slice(0, length - 3)}...`;
}

function normalizeTitle(value: unknown) {
  return String(value || "Untitled").replace(/\s+/g, " ").trim();
}

function parseDate(value: unknown) {
  if (!value) return now();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? now() : parsed.toISOString();
}

function daysSince(isoDate: string) {
  const millis = new Date(isoDate).getTime();
  if (Number.isNaN(millis)) return 365;
  return Math.max(0, (Date.now() - millis) / (1000 * 60 * 60 * 24));
}

function tokenize(text: string) {
  const stopwords = new Set([
    "the", "and", "for", "with", "that", "this", "into", "from", "your", "about", "using",
    "build", "create", "make", "want", "need", "plan", "system", "teams", "team", "serious",
    "then", "they", "them", "their", "there", "have", "will", "what", "when", "where",
  ]);

  return uniqueStrings(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !stopwords.has(token)),
  );
}

function buildResearchQuery(text: string) {
  const tokens = tokenize(text).slice(0, 8);
  return tokens.length > 0 ? tokens.join(" ") : DEFAULT_RESEARCH_QUERY;
}

function textRelevance(tokens: string[], haystack: string) {
  if (tokens.length === 0) return 0.25;
  const normalized = haystack.toLowerCase();
  const matches = tokens.filter((token) => normalized.includes(token)).length;
  return matches / tokens.length;
}

function computeSignalStrength(sourceBias: number, query: string, signalText: string, publishedAt: string) {
  const tokens = tokenize(query);
  const relevance = textRelevance(tokens, signalText);
  const recency = clamp(1 - daysSince(publishedAt) / 365, 0, 1);
  return Math.round(clamp((relevance * 55) + (recency * 25) + sourceBias, 10, 99));
}

function toReference(signal: ResearchSignal): CompiledArtifactReference {
  return {
    title: signal.title,
    source: signal.source,
    url: signal.url,
    publishedAt: signal.publishedAt,
  };
}

function makeStatus(
  id: string,
  name: string,
  startedAt: number,
  itemCount: number,
  error?: string,
): ResearchSourceStatus {
  const latency = Date.now() - startedAt;
  return {
    id,
    name,
    status: error ? (itemCount > 0 ? "degraded" : "offline") : "online",
    lastSyncAt: now(),
    lastLatencyMs: latency,
    itemCount,
    error,
  };
}

function byRecencyAndStrength(a: ResearchSignal, b: ResearchSignal) {
  if (b.strength !== a.strength) return b.strength - a.strength;
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": `${TOOL_NAME} (${CONTACT_EMAIL})` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": `${TOOL_NAME} (${CONTACT_EMAIL})` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function fetchArxivSignals(query: string, limit: number) {
  const startedAt = Date.now();
  try {
    const tokens = tokenize(query).slice(0, 6);
    const searchQuery = tokens.length > 0
      ? `all:(${tokens.map((token) => `"${token}"`).join(" AND ")})`
      : `all:(${DEFAULT_RESEARCH_QUERY.split(" ").slice(0, 5).join(" AND ")})`;
    const xml = await fetchText(
      `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${limit}&sortBy=lastUpdatedDate&sortOrder=descending`,
    );
    const parsed = parser.parse(xml);
    const entries = Array.isArray(parsed.feed?.entry)
      ? parsed.feed.entry
      : parsed.feed?.entry
        ? [parsed.feed.entry]
        : [];

    const signals = entries.map((entry: any) => {
      const publishedAt = parseDate(entry.updated || entry.published);
      const title = normalizeTitle(entry.title);
      const summary = trimText(String(entry.summary || ""), 400);
      const authors = Array.isArray(entry.author)
        ? entry.author.map((author: any) => normalizeTitle(author.name))
        : entry.author
          ? [normalizeTitle(entry.author.name)]
          : [];

      return {
        id: `arxiv-${String(entry.id || title).split("/").pop()}`,
        source: "arXiv",
        title,
        category: "Research",
        strength: computeSignalStrength(18, query, `${title} ${summary}`, publishedAt),
        publishedAt,
        url: entry.id,
        abstract: summary,
        authors,
      } satisfies ResearchSignal;
    });

    return {
      signals,
      status: makeStatus("arxiv", "arXiv", startedAt, signals.length),
    };
  } catch (error) {
    return {
      signals: [],
      status: makeStatus("arxiv", "arXiv", startedAt, 0, error instanceof Error ? error.message : "Unknown error"),
    };
  }
}

async function fetchPubMedSignals(query: string, limit: number) {
  const startedAt = Date.now();
  try {
    const esearch = await fetchJson<{
      esearchresult?: { idlist?: string[] };
    }>(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}&sort=pub+date&tool=${encodeURIComponent(TOOL_NAME)}&email=${encodeURIComponent(CONTACT_EMAIL)}&term=${encodeURIComponent(query)}`,
    );

    const ids = esearch.esearchresult?.idlist ?? [];
    if (ids.length === 0) {
      return {
        signals: [],
        status: makeStatus("pubmed", "PubMed", startedAt, 0),
      };
    }

    const esummary = await fetchJson<{
      result?: Record<string, any> & { uids?: string[] };
    }>(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&tool=${encodeURIComponent(TOOL_NAME)}&email=${encodeURIComponent(CONTACT_EMAIL)}&id=${ids.join(",")}`,
    );

    const summary = esummary.result ?? {};
    const signals = ids
      .map((id) => summary[id])
      .filter(Boolean)
      .map((entry) => {
        const publishedAt = parseDate(entry.pubdate || entry.sortpubdate);
        const title = normalizeTitle(entry.title);
        const authors = Array.isArray(entry.authors)
          ? entry.authors.map((author: any) => normalizeTitle(author.name))
          : [];

        return {
          id: `pubmed-${entry.uid}`,
          source: "PubMed",
          title,
          category: "Biomedical",
          strength: computeSignalStrength(20, query, `${title} ${entry.fulljournalname || ""}`, publishedAt),
          publishedAt,
          url: `https://pubmed.ncbi.nlm.nih.gov/${entry.uid}/`,
          authors,
        } satisfies ResearchSignal;
      });

    return {
      signals,
      status: makeStatus("pubmed", "PubMed", startedAt, signals.length),
    };
  } catch (error) {
    return {
      signals: [],
      status: makeStatus("pubmed", "PubMed", startedAt, 0, error instanceof Error ? error.message : "Unknown error"),
    };
  }
}

async function fetchCrossrefSignals(query: string, limit: number) {
  const startedAt = Date.now();
  try {
    const response = await fetchJson<{
      message?: { items?: Array<Record<string, any>> };
    }>(
      `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=${limit}&sort=published&order=desc&select=DOI,title,URL,published,created,subject,author,type&mailto=${encodeURIComponent(CONTACT_EMAIL)}`,
    );

    const items = response.message?.items ?? [];
    const signals = items.map((item) => {
      const dateParts = item.published?.["date-parts"]?.[0] || item.created?.["date-parts"]?.[0];
      const publishedAt = Array.isArray(dateParts)
        ? parseDate(new Date(dateParts[0], (dateParts[1] || 1) - 1, dateParts[2] || 1).toISOString())
        : now();
      const title = normalizeTitle(Array.isArray(item.title) ? item.title[0] : item.title);
      const authors = Array.isArray(item.author)
        ? item.author.map((author: any) => normalizeTitle([author.given, author.family].filter(Boolean).join(" ")))
        : [];
      const subject = Array.isArray(item.subject) ? item.subject.join(", ") : item.type || "Crossref";

      return {
        id: `crossref-${item.DOI || createId("doi")}`,
        source: "Crossref",
        title,
        category: subject || "Crossref",
        strength: computeSignalStrength(14, query, `${title} ${subject}`, publishedAt),
        publishedAt,
        url: item.URL,
        authors,
        doi: item.DOI,
      } satisfies ResearchSignal;
    });

    return {
      signals,
      status: makeStatus("crossref", "Crossref", startedAt, signals.length),
    };
  } catch (error) {
    return {
      signals: [],
      status: makeStatus("crossref", "Crossref", startedAt, 0, error instanceof Error ? error.message : "Unknown error"),
    };
  }
}

async function fetchZenodoSignals(query: string, limit: number) {
  const startedAt = Date.now();
  try {
    const response = await fetchJson<{
      hits?: { hits?: Array<Record<string, any>> };
    }>(
      `https://zenodo.org/api/records?q=${encodeURIComponent(query)}&sort=mostrecent&page=1&size=${limit}`,
    );

    const hits = response.hits?.hits ?? [];
    const signals = hits.map((hit) => {
      const metadata = hit.metadata ?? {};
      const title = normalizeTitle(metadata.title || hit.title);
      const publishedAt = parseDate(metadata.publication_date || hit.created || hit.updated);
      const creators = Array.isArray(metadata.creators)
        ? metadata.creators.map((creator: any) => normalizeTitle(creator.name))
        : [];

      return {
        id: `zenodo-${hit.id || createId("zen")}`,
        source: "Zenodo",
        title,
        category: metadata.resource_type?.title || metadata.upload_type || "Repository",
        strength: computeSignalStrength(12, query, `${title} ${metadata.description || ""}`, publishedAt),
        publishedAt,
        url: hit.links?.html || hit.links?.self_html || hit.links?.self,
        abstract: metadata.description ? trimText(String(metadata.description), 400) : undefined,
        authors: creators,
        doi: metadata.doi,
      } satisfies ResearchSignal;
    });

    return {
      signals,
      status: makeStatus("zenodo", "Zenodo", startedAt, signals.length),
    };
  } catch (error) {
    return {
      signals: [],
      status: makeStatus("zenodo", "Zenodo", startedAt, 0, error instanceof Error ? error.message : "Unknown error"),
    };
  }
}

async function fetchLiveResearch(query: string, limitPerSource = 4): Promise<ResearchFetchResult> {
  const startedAt = Date.now();
  const results = await Promise.all([
    fetchArxivSignals(query, limitPerSource),
    fetchPubMedSignals(query, limitPerSource),
    fetchCrossrefSignals(query, limitPerSource),
    fetchZenodoSignals(query, limitPerSource),
  ]);

  const deduped = new Map<string, ResearchSignal>();
  for (const result of results) {
    for (const signal of result.signals) {
      const key = signal.doi || signal.url || `${signal.source}:${signal.title.toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing || byRecencyAndStrength(signal, existing) < 0) {
        deduped.set(key, signal);
      }
    }
  }

  const signals = [...deduped.values()].sort(byRecencyAndStrength).slice(0, MAX_SIGNALS);
  const statuses = results.map((result) => result.status);

  return {
    signals,
    statuses,
    durationMs: Date.now() - startedAt,
  };
}

function keywordMatch(intent: string, keywords: string[]) {
  const normalized = intent.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function selectPillars(intent: string, signals: ResearchSignal[]) {
  const selected = new Set<string>(["governance", "engineering", "operations"]);
  const signalText = signals.map((signal) => `${signal.title} ${signal.category}`).join(" ").toLowerCase();
  const combined = `${intent.toLowerCase()} ${signalText}`;

  if (keywordMatch(combined, ["product", "feature", "onboarding", "ux", "workflow"])) selected.add("product");
  if (keywordMatch(combined, ["growth", "traffic", "distribution", "pipeline", "competitor", "market"])) selected.add("growth");
  if (keywordMatch(combined, ["sales", "buyer", "account", "deal", "revenue"])) selected.add("sales");
  if (keywordMatch(combined, ["finance", "pricing", "margin", "billing", "roi"])) selected.add("finance");
  if (keywordMatch(combined, ["compliance", "risk", "legal", "regulated", "privacy", "security"])) selected.add("compliance-risk");
  if (signals.length > 0) selected.add("knowledge-research");

  return activePillars().filter((pillar) => selected.has(pillar.id)).map((pillar) => pillar.id);
}

function selectCommittees(pillarIds: string[]) {
  const selected = new Set<string>(["founder-council", "execution-board"]);
  if (pillarIds.includes("knowledge-research") || pillarIds.includes("growth") || pillarIds.includes("product")) {
    selected.add("signal-council");
  }
  return activeCommittees().filter((committee) => committee.id && [...selected].includes(committee.id)).map((committee) => committee.id);
}

function selectRiskTier(intent: string, signals: ResearchSignal[]): RiskTier {
  const normalized = `${intent.toLowerCase()} ${signals.map((signal) => signal.category).join(" ").toLowerCase()}`;
  if (keywordMatch(normalized, ["regulated", "medical", "health", "privacy", "compliance", "legal"])) return "high";
  if (keywordMatch(normalized, ["finance", "security", "billing", "customer data"])) return "medium";
  return "low";
}

function selectWorkflowIds(pillarIds: string[]) {
  return activeWorkflows()
    .filter((workflow) => workflow.pillarIds.some((pillarId) => pillarIds.includes(pillarId)))
    .map((workflow) => workflow.id);
}

function selectSkillIds(pillarIds: string[]) {
  return activeSkills()
    .filter((skill) => skill.status === "approved" && skill.pillarIds.some((pillarId) => pillarIds.includes(pillarId)))
    .map((skill) => skill.id);
}

function selectEscalationRuleIds(intent: string, pillarIds: string[], riskTier: RiskTier, signals: ResearchSignal[], skillIds: string[]) {
  const normalized = intent.toLowerCase();
  const matches = new Set<string>();

  for (const rule of activeEscalationRules()) {
    if (!rule.pillarIds.some((pillarId) => pillarIds.includes(pillarId))) continue;
    if (rule.id === "missing-live-evidence" && signals.length === 0) matches.add(rule.id);
    if (rule.id === "unapproved-skill-attempt" && skillIds.length === 0) matches.add(rule.id);
    if (rule.id === "regulated-objective-review" && (riskTier === "high" || keywordMatch(normalized, ["regulated", "privacy", "legal", "compliance"]))) {
      matches.add(rule.id);
    }
  }

  return activeEscalationRules().filter((rule) => matches.has(rule.id)).map((rule) => rule.id);
}

function mergeProposals(proposals: GovernanceProposal[]) {
  const seen = new Set<string>();
  return proposals.filter((proposal) => {
    const key = `${proposal.type}:${proposal.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeProposal(type: GovernanceProposal["type"], name: string, rationale: string): GovernanceProposal {
  return {
    id: createId("proposal"),
    type,
    name: trimText(name, 120),
    rationale: trimText(rationale, 260),
    status: "proposed",
  };
}

function buildCoverageProposals(intent: string, workflowIds: string[], skillIds: string[]): GovernanceProposal[] {
  const proposals: GovernanceProposal[] = [];
  const compactIntent = trimText(intent.split(/\s+/).slice(0, 6).join(" ") || "operating mission", 80);

  if (workflowIds.length === 0) {
    proposals.push(
      makeProposal(
        "workflow",
        `${compactIntent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-workflow`,
        "No approved workflow matched the selected pillar set. Review whether a new governed workflow should be added to the registry.",
      ),
    );
  }

  if (skillIds.length === 0) {
    proposals.push(
      makeProposal(
        "skill",
        `${compactIntent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-skill`,
        "No approved skill matched the selected pillar set. Review whether a new governed skill should be proposed for approval.",
      ),
    );
  }

  return proposals;
}

function collectUnknownIdProposals(candidate: unknown, allowed: string[], type: GovernanceProposal["type"]) {
  if (!Array.isArray(candidate)) return [] as GovernanceProposal[];
  const allowedSet = new Set(allowed);
  return candidate
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0 && !allowedSet.has(value))
    .map((value) =>
      makeProposal(type, value, `Model requested an unregistered ${type}. It remains proposed until founder approval adds it to the governance registry.`),
    );
}

function buildDeterministicPlan(intent: string, researchQuery: string, signals: ResearchSignal[]): Omit<InstitutionalPlan, "id" | "createdAt"> {
  const pillarIds = selectPillars(intent, signals);
  const committeeIds = selectCommittees(pillarIds);
  const workflowIds = selectWorkflowIds(pillarIds);
  const skillIds = selectSkillIds(pillarIds);
  const researchReferences = signals.slice(0, 6).map(toReference);
  const title = trimText(intent.split(/\s+/).slice(0, 8).join(" ") || "Institutional Plan", 72);
  const riskTier = selectRiskTier(intent, signals);
  const escalationRuleIds = selectEscalationRuleIds(intent, pillarIds, riskTier, signals, skillIds);
  const proposals = buildCoverageProposals(intent, workflowIds, skillIds);
  const sourceList = uniqueStrings(signals.map((signal) => signal.source));
  const sourceSummary = sourceList.length > 0 ? `${signals.length} live sources from ${sourceList.join(", ")}` : "no live research sources";

  const votes: CommitteeVote[] = [
    {
      member: "Signal Council",
      model: "deterministic-council",
      vote: signals.length > 0 ? "approve" : "challenge",
      rationale: signals.length > 0
        ? `Live research context is present through ${sourceSummary}.`
        : "No live research evidence was available at plan compile time.",
    },
    {
      member: "Policy Steward",
      model: "deterministic-governance",
      vote: riskTier === "high" ? "challenge" : "approve",
      rationale: riskTier === "high"
        ? "High-risk language detected; compliance guardrails must be enforced before execution."
        : "The objective can proceed under standard governance constraints.",
    },
    {
      member: "Execution Board",
      model: "deterministic-execution",
      vote: "approve",
      rationale: `Workflow routing selected ${workflowIds.length} execution workflows and ${skillIds.length} approved skills.`,
    },
  ];

  const graphNodes = [
    {
      id: "intent-intake",
      label: "Intent Intake",
      stage: "intent" as const,
      ownerCommitteeId: "founder-council",
      pillarIds: ["governance"],
      summary: "Normalize founder intent into a monetizable operating objective.",
      latencyMs: 30 + intent.length,
    },
    {
      id: "research-council",
      label: "Model Council",
      stage: "reasoning" as const,
      ownerCommitteeId: committeeIds.includes("signal-council") ? "signal-council" : "founder-council",
      pillarIds: ["knowledge-research", "growth"].filter((pillarId) => pillarIds.includes(pillarId)),
      summary: `Review ${sourceSummary} and connect them to the operating thesis.`,
      latencyMs: 60 + (signals.length * 12),
    },
    {
      id: "governance-gate",
      label: "Governance Gate",
      stage: "governance" as const,
      ownerCommitteeId: "founder-council",
      pillarIds: ["governance", "compliance-risk"].filter((pillarId) => pillarIds.includes(pillarId)),
      summary: "Evaluate payment-bearing objective, risk tier, and skill eligibility before execution.",
      latencyMs: 50 + (riskTier === "high" ? 40 : 10),
    },
    {
      id: "execution-assembly",
      label: "Sunnyvale Run",
      stage: "execution" as const,
      ownerCommitteeId: "execution-board",
      pillarIds: pillarIds.filter((pillarId) => ["engineering", "operations", "sales", "growth"].includes(pillarId)),
      summary: `Assign ${workflowIds.length} workflows and ${skillIds.length} approved skills to the run contract.`,
      latencyMs: 75 + (workflowIds.length * 15),
    },
    {
      id: "archive-commit",
      label: "Archive Writeback",
      stage: "evidence" as const,
      ownerCommitteeId: "execution-board",
      pillarIds: ["operations", "governance"],
      summary: "Write compiled artifact, evidence references, and next actions into replayable memory.",
      latencyMs: 35 + (signals.length * 5),
    },
  ];

  return {
    title,
    intent,
    objective: trimText(intent, 240),
    pricingModel: pillarIds.includes("sales") || pillarIds.includes("growth") ? "Subscription + operator usage tiers" : "Platform license + advisory retainer",
    payingUser: pillarIds.includes("compliance-risk") ? "Regulated operating teams needing governed execution" : "Operator teams buying governed execution and live evidence",
    status: "review",
    revision: 1,
    riskTier,
    pillars: pillarIds,
    committeeIds,
    workflowIds,
    skillIds,
    escalationRuleIds,
    graph: {
      nodes: graphNodes,
      edges: graphNodes.slice(1).map((node, index) => ({
        from: graphNodes[index].id,
        to: node.id,
      })),
    },
    votes,
    guardrails: [
      "Runs must use only approved skills mapped to the active pillars.",
      "No plan is admitted without committee ownership and live evidence references.",
      "Archive writeback is mandatory before a run is considered complete.",
      "Plans may only activate governance objects that already exist in the registry.",
      "New committees, skills, or workflows must remain proposed until founder approval updates the registry.",
      signals.length > 0 ? `Maintain traceability to ${signals.length} live research signals.` : "Block high-risk runs when no live research signals are available.",
    ],
    successMetrics: [
      "Plan review is readable before execution.",
      "Approved run emits compiled artifact and archive record.",
      "Research references remain live and attributable.",
      "Governance proposals are explicit and never auto-activated.",
      pillarIds.includes("sales") ? "Buyer-facing next action is explicit." : "Institutional next action is explicit.",
    ],
    researchQuery,
    researchReferences,
    proposals,
  };
}

async function generatePlan(intent: string): Promise<Omit<InstitutionalPlan, "id" | "createdAt">> {
  const researchQuery = buildResearchQuery(intent);
  const researchContext = await fetchLiveResearch(researchQuery, 3);

  if (researchContext.signals.length > 0) {
    state.researchSignals = researchContext.signals;
    state.researchStatus = researchContext.statuses;
    pushWindow(state.stats.researchRefreshDurationsMs, researchContext.durationMs);
    state.stats.lastResearchSyncAt = now();
    captureMetricHistory();
    void persistState();
  }

  const deterministicPlan = buildDeterministicPlan(intent, researchQuery, researchContext.signals);
  if (!ai) {
    return deterministicPlan;
  }

  try {
    const referenceBlock = deterministicPlan.researchReferences
      ?.map((reference, index) => `${index + 1}. ${reference.source}: ${reference.title}`)
      .join("\n") || "No live references were available.";

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{
            text: [
              "Convert the founder intent into a UACP V3 institutional plan.",
              `Intent: ${intent}`,
              `Research query: ${researchQuery}`,
              `Live references:\n${referenceBlock}`,
              `Available pillars: ${activePillars().map((pillar) => pillar.id).join(", ")}`,
              `Available committees: ${activeCommittees().map((committee) => committee.id).join(", ")}`,
              `Available workflows: ${activeWorkflows().map((workflow) => workflow.id).join(", ")}`,
              `Available approved skills: ${activeSkills().filter((skill) => skill.status === "approved").map((skill) => skill.id).join(", ")}`,
              `Available escalation rules: ${activeEscalationRules().map((rule) => rule.id).join(", ")}`,
              "Return an institutional plan grounded in the live references. Only activate listed registry objects. If you need a new committee, skill, or workflow, put it in proposals instead of the active selections.",
            ].join("\n\n"),
          }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            objective: { type: Type.STRING },
            pricingModel: { type: Type.STRING },
            payingUser: { type: Type.STRING },
            riskTier: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
            pillars: { type: Type.ARRAY, items: { type: Type.STRING } },
            committeeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            workflowIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            skillIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            escalationRuleIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            graph: {
              type: Type.OBJECT,
              properties: {
                nodes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      label: { type: Type.STRING },
                      stage: { type: Type.STRING, enum: ["intent", "reasoning", "governance", "execution", "evidence", "continuity"] },
                      ownerCommitteeId: { type: Type.STRING },
                      pillarIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      summary: { type: Type.STRING },
                      latencyMs: { type: Type.NUMBER },
                    },
                    required: ["id", "label", "stage", "ownerCommitteeId", "pillarIds", "summary", "latencyMs"],
                  },
                },
                edges: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      from: { type: Type.STRING },
                      to: { type: Type.STRING },
                    },
                    required: ["from", "to"],
                  },
                },
              },
              required: ["nodes", "edges"],
            },
            votes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  member: { type: Type.STRING },
                  model: { type: Type.STRING },
                  vote: { type: Type.STRING, enum: ["approve", "challenge", "veto"] },
                  rationale: { type: Type.STRING },
                },
                required: ["member", "model", "vote", "rationale"],
              },
            },
            guardrails: { type: Type.ARRAY, items: { type: Type.STRING } },
            successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } },
            proposals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["committee", "skill", "workflow"] },
                  name: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                },
                required: ["type", "name", "rationale"],
              },
            },
          },
          required: ["title", "objective", "pricingModel", "payingUser", "riskTier", "pillars", "committeeIds", "workflowIds", "skillIds", "escalationRuleIds", "graph", "votes", "guardrails", "successMetrics"],
        },
      },
    });

    const parsed = JSON.parse(result.text || "{}");
    const modelProposals = sanitizeProposals(parsed.proposals);
    const inferredProposals = [
      ...collectUnknownIdProposals(parsed.committeeIds, activeCommittees().map((committee) => committee.id), "committee"),
      ...collectUnknownIdProposals(parsed.workflowIds, activeWorkflows().map((workflow) => workflow.id), "workflow"),
      ...collectUnknownIdProposals(parsed.skillIds, activeSkills().map((skill) => skill.id), "skill"),
    ];
    return {
      ...deterministicPlan,
      ...parsed,
      status: "review",
      revision: 1,
      pillars: sanitizeIds(parsed.pillars, activePillars().map((pillar) => pillar.id), deterministicPlan.pillars),
      committeeIds: sanitizeIds(parsed.committeeIds, activeCommittees().map((committee) => committee.id), deterministicPlan.committeeIds),
      workflowIds: sanitizeIds(parsed.workflowIds, activeWorkflows().map((workflow) => workflow.id), deterministicPlan.workflowIds),
      skillIds: sanitizeIds(parsed.skillIds, activeSkills().filter((skill) => skill.status === "approved").map((skill) => skill.id), deterministicPlan.skillIds),
      escalationRuleIds: sanitizeIds(parsed.escalationRuleIds, activeEscalationRules().map((rule) => rule.id), deterministicPlan.escalationRuleIds),
      graph: sanitizeGraph(parsed.graph, deterministicPlan.graph),
      votes: sanitizeVotes(parsed.votes, deterministicPlan.votes),
      guardrails: sanitizeStrings(parsed.guardrails, deterministicPlan.guardrails),
      successMetrics: sanitizeStrings(parsed.successMetrics, deterministicPlan.successMetrics),
      researchQuery,
      researchReferences: deterministicPlan.researchReferences,
      proposals: mergeProposals([...(deterministicPlan.proposals || []), ...modelProposals, ...inferredProposals]),
    };
  } catch {
    return deterministicPlan;
  }
}

function sanitizeIds(candidate: unknown, allowed: string[], baseline: string[]) {
  if (!Array.isArray(candidate)) return baseline;
  const set = new Set(allowed);
  const values = candidate.filter((value): value is string => typeof value === "string" && set.has(value));
  return values.length > 0 ? uniqueStrings(values) : baseline;
}

function sanitizeStrings(candidate: unknown, baseline: string[]) {
  if (!Array.isArray(candidate)) return baseline;
  const values = candidate.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => trimText(value, 180));
  return values.length > 0 ? values : baseline;
}

function sanitizeVotes(candidate: unknown, baseline: CommitteeVote[]) {
  if (!Array.isArray(candidate)) return baseline;
  const votes = candidate
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      member: trimText(String(item.member || "Committee"), 80),
      model: trimText(String(item.model || "gemini-3-flash-preview"), 80),
      vote: item.vote === "approve" || item.vote === "challenge" || item.vote === "veto" ? item.vote : "challenge",
      rationale: trimText(String(item.rationale || "No rationale provided."), 240),
    }));
  return votes.length > 0 ? votes : baseline;
}

function sanitizeProposals(candidate: unknown): GovernanceProposal[] {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const type = item.type === "committee" || item.type === "skill" || item.type === "workflow" ? item.type : "workflow";
      return makeProposal(type, String(item.name || type), String(item.rationale || "Registry proposal requires founder review."));
    });
}

function sanitizeGraph(candidate: any, baseline: InstitutionalPlan["graph"]): InstitutionalPlan["graph"] {
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    return baseline;
  }

  const validCommitteeIds = new Set(activeCommittees().map((committee) => committee.id));
  const validPillarIds = new Set(activePillars().map((pillar) => pillar.id));
  const nodes = candidate.nodes
    .filter((node: any) => node && typeof node === "object")
    .map((node: any, index: number) => ({
      id: trimText(String(node.id || `node-${index + 1}`), 32),
      label: trimText(String(node.label || `Node ${index + 1}`), 80),
      stage: ["intent", "reasoning", "governance", "execution", "evidence", "continuity"].includes(node.stage)
        ? node.stage
        : baseline.nodes[Math.min(index, baseline.nodes.length - 1)]?.stage || "execution",
      ownerCommitteeId: validCommitteeIds.has(node.ownerCommitteeId) ? node.ownerCommitteeId : baseline.nodes[Math.min(index, baseline.nodes.length - 1)]?.ownerCommitteeId || "execution-board",
      pillarIds: Array.isArray(node.pillarIds)
        ? node.pillarIds.filter((pillarId: string) => validPillarIds.has(pillarId))
        : baseline.nodes[Math.min(index, baseline.nodes.length - 1)]?.pillarIds || ["operations"],
      summary: trimText(String(node.summary || baseline.nodes[Math.min(index, baseline.nodes.length - 1)]?.summary || "Institutional execution stage."), 220),
      latencyMs: Number.isFinite(node.latencyMs) ? Math.max(0, Number(node.latencyMs)) : baseline.nodes[Math.min(index, baseline.nodes.length - 1)]?.latencyMs || 60,
    }));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = candidate.edges
    .filter((edge: any) => edge && typeof edge.from === "string" && typeof edge.to === "string" && nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .map((edge: any) => ({ from: edge.from, to: edge.to }));

  return nodes.length > 0 ? { nodes, edges: edges.length > 0 ? edges : baseline.edges } : baseline;
}

function addEvent(type: string, message: string, surface: SurfaceId, metadata?: Record<string, unknown>) {
  const event: EventItem = {
    id: createId("evt"),
    type,
    message,
    timestamp: now(),
    surface,
    metadata,
  };
  state.events = [event, ...state.events].slice(0, MAX_EVENTS);
  broadcast({ type: "event", data: event });
  void persistState();
  return event;
}

function addArchive(entry: Omit<ArchiveEntry, "id" | "createdAt">) {
  const archive: ArchiveEntry = {
    id: createId("arc"),
    createdAt: now(),
    ...entry,
  };
  state.archives = [archive, ...state.archives].slice(0, MAX_ARCHIVES);
  broadcast({ type: "archive", data: archive });
  void persistState();
  return archive;
}

function broadcast(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function upsertWorkerRuntime(nextRuntime: WorkerRuntimeState) {
  state.workerRuntime = [
    nextRuntime,
    ...state.workerRuntime.filter((runtime) => runtime.workerId !== nextRuntime.workerId),
  ];
}

function setWorkerRuntime(workerId: string, patch: Partial<WorkerRuntimeState>) {
  const worker = workerById(workerId);
  if (!worker) return;
  const current = state.workerRuntime.find((runtime) => runtime.workerId === workerId) || makeWorkerRuntime(worker);
  upsertWorkerRuntime({
    ...current,
    ...patch,
    workerId,
  });
}

function normalizeBackendSeverity(value: unknown): BackendProductEvent["severity"] {
  if (value === "critical" || value === "warning" || value === "info") return value;
  return "info";
}

function getPayloadNumber(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const parsed = Number(payload[key]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function classifyBackendEvent(input: {
  eventType: string;
  entityType: string;
  severity: BackendProductEvent["severity"];
  status: string;
  payload: Record<string, unknown>;
}) {
  const text = `${input.eventType} ${input.entityType} ${input.status} ${JSON.stringify(input.payload)}`.toLowerCase();
  const pillars = new Set<string>();
  const committees = new Set<string>();
  const workers = new Set<string>();

  const assign = (pillarIds: string[], committeeIds: string[], workerIds: string[]) => {
    pillarIds.forEach((id) => pillars.add(id));
    committeeIds.forEach((id) => committees.add(id));
    workerIds.forEach((id) => workers.add(id));
  };

  if (/(endpoint|route|pipeline|deploy|deployment|latency|outage|health|regression|auth|ui|experience)/.test(text)) {
    assign(
      ["engineering", "product", "operations"],
      ["experience-assurance"],
      ["sentinel", "mirror", "pulse", "sheriff"],
    );
  }

  if (/(billing|reserve|revenue|subscription|payment|invoice|wallet|margin)/.test(text)) {
    assign(
      ["finance", "sales", "operations"],
      ["marketplace-operations", "governance-evidence"],
      ["gauge", "ledger", "mint"],
    );
  }

  if (/(security|mfa|vault|credential|compliance|privacy|access|permission)/.test(text)) {
    assign(
      ["compliance-risk", "governance"],
      ["governance-evidence", "marketplace-operations"],
      ["bouncer", "ledger", "oracle", "sheriff"],
    );
  }

  if (/(marketplace|install|listing|vendor|partner|queue)/.test(text)) {
    assign(
      ["operations", "sales", "growth"],
      ["marketplace-operations"],
      ["herald", "harvest", "arbiter", "welcome"],
    );
  }

  if (/(workspace|tenant|user|signup|evaluation|onboarding|customer|lead)/.test(text)) {
    assign(
      ["growth", "sales", "product"],
      ["growth-intelligence", "experience-assurance"],
      ["welcome", "signal", "glide", "scout"],
    );
  }

  if (input.severity === "critical") {
    assign(
      ["governance", "compliance-risk"],
      ["governance-evidence"],
      ["ledger", "sheriff"],
    );
  }

  if (pillars.size === 0) {
    assign(["operations", "governance"], ["marketplace-operations"], ["gauge", "ledger"]);
  }

  return {
    pillarIds: [...pillars],
    committeeIds: [...committees],
    workerIds: [...workers],
  };
}

function updateBackendSummaryFromEvent(event: BackendProductEvent) {
  const text = `${event.eventType} ${event.entityType}`.toLowerCase();
  const payload = event.payload;

  if (/(signup|user_created|user_signed_up)/.test(text)) {
    state.backendSummary.signups += 1;
    state.backendSummary.liveUsers += Math.max(1, getPayloadNumber(payload, ["delta_users", "live_users_delta"]) ?? 1);
  }
  if (/(evaluation_started|evaluation|trial_started)/.test(text)) {
    state.backendSummary.evaluationsStarted += 1;
  }
  if (/(run_completed|execution_completed|pipeline_run_completed)/.test(text)) {
    state.backendSummary.runsCompleted += 1;
  }
  if (/(pipeline_test|pipeline)/.test(text)) {
    state.backendSummary.pipelineTests += 1;
  }
  if (/(endpoint_call|endpoint|route)/.test(text)) {
    state.backendSummary.endpointCalls += Math.max(1, getPayloadNumber(payload, ["endpoint_calls", "count"]) ?? 1);
    if (event.status === "failed" || event.severity === "critical") {
      state.backendSummary.failedRoutes += 1;
    }
  }
  if (/(billing|payment|invoice|revenue|subscription)/.test(text)) {
    const revenue = getPayloadNumber(payload, ["revenue", "amount", "amount_usd"]);
    if (typeof revenue === "number") {
      state.backendSummary.revenue = Math.max(0, state.backendSummary.revenue + revenue);
    }
  }
  if (/(reserve|wallet)/.test(text)) {
    const reserve = getPayloadNumber(payload, ["reserve_balance", "reserveBalance", "wallet_balance"]);
    if (typeof reserve === "number") {
      state.backendSummary.reserveBalance = reserve;
    }
  }
  if (/(evidence_export|evidence_bundle|export)/.test(text)) {
    state.backendSummary.evidenceExports += 1;
  }
  if (/(mfa|security|auth)/.test(text)) {
    state.backendSummary.mfaEvents += 1;
  }
  if (/(marketplace_install|install)/.test(text)) {
    state.backendSummary.marketplaceInstalls += 1;
  }

  const liveUsers = getPayloadNumber(payload, ["live_users", "active_users"]);
  if (typeof liveUsers === "number") {
    state.backendSummary.liveUsers = liveUsers;
  }

  state.backendSummary.lastEventAt = event.timestamp;
}

function buildCommandCenterSnapshot(): CommandCenterSnapshot {
  const activeWorkerCount = state.workerRuntime.filter((runtime) => runtime.status === "running").length;
  const pausedWorkerCount = state.workerRuntime.filter((runtime) => runtime.paused).length;
  const openEscalations = state.operatorRuns.filter((run) => run.status === "escalated" || run.escalations.length > 0).length;

  return {
    backend: state.backendSummary,
    institution: {
      workerCount: activeWorkers().length,
      activeWorkerCount,
      pausedWorkerCount,
      operatorRunCount: state.operatorRuns.length,
      openEscalations,
      archiveCount: state.archives.length,
      planCount: state.plans.length,
      governedRunCount: state.runs.length,
    },
  };
}

function workerInputSnapshot(worker: OperatorWorker) {
  const observability = buildEngineObservability();
  const telemetry = buildTelemetry();
  const inputs: string[] = [];

  for (const source of worker.inputSources) {
    if (source === "events") {
      inputs.push(...state.events.slice(0, 5).map((event) => `event:${event.type}:${event.id}`));
    } else if (source === "archives") {
      inputs.push(...state.archives.slice(0, 5).map((archive) => `archive:${archive.id}:${archive.category}`));
    } else if (source === "research-signals") {
      inputs.push(...state.researchSignals.slice(0, 5).map((signal) => `signal:${signal.source}:${signal.id}`));
    } else if (source === "research-status") {
      inputs.push(...state.researchStatus.map((status) => `source:${status.id}:${status.status}`));
    } else if (source === "plans") {
      inputs.push(...state.plans.slice(0, 4).map((plan) => `plan:${plan.id}:${plan.status}`));
    } else if (source === "runs") {
      inputs.push(...state.runs.slice(0, 4).map((run) => `run:${run.id}:${run.status}`));
    } else if (source === "telemetry") {
      inputs.push(`telemetry:determinism:${telemetry.determinismScore.toFixed(3)}`);
      inputs.push(`telemetry:policy:${telemetry.policyAlignment.toFixed(3)}`);
      inputs.push(`telemetry:archive:${telemetry.archiveCoverage.toFixed(3)}`);
    } else if (source === "observability") {
      inputs.push(`observability:pressure:${observability.uacp_pressure.toFixed(3)}`);
      inputs.push(`observability:latency:${observability.classical_latency}`);
    } else if (source === "backend-events") {
      inputs.push(...state.backendEvents.slice(0, 5).map((event) => `backend:${event.eventType}:${event.eventId}`));
    } else if (source === "backend-summary") {
      inputs.push(`backend:liveUsers:${state.backendSummary.liveUsers}`);
      inputs.push(`backend:reserve:${state.backendSummary.reserveBalance}`);
    }
  }

  return uniqueStrings(inputs).slice(0, 12);
}

function determineWorkerEscalations(worker: OperatorWorker) {
  const escalations: string[] = [];

  if (worker.escalationRuleId === "missing-live-evidence" && state.researchSignals.length === 0) {
    escalations.push("missing-live-evidence");
  }
  if (
    worker.escalationRuleId === "regulated-objective-review" &&
    (state.plans.some((plan) => plan.riskTier === "high" || plan.riskTier === "critical") ||
      state.backendEvents.some((event) => event.severity === "critical"))
  ) {
    escalations.push("regulated-objective-review");
  }
  if (
    worker.escalationRuleId === "unapproved-skill-attempt" &&
    state.plans.some((plan) => (plan.proposals || []).some((proposal) => proposal.type === "skill"))
  ) {
    escalations.push("unapproved-skill-attempt");
  }

  if (state.runs.some((run) => run.status === "failed" || run.status === "blocked")) {
    escalations.push("execution-floor-attention");
  }

  return uniqueStrings(escalations);
}

function determineWorkerActions(worker: OperatorWorker, escalations: string[]) {
  if (escalations.length > 0) {
    return worker.allowedActions
      .filter((action) => /(flag|escalat|deny|verify|write|open)/.test(action))
      .slice(0, 3);
  }

  if (state.backendEvents.some((event) => event.workerIds.includes(worker.id))) {
    return worker.allowedActions
      .filter((action) => /(write|recommend|route|compare|measure|scan|summarize|verify)/.test(action))
      .slice(0, 3);
  }

  return worker.allowedActions.slice(0, Math.min(3, worker.allowedActions.length));
}

function determineWorkerRecommendation(worker: OperatorWorker, escalations: string[]) {
  if (escalations.length > 0) {
    return `${worker.displayName} raised ${escalations.join(", ")}. Founder review or committee intervention is required before the next scheduled run.`;
  }

  if (state.backendEvents.some((event) => event.workerIds.includes(worker.id))) {
    return `${worker.displayName} should continue monitoring assigned backend truth and write the next governed update on schedule.`;
  }

  return `${worker.displayName} should maintain heartbeat discipline and wait for the next scheduled operating window.`;
}

function queueOperatorRun(workerId: string, trigger: "manual" | "scheduled" | "backend-event", inputHint?: string) {
  const worker = workerById(workerId);
  if (!worker) {
    throw new Error(`Unknown worker ${workerId}.`);
  }

  const runtime = state.workerRuntime.find((entry) => entry.workerId === workerId) || makeWorkerRuntime(worker);
  if (runtime.paused) {
    throw new Error(`${worker.displayName} is paused and cannot be scheduled.`);
  }
  if (state.operatorRuns.some((run) => run.workerId === workerId && (run.status === "queued" || run.status === "running"))) {
    throw new Error(`${worker.displayName} already has an active operator run.`);
  }

  const committee = operatorCommitteeById(worker.committeeId);
  const run: OperatorRun = {
    id: createId("oprun"),
    workerId: worker.id,
    committeeId: worker.committeeId,
    pillarId: worker.primaryPillar,
    startedAt: now(),
    status: "queued",
    inputs: inputHint ? [inputHint] : [],
    actionsTaken: [],
    evidenceCreated: [],
    archiveRef: undefined,
    escalations: [],
    errors: [],
    nextRecommendation: `${worker.displayName} is queued for ${trigger} execution.`,
  };

  state.operatorRuns = [run, ...state.operatorRuns].slice(0, MAX_OPERATOR_RUNS);
  setWorkerRuntime(worker.id, {
    status: "running",
    paused: false,
    lastHeartbeatAt: now(),
    lastRunId: run.id,
  });
  addEvent("WORKER_RUN_QUEUED", `${worker.displayName} queued for ${trigger} execution.`, "silicon-valley", {
    workerId: worker.id,
    committeeId: committee?.id,
    runId: run.id,
    trigger,
  });
  broadcast({ type: "operator_run_update", data: run });
  void persistState();
  void executeOperatorRun(run.id);
  return run;
}

async function executeOperatorRun(runId: string) {
  const run = state.operatorRuns.find((entry) => entry.id === runId);
  if (!run) return;
  const worker = workerById(run.workerId);
  if (!worker) return;

  try {
    const inputs = uniqueStrings([...run.inputs, ...workerInputSnapshot(worker)]);
    const escalations = determineWorkerEscalations(worker);
    const actionsTaken = determineWorkerActions(worker, escalations);
    const nextRecommendation = determineWorkerRecommendation(worker, escalations);
    const committee = operatorCommitteeById(worker.committeeId);

    run.status = escalations.length > 0 ? "escalated" : "running";
    run.inputs = inputs;
    run.actionsTaken = actionsTaken;
    run.escalations = escalations;
    run.nextRecommendation = nextRecommendation;
    setWorkerRuntime(worker.id, {
      status: escalations.length > 0 ? "error" : "running",
      paused: false,
      lastHeartbeatAt: now(),
      lastRunAt: now(),
      lastRunId: run.id,
      lastError: escalations.length > 0 ? escalations.join(", ") : undefined,
    });
    broadcast({ type: "operator_run_update", data: run });

    const archive = addArchive({
      title: `${worker.displayName} ${worker.outputArtifact}`,
      category: "run",
      summary: `${worker.displayName} executed under ${committee?.name || worker.committeeId} using ${inputs.length} live inputs and ${actionsTaken.length} governed actions.`,
      lineage: [run.id, worker.id, worker.committeeId, worker.primaryPillar],
      metadata: {
        workerId: worker.id,
        committeeId: worker.committeeId,
        trigger: run.inputs[0] || "scheduled",
        inputs,
        actionsTaken,
        escalations,
        nextRecommendation,
      },
    });

    run.archiveRef = archive.id;
    run.evidenceCreated = [archive.id];
    run.completedAt = now();
    run.status = escalations.length > 0 ? "escalated" : "completed";
    run.nextRecommendation = nextRecommendation;
    setWorkerRuntime(worker.id, {
      status: escalations.length > 0 ? "error" : "idle",
      paused: false,
      lastHeartbeatAt: now(),
      lastRunAt: run.completedAt,
      lastRunId: run.id,
      nextRunAt: isoAfterMinutes(worker.intervalMinutes),
      lastError: escalations.length > 0 ? escalations.join(", ") : undefined,
    });

    addEvent(worker.archiveEventType.toUpperCase(), `${worker.displayName} completed a governed operator run.`, "silicon-valley", {
      workerId: worker.id,
      runId: run.id,
      archiveId: archive.id,
      escalations,
    });
    broadcast({ type: "operator_run_update", data: run });
    captureMetricHistory();
    await persistState();
  } catch (error) {
    run.status = "failed";
    run.completedAt = now();
    run.errors = [error instanceof Error ? error.message : "Unknown worker runtime failure."];
    run.nextRecommendation = `${worker.displayName} failed and requires operator review before the next heartbeat.`;
    setWorkerRuntime(worker.id, {
      status: "error",
      paused: false,
      lastHeartbeatAt: now(),
      lastRunAt: run.completedAt,
      lastRunId: run.id,
      nextRunAt: isoAfterMinutes(worker.intervalMinutes),
      lastError: run.errors.join(", "),
    });
    addEvent("WORKER_RUN_FAILED", `${worker.displayName} failed during operator execution.`, "silicon-valley", {
      workerId: worker.id,
      runId: run.id,
      errors: run.errors,
    });
    broadcast({ type: "operator_run_update", data: run });
    await persistState();
  }
}

async function operatorSchedulerTick() {
  const dueWorkers = state.workerRuntime
    .filter((runtime) => !runtime.paused && runtime.nextRunAt && new Date(runtime.nextRunAt).getTime() <= Date.now())
    .map((runtime) => runtime.workerId)
    .filter((workerId) => minimumLiveWorkerIds().includes(workerId));

  for (const workerId of dueWorkers) {
    try {
      queueOperatorRun(workerId, "scheduled", "scheduled-heartbeat");
    } catch {
      continue;
    }
  }
}

function ingestBackendEvent(candidate: unknown) {
  const record = ensureRecord(candidate, "backendEvent");
  const eventType = ensureString(record.event_type ?? record.eventType, "backendEvent.event_type");
  const entityType = ensureString(record.entity_type ?? record.entityType, "backendEvent.entity_type");
  const entityId = ensureString(record.entity_id ?? record.entityId, "backendEvent.entity_id");
  const status = ensureString(record.status, "backendEvent.status");
  const timestamp = parseDate(record.timestamp ?? now());
  const payload = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
    ? record.payload as Record<string, unknown>
    : {};
  const severity = normalizeBackendSeverity(record.severity);
  const assignment = classifyBackendEvent({ eventType, entityType, severity, status, payload });

  const event: BackendProductEvent = {
    eventId: ensureString(record.event_id ?? record.eventId ?? createId("bevt"), "backendEvent.event_id"),
    eventType,
    source: "backend",
    workspaceId: typeof record.workspace_id === "string" ? record.workspace_id : typeof record.workspaceId === "string" ? record.workspaceId : undefined,
    tenantId: typeof record.tenant_id === "string" ? record.tenant_id : typeof record.tenantId === "string" ? record.tenantId : undefined,
    userId: typeof record.user_id === "string" ? record.user_id : typeof record.userId === "string" ? record.userId : undefined,
    entityType,
    entityId,
    severity,
    status,
    timestamp,
    payload,
    pillarIds: assignment.pillarIds,
    committeeIds: assignment.committeeIds,
    workerIds: assignment.workerIds.filter((workerId) => Boolean(workerById(workerId))),
    archiveId: undefined,
  };

  updateBackendSummaryFromEvent(event);
  const archive = addArchive({
    title: `Backend event ${event.eventType}`,
    category: "research",
    summary: `Backend truth reported ${event.eventType} on ${event.entityType}/${event.entityId} with severity ${event.severity}.`,
    lineage: [event.eventId, event.entityId, ...(event.workspaceId ? [event.workspaceId] : [])],
    metadata: { backendEvent: event as unknown },
  });
  event.archiveId = archive.id;
  state.backendEvents = [event, ...state.backendEvents.filter((entry) => entry.eventId !== event.eventId)].slice(0, MAX_BACKEND_EVENTS);
  addEvent("BACKEND_EVENT_INGESTED", `${event.eventType} mapped to ${event.workerIds.length} workers.`, "silicon-valley", {
    eventId: event.eventId,
    entityType: event.entityType,
    workerIds: event.workerIds,
  });
  broadcast({ type: "backend_event", data: event });
  for (const workerId of event.workerIds.slice(0, 3)) {
    try {
      queueOperatorRun(workerId, "backend-event", `backend-event:${event.eventType}:${event.eventId}`);
    } catch {
      continue;
    }
  }
  void persistState();
  return event;
}

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeState>;
    state = {
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      operatorRuns: Array.isArray(parsed.operatorRuns) ? parsed.operatorRuns : [],
      workerRuntime: Array.isArray(parsed.workerRuntime) ? parsed.workerRuntime : [],
      backendEvents: Array.isArray(parsed.backendEvents) ? parsed.backendEvents : [],
      backendSummary: parsed.backendSummary && typeof parsed.backendSummary === "object"
        ? {
            ...emptyBackendTruthSummary(),
            ...parsed.backendSummary,
          }
        : emptyBackendTruthSummary(),
      events: Array.isArray(parsed.events) ? parsed.events : [],
      archives: Array.isArray(parsed.archives) ? parsed.archives : [],
      researchSignals: Array.isArray(parsed.researchSignals) ? parsed.researchSignals : [],
      researchStatus: Array.isArray(parsed.researchStatus) ? parsed.researchStatus : [],
      stats: {
        planCompileDurationsMs: Array.isArray(parsed.stats?.planCompileDurationsMs) ? parsed.stats?.planCompileDurationsMs : [],
        runDurationsMs: Array.isArray(parsed.stats?.runDurationsMs) ? parsed.stats?.runDurationsMs : [],
        researchRefreshDurationsMs: Array.isArray(parsed.stats?.researchRefreshDurationsMs) ? parsed.stats?.researchRefreshDurationsMs : [],
        determinismHistory: Array.isArray(parsed.stats?.determinismHistory) ? parsed.stats?.determinismHistory : [],
        runCompletionHistory: Array.isArray(parsed.stats?.runCompletionHistory) ? parsed.stats?.runCompletionHistory : [],
        policyAlignmentHistory: Array.isArray(parsed.stats?.policyAlignmentHistory) ? parsed.stats?.policyAlignmentHistory : [],
        archiveCoverageHistory: Array.isArray(parsed.stats?.archiveCoverageHistory) ? parsed.stats?.archiveCoverageHistory : [],
        sourceHealthHistory: Array.isArray(parsed.stats?.sourceHealthHistory) ? parsed.stats?.sourceHealthHistory : [],
        pressureHistory: Array.isArray(parsed.stats?.pressureHistory) ? parsed.stats?.pressureHistory : [],
        lastResearchSyncAt: parsed.stats?.lastResearchSyncAt,
        lastGovernanceRegistryHash: parsed.stats?.lastGovernanceRegistryHash,
        lastGovernanceRegistrySyncAt: parsed.stats?.lastGovernanceRegistrySyncAt,
      },
    };
    syncWorkerRuntimeState();
  } catch {
    state = emptyState();
    syncWorkerRuntimeState();
  }
}

function persistState() {
  persistQueue = persistQueue
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
    })
    .catch((error) => {
      console.error("State persistence error:", error);
    });
  return persistQueue;
}

function ensureRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function ensureString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function ensureStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return uniqueStrings(value.map((entry) => entry.trim()));
}

function ensureNumber(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return parsed;
}

function ensureUniqueIds<T extends { id: string }>(items: T[], label: string) {
  const ids = items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} contains duplicate ids.`);
  }
}

function parsePillars(value: unknown): Pillar[] {
  if (!Array.isArray(value)) throw new Error("Governance registry pillars must be an array.");
  const pillars = value.map((entry, index) => {
    const record = ensureRecord(entry, `pillar[${index}]`);
    return {
      id: ensureString(record.id, `pillar[${index}].id`),
      name: ensureString(record.name, `pillar[${index}].name`),
      mandate: ensureString(record.mandate, `pillar[${index}].mandate`),
      kpi: ensureString(record.kpi, `pillar[${index}].kpi`),
    } satisfies Pillar;
  });
  ensureUniqueIds(pillars, "Governance registry pillars");
  return pillars;
}

function parseCommittees(value: unknown, pillarIds: Set<string>): Committee[] {
  if (!Array.isArray(value)) throw new Error("Governance registry committees must be an array.");
  const committees = value.map((entry, index) => {
    const record = ensureRecord(entry, `committee[${index}]`);
    const linkedPillars = ensureStringArray(record.pillarIds, `committee[${index}].pillarIds`);
    if (linkedPillars.some((pillarId) => !pillarIds.has(pillarId))) {
      throw new Error(`committee[${index}] references unknown pillar ids.`);
    }
    return {
      id: ensureString(record.id, `committee[${index}].id`),
      name: ensureString(record.name, `committee[${index}].name`),
      purpose: ensureString(record.purpose, `committee[${index}].purpose`),
      authority: ensureString(record.authority, `committee[${index}].authority`),
      chair: ensureString(record.chair, `committee[${index}].chair`),
      members: ensureStringArray(record.members, `committee[${index}].members`),
      escalation: ensureString(record.escalation, `committee[${index}].escalation`),
      allowedActions: ensureStringArray(record.allowedActions, `committee[${index}].allowedActions`),
      vetoConditions: ensureStringArray(record.vetoConditions, `committee[${index}].vetoConditions`),
      pillarIds: linkedPillars,
    } satisfies Committee;
  });
  ensureUniqueIds(committees, "Governance registry committees");
  return committees;
}

function parseSkills(value: unknown, pillarIds: Set<string>): SkillArtifact[] {
  if (!Array.isArray(value)) throw new Error("Governance registry skills must be an array.");
  const skills = value.map((entry, index) => {
    const record = ensureRecord(entry, `skill[${index}]`);
    const linkedPillars = ensureStringArray(record.pillarIds, `skill[${index}].pillarIds`);
    if (linkedPillars.some((pillarId) => !pillarIds.has(pillarId))) {
      throw new Error(`skill[${index}] references unknown pillar ids.`);
    }
    const status = ensureString(record.status, `skill[${index}].status`);
    if (!["approved", "review", "quarantined"].includes(status)) {
      throw new Error(`skill[${index}].status is invalid.`);
    }
    return {
      id: ensureString(record.id, `skill[${index}].id`),
      name: ensureString(record.name, `skill[${index}].name`),
      category: ensureString(record.category, `skill[${index}].category`),
      description: ensureString(record.description, `skill[${index}].description`),
      allowedTools: ensureStringArray(record.allowedTools, `skill[${index}].allowedTools`),
      source: ensureString(record.source, `skill[${index}].source`),
      ref: ensureString(record.ref, `skill[${index}].ref`),
      treeSha: ensureString(record.treeSha, `skill[${index}].treeSha`),
      status: status as SkillArtifact["status"],
      pillarIds: linkedPillars,
    } satisfies SkillArtifact;
  });
  ensureUniqueIds(skills, "Governance registry skills");
  return skills;
}

function parseWorkflows(value: unknown, pillarIds: Set<string>): WorkflowArtifact[] {
  if (!Array.isArray(value)) throw new Error("Governance registry workflows must be an array.");
  const workflows = value.map((entry, index) => {
    const record = ensureRecord(entry, `workflow[${index}]`);
    const linkedPillars = ensureStringArray(record.pillarIds, `workflow[${index}].pillarIds`);
    if (linkedPillars.some((pillarId) => !pillarIds.has(pillarId))) {
      throw new Error(`workflow[${index}] references unknown pillar ids.`);
    }
    return {
      id: ensureString(record.id, `workflow[${index}].id`),
      name: ensureString(record.name, `workflow[${index}].name`),
      category: ensureString(record.category, `workflow[${index}].category`),
      description: ensureString(record.description, `workflow[${index}].description`),
      outcome: ensureString(record.outcome, `workflow[${index}].outcome`),
      pillarIds: linkedPillars,
    } satisfies WorkflowArtifact;
  });
  ensureUniqueIds(workflows, "Governance registry workflows");
  return workflows;
}

function parseEscalationRules(value: unknown, pillarIds: Set<string>, committeeIds: Set<string>): EscalationRule[] {
  if (!Array.isArray(value)) throw new Error("Governance registry escalationRules must be an array.");
  const rules = value.map((entry, index) => {
    const record = ensureRecord(entry, `escalationRule[${index}]`);
    const route = ensureStringArray(record.route, `escalationRule[${index}].route`);
    const linkedPillars = ensureStringArray(record.pillarIds, `escalationRule[${index}].pillarIds`);
    if (route.some((committeeId) => !committeeIds.has(committeeId))) {
      throw new Error(`escalationRule[${index}] references unknown route committees.`);
    }
    if (linkedPillars.some((pillarId) => !pillarIds.has(pillarId))) {
      throw new Error(`escalationRule[${index}] references unknown pillar ids.`);
    }
    const severity = ensureString(record.severity, `escalationRule[${index}].severity`);
    if (!["low", "medium", "high", "critical"].includes(severity)) {
      throw new Error(`escalationRule[${index}].severity is invalid.`);
    }
    const ownerCommitteeId = ensureString(record.ownerCommitteeId, `escalationRule[${index}].ownerCommitteeId`);
    if (!committeeIds.has(ownerCommitteeId)) {
      throw new Error(`escalationRule[${index}] references unknown owner committee.`);
    }
    return {
      id: ensureString(record.id, `escalationRule[${index}].id`),
      name: ensureString(record.name, `escalationRule[${index}].name`),
      description: ensureString(record.description, `escalationRule[${index}].description`),
      trigger: ensureString(record.trigger, `escalationRule[${index}].trigger`),
      route,
      severity: severity as RiskTier,
      ownerCommitteeId,
      pillarIds: linkedPillars,
    } satisfies EscalationRule;
  });
  ensureUniqueIds(rules, "Governance registry escalation rules");
  return rules;
}

function parseOperatorCommittees(value: unknown, pillarIds: Set<string>): OperatorCommittee[] {
  if (!Array.isArray(value)) throw new Error("Governance registry operatorCommittees must be an array.");
  const operatorCommittees = value.map((entry, index) => {
    const record = ensureRecord(entry, `operatorCommittee[${index}]`);
    const linkedPillars = ensureStringArray(record.pillarIds, `operatorCommittee[${index}].pillarIds`);
    if (linkedPillars.some((pillarId) => !pillarIds.has(pillarId))) {
      throw new Error(`operatorCommittee[${index}] references unknown pillar ids.`);
    }
    return {
      id: ensureString(record.id, `operatorCommittee[${index}].id`),
      name: ensureString(record.name, `operatorCommittee[${index}].name`),
      purpose: ensureString(record.purpose, `operatorCommittee[${index}].purpose`),
      pillarIds: linkedPillars,
      workerIds: ensureStringArray(record.workerIds, `operatorCommittee[${index}].workerIds`),
    } satisfies OperatorCommittee;
  });
  ensureUniqueIds(operatorCommittees, "Governance registry operator committees");
  return operatorCommittees;
}

function parseWorkers(
  value: unknown,
  pillarIds: Set<string>,
  operatorCommitteeIds: Set<string>,
  escalationRuleIds: Set<string>,
): OperatorWorker[] {
  if (!Array.isArray(value)) throw new Error("Governance registry workers must be an array.");
  const workers = value.map((entry, index) => {
    const record = ensureRecord(entry, `worker[${index}]`);
    const committeeId = ensureString(record.committeeId, `worker[${index}].committeeId`);
    if (!operatorCommitteeIds.has(committeeId)) {
      throw new Error(`worker[${index}] references unknown operator committee.`);
    }
    const primaryPillar = ensureString(record.primaryPillar, `worker[${index}].primaryPillar`);
    if (!pillarIds.has(primaryPillar)) {
      throw new Error(`worker[${index}] references unknown primary pillar.`);
    }
    const secondaryPillars = ensureStringArray(record.secondaryPillars, `worker[${index}].secondaryPillars`);
    if (secondaryPillars.some((pillarId) => !pillarIds.has(pillarId))) {
      throw new Error(`worker[${index}] references unknown secondary pillar ids.`);
    }
    const escalationRuleId = ensureString(record.escalationRuleId, `worker[${index}].escalationRuleId`);
    if (!escalationRuleIds.has(escalationRuleId)) {
      throw new Error(`worker[${index}] references unknown escalation rule.`);
    }
    const intervalMinutes = Math.max(1, Math.round(ensureNumber(record.intervalMinutes, `worker[${index}].intervalMinutes`)));

    return {
      id: ensureString(record.id, `worker[${index}].id`),
      displayName: ensureString(record.displayName, `worker[${index}].displayName`),
      committeeId,
      primaryPillar,
      secondaryPillars,
      purpose: ensureString(record.purpose, `worker[${index}].purpose`),
      schedule: ensureString(record.schedule, `worker[${index}].schedule`),
      intervalMinutes,
      inputSources: ensureStringArray(record.inputSources, `worker[${index}].inputSources`),
      allowedActions: ensureStringArray(record.allowedActions, `worker[${index}].allowedActions`),
      forbiddenActions: ensureStringArray(record.forbiddenActions, `worker[${index}].forbiddenActions`),
      outputArtifact: ensureString(record.outputArtifact, `worker[${index}].outputArtifact`),
      archiveEventType: ensureString(record.archiveEventType, `worker[${index}].archiveEventType`),
      escalationRuleId,
      statusFields: ensureStringArray(record.statusFields, `worker[${index}].statusFields`),
      requiredSecrets: Array.isArray(record.requiredSecrets)
        ? ensureStringArray(record.requiredSecrets, `worker[${index}].requiredSecrets`)
        : [],
    } satisfies OperatorWorker;
  });
  ensureUniqueIds(workers, "Governance registry workers");
  return workers;
}

function validateGovernanceRegistry(candidate: unknown): GovernanceRegistry {
  const record = ensureRecord(candidate, "governanceRegistry");
  const version = ensureString(record.version, "governanceRegistry.version");
  const updatedAt = parseDate(ensureString(record.updatedAt, "governanceRegistry.updatedAt"));
  const updatedBy = ensureString(record.updatedBy, "governanceRegistry.updatedBy");
  const pillars = parsePillars(record.pillars);
  const pillarIds = new Set(pillars.map((pillar) => pillar.id));
  const committees = parseCommittees(record.committees, pillarIds);
  const committeeIds = new Set(committees.map((committee) => committee.id));
  const skills = parseSkills(record.skills, pillarIds);
  const workflows = parseWorkflows(record.workflows, pillarIds);
  const escalationRules = parseEscalationRules(record.escalationRules, pillarIds, committeeIds);
  const escalationRuleIds = new Set(escalationRules.map((rule) => rule.id));
  const operatorCommittees = parseOperatorCommittees(record.operatorCommittees, pillarIds);
  const operatorCommitteeIds = new Set(operatorCommittees.map((committee) => committee.id));
  const workers = parseWorkers(record.workers, pillarIds, operatorCommitteeIds, escalationRuleIds);
  const workerIds = new Set(workers.map((worker) => worker.id));
  const minimumLiveWorkerIds = ensureStringArray(record.minimumLiveWorkerIds, "governanceRegistry.minimumLiveWorkerIds");

  if (minimumLiveWorkerIds.some((workerId) => !workerIds.has(workerId))) {
    throw new Error("minimumLiveWorkerIds references unknown workers.");
  }

  for (const operatorCommittee of operatorCommittees) {
    if (operatorCommittee.workerIds.some((workerId) => !workerIds.has(workerId))) {
      throw new Error(`operatorCommittee ${operatorCommittee.id} references unknown workers.`);
    }
  }

  return {
    version,
    updatedAt,
    updatedBy,
    pillars,
    committees,
    skills,
    workflows,
    escalationRules,
    operatorCommittees,
    workers,
    minimumLiveWorkerIds,
  };
}

function governanceRegistryHash(registry: GovernanceRegistry) {
  return crypto.createHash("sha256").update(JSON.stringify(registry)).digest("hex");
}

async function persistGovernanceRegistry() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REGISTRY_FILE, JSON.stringify(governanceRegistry, null, 2), "utf8");
}

async function recordGovernanceRegistrySync(reason: string) {
  const hash = governanceRegistryHash(governanceRegistry);
  const previousHash = state.stats.lastGovernanceRegistryHash;
  const changed = previousHash !== hash;
  state.stats.lastGovernanceRegistryHash = hash;
  state.stats.lastGovernanceRegistrySyncAt = now();
  await persistState();

  if (!changed) return;

  const summary = `Governance registry ${governanceRegistry.version} synced with ${governanceRegistry.pillars.length} pillars, ${governanceRegistry.committees.length} governance committees, ${governanceRegistry.operatorCommittees.length} operator committees, ${governanceRegistry.workers.length} named workers, ${governanceRegistry.skills.length} skills, ${governanceRegistry.workflows.length} workflows, and ${governanceRegistry.escalationRules.length} escalation rules.`;
  addArchive({
    title: `Governance registry ${governanceRegistry.version}`,
    category: "policy",
    summary,
    lineage: [`registry:${hash}`],
    metadata: {
      reason,
      hash,
      previousHash,
      updatedAt: governanceRegistry.updatedAt,
      updatedBy: governanceRegistry.updatedBy,
      registry: governanceRegistry,
    },
  });
  addEvent("GOVERNANCE_REGISTRY_SYNCED", summary, "silicon-valley", {
    reason,
    hash,
    previousHash,
    version: governanceRegistry.version,
    updatedBy: governanceRegistry.updatedBy,
  });
}

async function loadGovernanceRegistry() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(REGISTRY_FILE, "utf8");
    governanceRegistry = validateGovernanceRegistry(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      governanceRegistry = cloneRegistry(defaultGovernanceRegistry);
      await persistGovernanceRegistry();
      return;
    }
    throw new Error(
      `Governance registry failed validation or could not be read: ${
        error instanceof Error ? error.message : "Unknown registry error"
      }`,
    );
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ADMIN_API_KEY) {
    res.status(503).json({ error: "Admin registry editing is disabled until UACP_ADMIN_KEY is configured." });
    return;
  }

  const provided = req.header("x-uacp-admin-key");
  if (provided !== ADMIN_API_KEY) {
    res.status(403).json({ error: "Admin authorization failed." });
    return;
  }

  next();
}

function requireInternal(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!INTERNAL_API_KEY) {
    res.status(503).json({ error: "Internal runtime APIs are disabled until UACP_INTERNAL_API_KEY or UACP_ADMIN_KEY is configured." });
    return;
  }

  const provided = req.header("x-uacp-internal-key");
  if (provided !== INTERNAL_API_KEY) {
    res.status(403).json({ error: "Internal authorization failed." });
    return;
  }

  next();
}

async function refreshBackgroundResearch(reason: "startup" | "scheduled" | "manual") {
  const result = await fetchLiveResearch(DEFAULT_RESEARCH_QUERY, 3);
  state.researchSignals = result.signals;
  state.researchStatus = result.statuses;
  pushWindow(state.stats.researchRefreshDurationsMs, result.durationMs);
  state.stats.lastResearchSyncAt = now();
  captureMetricHistory();
  await persistState();

  const metadata = {
    reason,
    signalCount: result.signals.length,
    onlineSources: result.statuses.filter((status) => status.status === "online").length,
  };

  if (result.signals.length > 0) {
    addEvent("RESEARCH_REFRESHED", `Live research refresh completed with ${result.signals.length} signals.`, "deterministic-engine", metadata);
  } else {
    addEvent("RESEARCH_UNAVAILABLE", "Research refresh completed without any live signals.", "silicon-valley", metadata);
  }
}

function minutesSince(timestamp?: string) {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  const parsed = new Date(timestamp).getTime();
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60));
}

function computeResearchFreshness() {
  const ageMinutes = minutesSince(state.stats.lastResearchSyncAt);
  if (!Number.isFinite(ageMinutes)) return 0.35;
  if (ageMinutes <= 15) return 1;
  if (ageMinutes <= 30) return 0.93;
  if (ageMinutes <= 60) return 0.82;
  if (ageMinutes <= 120) return 0.65;
  return 0.45;
}

function computeWorkerPriming() {
  const minimumLive = minimumLiveWorkerIds();
  if (minimumLive.length === 0) return 0.6;

  const scores = minimumLive.map((workerId) => {
    const worker = workerById(workerId);
    const runtime = state.workerRuntime.find((entry) => entry.workerId === workerId);
    if (!worker || !runtime) return 0.35;

    const freshnessWindow = Math.max(worker.intervalMinutes * 2, 45);
    const heartbeatAge = minutesSince(runtime.lastHeartbeatAt);
    const heartbeatScore = !Number.isFinite(heartbeatAge)
      ? 0.45
      : heartbeatAge <= freshnessWindow
        ? 1
        : heartbeatAge <= freshnessWindow * 2
          ? 0.7
          : 0.4;
    const statusScore =
      runtime.paused
        ? 0.2
        : runtime.status === "error"
          ? 0.15
          : runtime.status === "running"
            ? 1
            : 0.9;

    return clamp((heartbeatScore * 0.55) + (statusScore * 0.45), 0, 1);
  });

  return average(scores) || 0.35;
}

function computeLatestPlanReadiness(researchReadiness: number) {
  const latestPlan = state.plans[0];
  const registryReadiness = activePillars().length > 0 && activeCommittees().length > 0 && activeWorkflows().length > 0 ? 1 : 0.4;

  if (!latestPlan) {
    return clamp((registryReadiness * 0.55) + (researchReadiness * 0.45), 0, 0.9);
  }

  const referencesScore = Math.min(1, (latestPlan.researchReferences?.length || 0) / 4);
  const governanceScore = average([
    latestPlan.guardrails.length > 0 ? 1 : 0.35,
    latestPlan.votes.length > 0 ? 1 : 0.35,
    latestPlan.committeeIds.length > 0 ? 1 : 0.35,
    latestPlan.graph.nodes.length > 0 ? 1 : 0.35,
    latestPlan.pillars.length > 0 ? 1 : 0.35,
  ]);
  const executionScore = average([
    latestPlan.workflowIds.length > 0 ? 1 : 0.4,
    latestPlan.skillIds.length > 0 ? 1 : 0.4,
    latestPlan.escalationRuleIds.length > 0 || latestPlan.riskTier === "low" ? 1 : 0.55,
  ]);
  const proposalPenalty = Math.min(0.3, (latestPlan.proposals?.length || 0) * 0.08);

  return clamp(
    (referencesScore * 0.28) + (governanceScore * 0.34) + (executionScore * 0.28) + (researchReadiness * 0.1) - proposalPenalty,
    0,
    1,
  );
}

function computeLatestRunIntegrity(planReadiness: number) {
  const latestRun = state.runs[0];
  if (!latestRun) {
    return clamp(planReadiness * 0.92, 0.55, 0.95);
  }

  if (latestRun.status === "completed") {
    const artifactScore = latestRun.artifact ? 1 : 0.75;
    const evidenceScore = clamp((latestRun.evidenceCount || 0) / 4, 0.6, 1);
    const stageScore = clamp((latestRun.stages?.length || 0) / 5, 0.6, 1);
    return clamp((artifactScore * 0.45) + (evidenceScore * 0.3) + (stageScore * 0.25), 0, 1);
  }

  if (latestRun.status === "executing" || latestRun.status === "queued") {
    const progressScore = clamp((latestRun.progress || 0) / 100, 0.6, 0.95);
    return clamp((progressScore * 0.65) + (planReadiness * 0.35), 0, 0.96);
  }

  if (latestRun.status === "blocked") return 0.3;
  if (latestRun.status === "failed") return 0.15;
  return clamp(planReadiness * 0.75, 0.25, 0.85);
}

function computeCurrentArchiveCoverage(latestRunIntegrity: number) {
  const latestRun = state.runs[0];
  if (latestRun?.artifact) {
    const archiveLinkScore = latestRun.artifact.archiveRecordIds.length > 0 ? 1 : 0.7;
    return clamp((archiveLinkScore * 0.6) + (latestRunIntegrity * 0.4), 0, 1);
  }

  if (state.archives.length > 0) {
    return clamp(0.8 + Math.min(0.15, state.archives.length * 0.01), 0, 0.95);
  }

  return state.plans.length > 0 ? 0.55 : 0.7;
}

function computeCurrentCommitteeHealth() {
  const latestPlan = state.plans[0];
  if (!latestPlan) {
    return activeCommittees().length > 0 ? 0.95 : 0.4;
  }

  const validAssignments = latestPlan.committeeIds.filter((committeeId) => activeCommittees().some((committee) => committee.id === committeeId)).length;
  const committeeAssignmentScore = validAssignments / Math.max(1, latestPlan.committeeIds.length);
  const voteCoverage = latestPlan.votes.length > 0 ? 1 : 0.45;
  const governanceNodeCoverage = latestPlan.graph.nodes.some((node) => node.stage === "governance") ? 1 : 0.55;
  return clamp(average([committeeAssignmentScore, voteCoverage, governanceNodeCoverage]), 0, 1);
}

function computeTelemetrySnapshot(): TelemetrySnapshot {
  const activeRunCount = state.runs.filter((run) => run.status === "queued" || run.status === "executing").length;
  const sourceAvailability = average(
    state.researchStatus.map((status) => (
      status.status === "online" ? 1 : status.status === "degraded" ? 0.5 : 0
    )),
  ) || 0;
  const researchFreshness = computeResearchFreshness();
  const sourceHealth = clamp((sourceAvailability * 0.55) + (researchFreshness * 0.45), 0, 1);
  const workerPriming = computeWorkerPriming();
  const planReadiness = computeLatestPlanReadiness(sourceHealth);
  const latestRunIntegrity = computeLatestRunIntegrity(planReadiness);
  const committeeHealth = computeCurrentCommitteeHealth();
  const archiveCoverage = computeCurrentArchiveCoverage(latestRunIntegrity);
  const executionPressure = clamp(
    (workerPriming * 0.35) + (planReadiness * 0.25) + (latestRunIntegrity * 0.2) + (sourceHealth * 0.2),
    0,
    1,
  );
  const latestPlan = state.plans[0];
  const complianceScore = latestPlan?.riskTier === "high"
    ? (latestPlan.pillars.includes("compliance-risk") ? 1 : 0.25)
    : 1;
  const proposalScore = latestPlan ? Math.max(0.45, 1 - ((latestPlan.proposals?.length || 0) * 0.12)) : 0.95;
  const policyAlignment = clamp(
    (planReadiness * 0.35) +
      (committeeHealth * 0.2) +
      (sourceHealth * 0.15) +
      (complianceScore * 0.15) +
      (proposalScore * 0.15),
    0,
    1,
  );
  const primeLock =
    sourceHealth >= 0.95 &&
    workerPriming >= 0.95 &&
    planReadiness >= 0.9 &&
    latestRunIntegrity >= 0.95 &&
    archiveCoverage >= 0.95 &&
    policyAlignment >= 0.95;
  const determinismScore = primeLock
    ? 0.99999
    : clamp(
      (workerPriming * 0.22) +
        (sourceHealth * 0.18) +
        (planReadiness * 0.2) +
        (latestRunIntegrity * 0.22) +
        (archiveCoverage * 0.1) +
        (committeeHealth * 0.08),
      0,
      0.99999,
    );
  const runSuccessRate = latestRunIntegrity;
  const runFailureRate = 1 - latestRunIntegrity;
  const latencyMs = Math.round(
    average([...state.stats.planCompileDurationsMs, ...state.stats.runDurationsMs, ...state.stats.researchRefreshDurationsMs].slice(-10)) || 0,
  );

  return {
    latencyMs,
    determinismScore,
    committeeHealth,
    policyAlignment,
    archiveCoverage,
    sourceHealth,
    activeRunCount,
    totalSignals: state.researchSignals.length,
    runSuccessRate,
    runFailureRate,
    researchFreshness,
    workerPriming,
    planReadiness,
    latestRunIntegrity,
    executionPressure,
    lastResearchSyncAt: state.stats.lastResearchSyncAt,
  };
}

function computeUacpPressure(telemetry: TelemetrySnapshot) {
  const escalationPenalty = clamp(
    state.operatorRuns.filter((run) => run.status === "escalated" || run.status === "failed").length / Math.max(1, activeWorkers().length),
    0,
    0.35,
  );
  return clamp(telemetry.executionPressure - escalationPenalty, 0, 1);
}

function captureMetricHistory() {
  const telemetry = computeTelemetrySnapshot();
  const pressure = computeUacpPressure(telemetry);
  pushWindow(state.stats.determinismHistory, telemetry.determinismScore);
  pushWindow(state.stats.runCompletionHistory, telemetry.latestRunIntegrity);
  pushWindow(state.stats.policyAlignmentHistory, telemetry.policyAlignment);
  pushWindow(state.stats.archiveCoverageHistory, telemetry.archiveCoverage);
  pushWindow(state.stats.sourceHealthHistory, telemetry.sourceHealth);
  pushWindow(state.stats.pressureHistory, pressure);
}

function buildTelemetry(): ControlTelemetry {
  const telemetry = computeTelemetrySnapshot();

  return {
    latencyMs: telemetry.latencyMs,
    determinismScore: telemetry.determinismScore,
    committeeHealth: telemetry.committeeHealth,
    policyAlignment: telemetry.policyAlignment,
    archiveCoverage: telemetry.archiveCoverage,
    sourceHealth: telemetry.sourceHealth,
    activeRunCount: telemetry.activeRunCount,
    totalSignals: telemetry.totalSignals,
    lastResearchSyncAt: telemetry.lastResearchSyncAt,
    metrics: [
      { label: "Latency", value: telemetry.latencyMs, unit: "ms", trend: telemetry.latencyMs > 3000 ? "down" : "stable" },
      { label: "Certainty", value: Math.round(telemetry.determinismScore * 1000) / 10, unit: "%", trend: telemetry.determinismScore >= 0.95 ? "up" : telemetry.determinismScore >= 0.85 ? "stable" : "down" },
      { label: "Policy Alignment", value: Math.round(telemetry.policyAlignment * 1000) / 10, unit: "%", trend: telemetry.policyAlignment >= 0.95 ? "up" : telemetry.policyAlignment >= 0.85 ? "stable" : "down" },
      { label: "Run Completion", value: Math.round(telemetry.latestRunIntegrity * 1000) / 10, unit: "%", trend: telemetry.latestRunIntegrity >= 0.95 ? "up" : telemetry.latestRunIntegrity >= 0.8 ? "stable" : "down" },
      { label: "Worker Priming", value: Math.round(telemetry.workerPriming * 1000) / 10, unit: "%", trend: telemetry.workerPriming >= 0.95 ? "up" : telemetry.workerPriming >= 0.8 ? "stable" : "down" },
      { label: "Source Health", value: Math.round(telemetry.sourceHealth * 1000) / 10, unit: "%", trend: telemetry.sourceHealth >= 0.95 ? "up" : telemetry.sourceHealth >= 0.8 ? "stable" : "down" },
    ],
  };
}

function buildEngineObservability() {
  const snapshot = computeTelemetrySnapshot();
  const telemetry = buildTelemetry();
  const pressure = computeUacpPressure(snapshot);

  return {
    quantum_coherence: telemetry.determinismScore * 100,
    classical_latency: telemetry.latencyMs,
    uacp_pressure: pressure,
    gopher_policy_alignment: telemetry.policyAlignment,
    market_convergence: [
      {
        label: "Execution Priming",
        value: `${(snapshot.executionPressure * 100).toFixed(1)}%`,
        description: "Readiness across live workers, fresh research, and current plan/run state.",
        progress: clamp(snapshot.executionPressure, 0, 1),
      },
      {
        label: "Research Coverage",
        value: `${(telemetry.sourceHealth * 100).toFixed(1)}%`,
        description: "Availability and freshness of live public-source evidence.",
        progress: clamp(telemetry.sourceHealth, 0, 1),
      },
      {
        label: "Worker Priming",
        value: `${(snapshot.workerPriming * 100).toFixed(1)}%`,
        description: "Heartbeat freshness and runtime health across the minimum-live worker crew.",
        progress: clamp(snapshot.workerPriming, 0, 1),
      },
    ],
    horowitz_signals: [
      {
        id: "RUN_COMPLETION",
        value: clamp(snapshot.latestRunIntegrity, 0, 1),
        trend: snapshot.latestRunIntegrity >= 0.95 ? "up" : snapshot.latestRunIntegrity >= 0.8 ? "stable" : "down",
        history: state.stats.runCompletionHistory.slice(-HISTORY_WINDOW).map((value) => clamp(value, 0, 1)),
      },
      {
        id: "POLICY_ALIGNMENT",
        value: clamp(telemetry.policyAlignment, 0, 1),
        trend: telemetry.policyAlignment >= 0.95 ? "up" : telemetry.policyAlignment >= 0.85 ? "stable" : "down",
        history: state.stats.policyAlignmentHistory.slice(-HISTORY_WINDOW).map((value) => clamp(value, 0, 1)),
      },
      {
        id: "EXECUTION_PRESSURE",
        value: clamp(pressure, 0, 1),
        trend: pressure >= 0.95 ? "up" : pressure >= 0.8 ? "stable" : "down",
        history: state.stats.pressureHistory.slice(-HISTORY_WINDOW).map((value) => clamp(value, 0, 1)),
      },
    ],
  };
}

function toEngineSignals(signals: ResearchSignal[]) {
  return signals.map((signal) => ({
    id: signal.id,
    title: signal.title,
    strength: signal.strength,
    timestamp: signal.publishedAt,
    category: signal.category,
  }));
}

async function synthesizeCouncilSummary(plan: InstitutionalPlan, signals: ResearchSignal[]) {
  const references = signals.slice(0, 5).map((signal, index) => `${index + 1}. ${signal.source}: ${signal.title}`).join("\n");
  if (!ai) {
    return signals.length > 0
      ? `Council reviewed ${signals.length} live sources and found the strongest evidence in ${uniqueStrings(signals.map((signal) => signal.source)).join(", ")}. Primary signals: ${signals.slice(0, 3).map((signal) => signal.title).join(" | ")}.`
      : "Council proceeded without live research references and elevated the plan's uncertainty.";
  }

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{
            text: [
              `Plan title: ${plan.title}`,
              `Plan objective: ${plan.objective}`,
              `References:\n${references || "No live references available."}`,
              "Write a concise institutional council summary grounded in the references.",
            ].join("\n\n"),
          }],
        },
      ],
    });
    return trimText(result.text || "", 700) || "Council summary unavailable.";
  } catch {
    return signals.length > 0
      ? `Council reviewed ${signals.length} live sources and found the strongest evidence in ${uniqueStrings(signals.map((signal) => signal.source)).join(", ")}.`
      : "Council summary unavailable because no live references were collected.";
  }
}

function evaluateGovernance(plan: InstitutionalPlan, signals: ResearchSignal[]): GovernanceEvaluation {
  const approvedSkillIds = new Set(
    activeSkills()
      .filter((skill) => skill.status === "approved")
      .map((skill) => skill.id),
  );
  const validWorkflowIds = new Set(activeWorkflows().map((workflow) => workflow.id));
  const validEscalationRuleIds = new Set(activeEscalationRules().map((rule) => rule.id));
  const skillIds = plan.skillIds.filter((skillId) => approvedSkillIds.has(skillId));
  const workflowIds = plan.workflowIds.filter((workflowId) => validWorkflowIds.has(workflowId));
  const escalationRuleIds = plan.escalationRuleIds.filter((ruleId) => validEscalationRuleIds.has(ruleId));
  const issues: string[] = [];

  if (signals.length === 0) {
    issues.push("No live research signals were available for this run.");
  }
  if (plan.proposals && plan.proposals.length > 0) {
    issues.push(`Plan carries ${plan.proposals.length} governance proposals that require founder approval before activation.`);
  }
  if (skillIds.length === 0) {
    issues.push("No approved skills matched the plan's pillar set.");
  }
  if (workflowIds.length === 0) {
    issues.push("No workflows matched the plan's pillar set.");
  }
  if (plan.escalationRuleIds.length > 0 && escalationRuleIds.length === 0) {
    issues.push("Selected escalation rules are not present in the active governance registry.");
  }
  if (plan.riskTier === "high" && !plan.pillars.includes("compliance-risk")) {
    issues.push("High-risk plan is missing the compliance / risk pillar.");
  }

  const approvals =
    plan.votes.filter((vote) => vote.vote === "approve").length +
    (signals.length > 0 ? 1 : 0) +
    (skillIds.length > 0 ? 1 : 0);

  const passed = issues.length === 0;
  const summary = passed
    ? `Governance approved the run with ${approvals} approval signals, ${skillIds.length} approved skills, and ${workflowIds.length} execution workflows.`
    : `Governance blocked the run: ${issues.join(" ")}`;

  return {
    passed,
    approvals,
    issues,
    summary: passed && escalationRuleIds.length > 0 ? `${summary} Escalation coverage includes ${escalationRuleIds.length} registry rules.` : summary,
    skillIds,
    workflowIds,
  };
}

function createArtifact(
  plan: InstitutionalPlan,
  signals: ResearchSignal[],
  governance: GovernanceEvaluation,
  phaseOutputs: CompiledArtifactPhaseOutput[],
  archiveRecordIds: string[],
): CompiledArtifact {
  const references = signals.slice(0, 8).map(toReference);
  const signalSources = uniqueStrings(signals.map((signal) => signal.source));
  const workflowIds = governance.workflowIds;
  const skillIds = governance.skillIds;

  return {
    id: createId("artifact"),
    title: plan.title,
    objective: plan.objective,
    summary: `Compiled artifact generated from ${references.length} live references across ${signalSources.join(", ") || "no online sources"}, with ${workflowIds.length} workflows and ${skillIds.length} approved skills ready for Sunnyvale execution.`,
    sourceCount: references.length,
    signalSources,
    workflowIds,
    skillIds,
    governanceSummary: governance.summary,
    nextAction: governance.passed
      ? "Open the compiled artifact in Sunnyvale, assign worker execution, and verify archive completion."
      : "Resolve governance issues before attempting another run.",
    archiveRecordIds,
    phaseOutputs,
    references,
    createdAt: now(),
  };
}

async function advanceRunStage(
  run: GovernedRun,
  plan: InstitutionalPlan,
  index: number,
  totalStages: number,
  stage: string,
  summary: string,
  sourceCount?: number,
) {
  const startedAt = now();
  run.status = "executing";
  run.currentStage = stage;
  run.progress = Math.round(((index + 1) / totalStages) * 100);
  const record: RunStageRecord = {
    stage,
    status: "completed",
    startedAt,
    completedAt: now(),
    summary: trimText(summary, 280),
    sourceCount,
  };
  run.stages = [...(run.stages || []), record];
  addEvent("RUN_STAGE", `${run.id} advanced to ${stage}.`, "sunnyvale", { runId: run.id, planId: plan.id, summary: record.summary });
  broadcast({ type: "run_update", data: run });
  captureMetricHistory();
  await persistState();
}

async function executeRun(runId: string) {
  const run = state.runs.find((item) => item.id === runId);
  if (!run) return;
  const plan = state.plans.find((item) => item.id === run.planId);
  if (!plan) return;

  const runStartedAt = Date.now();
  const phaseOutputs: CompiledArtifactPhaseOutput[] = [];
  const archiveRecordIds: string[] = [];

  try {
    await advanceRunStage(run, plan, 0, 5, "Intent Intake", "Founder objective normalized into a governed execution contract.");
    phaseOutputs.push({ stage: "Intent Intake", summary: "Founder objective normalized into a governed execution contract." });

    const researchContext = await fetchLiveResearch(plan.researchQuery || buildResearchQuery(plan.intent), 4);
    if (researchContext.signals.length > 0) {
      state.researchSignals = researchContext.signals;
      state.researchStatus = researchContext.statuses;
      pushWindow(state.stats.researchRefreshDurationsMs, researchContext.durationMs);
      state.stats.lastResearchSyncAt = now();
    }
    const councilSummary = await synthesizeCouncilSummary(plan, researchContext.signals);
    await advanceRunStage(run, plan, 1, 5, "Model Council", councilSummary, researchContext.signals.length);
    phaseOutputs.push({ stage: "Model Council", summary: councilSummary });

    const governance = evaluateGovernance(plan, researchContext.signals);
    run.approvals = governance.approvals;
    await advanceRunStage(run, plan, 2, 5, "Governance Gate", governance.summary, researchContext.signals.length);
    phaseOutputs.push({ stage: "Governance Gate", summary: governance.summary });

    if (!governance.passed) {
      run.status = "blocked";
      run.currentStage = "Governance Blocked";
      run.errors = governance.issues;
      run.output = governance.summary;
      plan.status = "review";
      addArchive({
        title: `${plan.title} blocked governance packet`,
        category: "policy",
        summary: governance.summary,
        lineage: [plan.id, run.id],
        metadata: { issues: governance.issues },
      });
      addEvent("RUN_BLOCKED", `${run.id} blocked by governance.`, "silicon-valley", { runId: run.id, planId: plan.id, issues: governance.issues });
      broadcast({ type: "run_update", data: run });
      captureMetricHistory();
      await persistState();
      return;
    }

    const executionSummary = `Execution assembled ${governance.workflowIds.length} workflows and ${governance.skillIds.length} approved skills for the plan.`;
    await advanceRunStage(run, plan, 3, 5, "Sunnyvale Run", executionSummary, researchContext.signals.length);
    phaseOutputs.push({ stage: "Sunnyvale Run", summary: executionSummary });

    const artifact = createArtifact(plan, researchContext.signals, governance, phaseOutputs, archiveRecordIds);
    const archive = addArchive({
      title: `${plan.title} compiled artifact`,
      category: "run",
      summary: artifact.summary,
      lineage: [plan.id, run.id, artifact.id],
      metadata: { artifact },
    });
    archiveRecordIds.push(archive.id);

    const archiveSummary = `Archive committed ${archive.id} with ${artifact.references.length} live references and ${artifact.phaseOutputs.length} phase outputs.`;
    await advanceRunStage(run, plan, 4, 5, "Archive Commit", archiveSummary, artifact.references.length);
    phaseOutputs.push({ stage: "Archive Commit", summary: archiveSummary });

    artifact.archiveRecordIds = archiveRecordIds;
    artifact.phaseOutputs = phaseOutputs;
    run.status = "completed";
    run.currentStage = "Autonomous Continuity";
    run.completedAt = now();
    run.evidenceCount = artifact.references.length + archiveRecordIds.length;
    run.artifact = artifact;
    run.output = artifact.summary;
    plan.status = "completed";

    pushWindow(state.stats.runDurationsMs, Date.now() - runStartedAt);
    addEvent("RUN_COMPLETED", `${run.id} completed with compiled artifact ${artifact.id}.`, "archives", {
      runId: run.id,
      planId: plan.id,
      artifactId: artifact.id,
    });
    broadcast({ type: "run_update", data: run });
    captureMetricHistory();
    await persistState();
  } catch (error) {
    run.status = "failed";
    run.currentStage = "Execution Failed";
    run.completedAt = now();
    run.errors = [error instanceof Error ? error.message : "Unknown execution failure"];
    run.output = "Run failed before a compiled artifact could be committed.";
    plan.status = "review";
    addEvent("RUN_FAILED", `${run.id} failed during execution.`, "archives", {
      runId: run.id,
      planId: plan.id,
      errors: run.errors,
    });
    broadcast({ type: "run_update", data: run });
    captureMetricHistory();
    await persistState();
  }
}

async function startServer() {
  await loadGovernanceRegistry();
  await loadState();
  await recordGovernanceRegistrySync("startup");
  if (state.stats.determinismHistory.length === 0) {
    captureMetricHistory();
    await persistState();
  }
  await refreshBackgroundResearch("startup");
  await operatorSchedulerTick();
  setInterval(() => {
    void refreshBackgroundResearch("scheduled");
  }, RESEARCH_REFRESH_INTERVAL_MS);
  setInterval(() => {
    void operatorSchedulerTick();
  }, OPERATOR_TICK_INTERVAL_MS);

  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "init", message: "UACP V3 control plane online" }));
    ws.on("close", () => clients.delete(ws));
  });

  app.get("/api/bootstrap", (_req, res) => {
    const payload: BootstrapPayload = {
      system: "UACP V3",
      version: "3.1.0",
      thesis: "Institutional control plane for governed AI-native operations with live public-source evidence.",
      surfaces,
      doctrines: [
        "Plans are promises, not prompts.",
        "Governance is distinct from execution.",
        "Skills are governed execution artifacts.",
        "Archives preserve replayable judgment.",
      ],
      status: "operational",
      identity: "UACP-V3",
      userEmail: process.env.USER_EMAIL || "FOUNDER",
    };
    res.json(payload);
  });

  app.get("/api/governance-registry", (_req, res) => res.json(governanceRegistry));
  app.get("/api/pillars", (_req, res) => res.json(activePillars()));
  app.get("/api/committees", (_req, res) => res.json(activeCommittees()));
  app.get("/api/operator-committees", (_req, res) => res.json(activeOperatorCommittees()));
  app.get("/api/operators", (_req, res) => res.json(activeWorkers()));
  app.get("/api/operator-runtime", (_req, res) => res.json(state.workerRuntime));
  app.get("/api/operator-runs", (_req, res) => res.json(state.operatorRuns));
  app.get("/api/skills", (_req, res) => res.json(activeSkills()));
  app.get("/api/workflows", (_req, res) => res.json(activeWorkflows()));
  app.get("/api/escalation-rules", (_req, res) => res.json(activeEscalationRules()));
  app.get("/api/backend-summary", (_req, res) => res.json(state.backendSummary));
  app.get("/api/backend-events", (_req, res) => res.json(state.backendEvents));
  app.get("/api/command-center", (_req, res) => res.json(buildCommandCenterSnapshot()));
  app.get("/api/research-signals", (_req, res) => res.json(state.researchSignals));
  app.get("/api/research-status", (_req, res) => res.json(state.researchStatus));
  app.get("/api/ssrn-signals", (_req, res) => res.json(toEngineSignals(state.researchSignals)));
  app.get("/api/plans", (_req, res) => res.json(state.plans));
  app.get("/api/runs", (_req, res) => res.json(state.runs));
  app.get("/api/events", (_req, res) => res.json(state.events));
  app.get("/api/archives", (_req, res) => res.json(state.archives));
  app.get("/api/telemetry", (_req, res) => res.json(buildTelemetry()));
  app.get("/api/observability/signals", (_req, res) => res.json(buildEngineObservability()));

  app.post("/api/research-refresh", async (_req, res) => {
    await refreshBackgroundResearch("manual");
    res.json({ ok: true, signalCount: state.researchSignals.length });
  });

  app.put("/api/governance-registry", requireAdmin, async (req, res) => {
    try {
      const candidate = ensureRecord(req.body, "governanceRegistryUpdate");
      const nextRegistry = validateGovernanceRegistry({
        ...candidate,
        updatedAt: now(),
        updatedBy: req.header("x-uacp-admin-actor") || process.env.USER_EMAIL || "admin-api",
      });
      governanceRegistry = nextRegistry;
      syncWorkerRuntimeState();
      await persistGovernanceRegistry();
      await recordGovernanceRegistrySync("admin-update");
      await persistState();
      res.json(governanceRegistry);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid governance registry." });
    }
  });

  app.get("/api/v1/internal/operators", requireInternal, (_req, res) => {
    const response = activeWorkers().map((worker) => ({
      ...worker,
      runtime: state.workerRuntime.find((runtime) => runtime.workerId === worker.id) || makeWorkerRuntime(worker),
    }));
    res.json(response);
  });

  app.get("/api/v1/internal/operators/runs", requireInternal, (_req, res) => res.json(state.operatorRuns));

  app.post("/api/v1/internal/operators/:workerId/run", requireInternal, async (req, res) => {
    try {
      const run = queueOperatorRun(String(req.params.workerId || ""), "manual", "manual-trigger");
      await persistState();
      res.status(202).json(run);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to queue operator run." });
    }
  });

  app.get("/api/v1/internal/operators/:workerId/runs", requireInternal, (req, res) => {
    const workerId = String(req.params.workerId || "");
    res.json(state.operatorRuns.filter((run) => run.workerId === workerId));
  });

  app.get("/api/v1/internal/operators/:workerId/evidence", requireInternal, (req, res) => {
    const workerId = String(req.params.workerId || "");
    const archives = state.archives.filter((archive) => archive.metadata && (archive.metadata as Record<string, unknown>).workerId === workerId);
    res.json(archives);
  });

  app.post("/api/v1/internal/operators/:workerId/pause", requireInternal, async (req, res) => {
    const workerId = String(req.params.workerId || "");
    const worker = workerById(workerId);
    if (!worker) {
      res.status(404).json({ error: "Worker not found." });
      return;
    }
    setWorkerRuntime(workerId, { status: "paused", paused: true, lastHeartbeatAt: now(), nextRunAt: undefined });
    addEvent("WORKER_PAUSED", `${worker.displayName} was paused.`, "silicon-valley", { workerId });
    await persistState();
    res.json(state.workerRuntime.find((runtime) => runtime.workerId === workerId));
  });

  app.post("/api/v1/internal/operators/:workerId/resume", requireInternal, async (req, res) => {
    const workerId = String(req.params.workerId || "");
    const worker = workerById(workerId);
    if (!worker) {
      res.status(404).json({ error: "Worker not found." });
      return;
    }
    setWorkerRuntime(workerId, { status: "idle", paused: false, lastHeartbeatAt: now(), nextRunAt: now() });
    addEvent("WORKER_RESUMED", `${worker.displayName} was resumed.`, "silicon-valley", { workerId });
    await persistState();
    res.json(state.workerRuntime.find((runtime) => runtime.workerId === workerId));
  });

  app.post("/api/v1/internal/operators/:workerId/escalate", requireInternal, async (req, res) => {
    const workerId = String(req.params.workerId || "");
    const worker = workerById(workerId);
    if (!worker) {
      res.status(404).json({ error: "Worker not found." });
      return;
    }

    const run: OperatorRun = {
      id: createId("oprun"),
      workerId,
      committeeId: worker.committeeId,
      pillarId: worker.primaryPillar,
      startedAt: now(),
      completedAt: now(),
      status: "escalated",
      inputs: ["manual-escalation"],
      actionsTaken: ["open_escalation"],
      evidenceCreated: [],
      archiveRef: undefined,
      escalations: [worker.escalationRuleId],
      errors: [],
      nextRecommendation: `${worker.displayName} requires immediate founder review.`,
    };
    state.operatorRuns = [run, ...state.operatorRuns].slice(0, MAX_OPERATOR_RUNS);
    setWorkerRuntime(workerId, {
      status: "error",
      paused: false,
      lastHeartbeatAt: now(),
      lastRunAt: run.completedAt,
      lastRunId: run.id,
      nextRunAt: isoAfterMinutes(worker.intervalMinutes),
      lastError: worker.escalationRuleId,
    });
    addEvent("WORKER_ESCALATED", `${worker.displayName} was manually escalated.`, "silicon-valley", {
      workerId,
      escalationRuleId: worker.escalationRuleId,
      runId: run.id,
    });
    await persistState();
    res.json(run);
  });

  app.post("/api/v1/internal/backend/events", requireInternal, async (req, res) => {
    try {
      const backendEvent = ingestBackendEvent(req.body);
      await persistState();
      res.status(202).json(backendEvent);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid backend event payload." });
    }
  });

  app.post("/api/plans", async (req, res) => {
    const intent = String(req.body?.intent || "").trim();
    if (!intent) {
      res.status(400).json({ error: "Intent is required." });
      return;
    }

    const startedAt = Date.now();
    const draft = await generatePlan(intent);
    const plan: InstitutionalPlan = {
      id: createId("plan"),
      createdAt: now(),
      ...draft,
    };
    state.plans = [plan, ...state.plans.filter((entry) => entry.id !== plan.id)];
    pushWindow(state.stats.planCompileDurationsMs, Date.now() - startedAt);

    addEvent("PLAN_CREATED", `Plan ${plan.title} created from institutional intent.`, "deterministic-engine", { planId: plan.id });
    addArchive({
      title: `${plan.title} doctrine snapshot`,
      category: "plan",
      summary: `Plan created with ${plan.pillars.length} pillars, ${plan.committeeIds.length} committees, ${plan.workflowIds.length} workflows, ${plan.skillIds.length} skills, ${plan.proposals?.length || 0} proposals, and ${plan.researchReferences?.length || 0} live references.`,
      lineage: [plan.id],
      metadata: {
        planId: plan.id,
        researchQuery: plan.researchQuery,
        references: plan.researchReferences,
        workflowIds: plan.workflowIds,
        skillIds: plan.skillIds,
        escalationRuleIds: plan.escalationRuleIds,
        proposals: plan.proposals,
      },
    });
    captureMetricHistory();
    await persistState();
    res.json(plan);
  });

  app.post("/api/runs", async (req, res) => {
    const planId = String(req.body?.planId || "");
    const plan = state.plans.find((item) => item.id === planId);
    if (!plan) {
      res.status(404).json({ error: "Plan not found." });
      return;
    }

    const run: GovernedRun = {
      id: createId("run"),
      planId,
      status: "queued",
      currentStage: "Admission control",
      progress: 0,
      approvals: 0,
      evidenceCount: 0,
      startedAt: now(),
      stages: [],
      errors: [],
    };
    state.runs = [run, ...state.runs.filter((entry) => entry.id !== run.id)];
    plan.status = "active";
    addEvent("RUN_QUEUED", `Run queued for plan ${plan.title}.`, "sunnyvale", { runId: run.id, planId });
    captureMetricHistory();
    await persistState();
    void executeRun(run.id);
    res.json(run);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    addEvent("SYSTEM_ONLINE", "UACP V3 constitutional control plane initialized with live research ingestion.", "silicon-valley");
    console.log(`UACP V3 running on http://localhost:${PORT}`);
  });
}

void startServer().catch((error) => {
  console.error("UACP V3 failed to start:", error);
  process.exit(1);
});
