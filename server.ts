import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import path from "path";
import { WebSocket, WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { XMLParser } from "fast-xml-parser";
import type {
  ArchiveEntry,
  BootstrapPayload,
  Committee,
  CommitteeVote,
  ControlTelemetry,
  EventItem,
  GovernedRun,
  InstitutionalPlan,
  Pillar,
  ResearchSignal,
  SkillArtifact,
  SurfaceId,
  WorkflowArtifact,
} from "./src/types";

const PORT = Number(process.env.PORT || 3000);
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const parser = new XMLParser();

const surfaces: BootstrapPayload["surfaces"] = [
  { id: "deterministic-engine", name: "Deterministic Engine", purpose: "Public narrative for governed autonomy." },
  { id: "sunnyvale", name: "Sunnyvale", purpose: "Execution floor for workers, runs, approvals, and queues." },
  { id: "silicon-valley", name: "Silicon Valley", purpose: "Founder control console for governance and escalation." },
  { id: "archives", name: "Archives", purpose: "Replayable institutional memory and evidence." },
];

const pillars: Pillar[] = [
  { id: "governance", name: "Governance", mandate: "Keep the institution constitutional and replayable.", kpi: "Policy SLA" },
  { id: "product", name: "Product", mandate: "Translate institutional objectives into offers and UX.", kpi: "Activation rate" },
  { id: "engineering", name: "Engineering", mandate: "Ship reliable execution systems and control-plane primitives.", kpi: "Deployment quality" },
  { id: "growth", name: "Growth", mandate: "Acquire demand and compound distribution.", kpi: "Qualified pipeline" },
  { id: "sales", name: "Sales", mandate: "Convert pipeline into retained revenue.", kpi: "Closed ARR" },
  { id: "operations", name: "Operations", mandate: "Run queues, approvals, and service delivery.", kpi: "Cycle time" },
  { id: "finance", name: "Finance", mandate: "Protect margin, billing, and capital allocation.", kpi: "Gross margin" },
  { id: "compliance-risk", name: "Compliance / Risk", mandate: "Constrain execution by policy, law, and exposure.", kpi: "Risk incidents" },
  { id: "knowledge-research", name: "Knowledge / Research", mandate: "Turn public signals into institutional edge.", kpi: "Signal-to-shipment ratio" },
];

const committees: Committee[] = [
  {
    id: "founder-council",
    name: "Founder Council",
    purpose: "Final approval and escalation authority.",
    authority: "constitutional",
    chair: "UACP V3",
    members: ["UACP V3", "Gemini Strategy Chair", "Policy Steward"],
    escalation: "Direct founder override",
    allowedActions: ["approve_plans", "freeze_skills", "reassign_committees"],
    vetoConditions: ["regulatory breach", "margin-negative execution"],
    pillarIds: ["governance", "finance", "compliance-risk"],
  },
  {
    id: "signal-council",
    name: "Signal Council",
    purpose: "Convert research, competitor, and market signals into opportunities.",
    authority: "advisory",
    chair: "Research Director",
    members: ["Research Scout", "Competitor Analyst", "Gemini Flash"],
    escalation: "Founder Council",
    allowedActions: ["publish_briefs", "recommend_targets", "open_investigations"],
    vetoConditions: ["low-evidence thesis"],
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
    vetoConditions: ["missing evidence", "unapproved skill usage"],
    pillarIds: ["operations", "engineering", "sales"],
  },
];

const skills: SkillArtifact[] = [
  {
    id: "marketing-competitive-analysis",
    name: "marketing-competitive-analysis",
    category: "skill",
    description: "Research competitors and expose positioning, content, and workflow gaps.",
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
    description: "Prepare operator-grade account context, meeting agendas, and objection maps.",
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
    description: "Constrain privacy, DPA, and data-subject workflows before execution.",
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
    description: "Support control testing, audit evidence, and operating reviews.",
    allowedTools: ["read", "write"],
    source: "internal-registry/finance-systems",
    ref: "v1.1.8",
    treeSha: "sha-f82a11d",
    status: "review",
    pillarIds: ["finance", "governance"],
  },
];

const workflows: WorkflowArtifact[] = [
  {
    id: "competitive-intelligence",
    name: "Competitive intelligence",
    category: "workflow",
    description: "Monitor launches, pricing shifts, and partnership signals.",
    outcome: "Competitor weakness map",
    pillarIds: ["growth", "knowledge-research"],
  },
  {
    id: "model-council",
    name: "Model council",
    category: "workflow",
    description: "Run multi-model deliberation and capture convergence or dissent.",
    outcome: "Committee vote packet",
    pillarIds: ["governance", "knowledge-research"],
  },
  {
    id: "product-teardown",
    name: "Product teardown",
    category: "workflow",
    description: "Capture pricing, onboarding, feature gaps, and UX weaknesses.",
    outcome: "Actionable disruption brief",
    pillarIds: ["product", "growth", "sales"],
  },
];

let plans: InstitutionalPlan[] = [];
let runs: GovernedRun[] = [];
let events: EventItem[] = [];
let archives: ArchiveEntry[] = [];
let researchSignals: ResearchSignal[] = [];

const clients = new Set<WebSocket>();

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function addEvent(type: string, message: string, surface: SurfaceId, metadata?: Record<string, unknown>) {
  const event: EventItem = { id: randomId("evt"), type, message, timestamp: now(), surface, metadata };
  events = [event, ...events].slice(0, 120);
  broadcast({ type: "event", data: event });
}

function addArchive(entry: Omit<ArchiveEntry, "id" | "createdAt">) {
  const archive: ArchiveEntry = { id: randomId("arc"), createdAt: now(), ...entry };
  archives = [archive, ...archives].slice(0, 80);
  broadcast({ type: "archive", data: archive });
}

function broadcast(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function seedState() {
  const seedPlan: InstitutionalPlan = {
    id: "plan-v3-seed",
    title: "UACP V3 Institutional Launch",
    intent: "Turn the V2 prototype into a V3 control plane for governed AI-native institutions.",
    objective: "Ship a monetizable command surface for founders operating committees, skills, and evidence.",
    pricingModel: "Platform license + enterprise deployment retainer",
    payingUser: "Founder-led operator teams and AI-native SMBs",
    status: "approved",
    revision: 3,
    riskTier: "medium",
    pillars: ["governance", "engineering", "operations", "knowledge-research"],
    committeeIds: ["founder-council", "signal-council", "execution-board"],
    graph: {
      nodes: [
        { id: "intent", label: "Intent Intake", stage: "intent", ownerCommitteeId: "founder-council", pillarIds: ["governance"], summary: "Founder intent is converted into an institutional objective.", latencyMs: 90 },
        { id: "council", label: "Model Council", stage: "reasoning", ownerCommitteeId: "signal-council", pillarIds: ["knowledge-research"], summary: "Signal council produces arguments, counterarguments, and recommended path.", latencyMs: 210 },
        { id: "policy", label: "Governance Gate", stage: "governance", ownerCommitteeId: "founder-council", pillarIds: ["governance", "compliance-risk"], summary: "Approvals, veto conditions, and skill restrictions are evaluated.", latencyMs: 80 },
        { id: "execution", label: "Sunnyvale Run", stage: "execution", ownerCommitteeId: "execution-board", pillarIds: ["engineering", "operations"], summary: "Approved skills and workflows execute as a governed run.", latencyMs: 320 },
        { id: "evidence", label: "Archive Writeback", stage: "evidence", ownerCommitteeId: "execution-board", pillarIds: ["operations", "governance"], summary: "Evidence, logs, and overrides are captured as replayable records.", latencyMs: 55 },
        { id: "continuity", label: "Continuity Loop", stage: "continuity", ownerCommitteeId: "founder-council", pillarIds: ["knowledge-research"], summary: "Outcomes trigger promotions, demotions, and doctrine updates.", latencyMs: 40 },
      ],
      edges: [
        { from: "intent", to: "council" },
        { from: "council", to: "policy" },
        { from: "policy", to: "execution" },
        { from: "execution", to: "evidence" },
        { from: "evidence", to: "continuity" },
      ],
    },
    votes: [
      { member: "Gemini Strategy Chair", model: "gemini-3-flash-preview", vote: "approve", rationale: "Institutional control plane thesis is internally coherent and commercially defensible." },
      { member: "Policy Steward", model: "governance-engine", vote: "challenge", rationale: "Skill approvals must stay tightly scoped and auditable." },
      { member: "UACP V3", model: "control-plane", vote: "approve", rationale: "Replayability and plan/run separation are preserved." },
    ],
    guardrails: [
      "Plans are promises, not prompts.",
      "No skill executes without provenance and committee ownership.",
      "Every high-risk action emits evidence to the Archives.",
    ],
    successMetrics: ["<120ms median intent triage", ">=0.97 policy alignment", ">=90% archive coverage"],
    createdAt: now(),
  };

  plans = [seedPlan];
  archives = [
    {
      id: "arc-foundation",
      title: "Quantum UACP lineage preserved",
      category: "research",
      summary: "V1/V2 doctrine preserved: plan/run separation, gateway admission, append-only event sequencing, and replayable evidence.",
      createdAt: now(),
      lineage: ["UACP v1", "UACPGemini", "UACP V3"],
    },
  ];
}

function buildTelemetry(): ControlTelemetry {
  const t = Date.now();
  return {
    latencyMs: 74 + Math.round(Math.sin(t / 3000) * 18),
    determinismScore: 0.96 + ((Math.sin(t / 4000) + 1) / 2) * 0.03,
    committeeHealth: 0.91 + ((Math.cos(t / 5000) + 1) / 2) * 0.06,
    policyAlignment: 0.97 + ((Math.sin(t / 6000) + 1) / 2) * 0.02,
    archiveCoverage: 0.93 + ((Math.cos(t / 3500) + 1) / 2) * 0.04,
    metrics: [
      { label: "Latency", value: 74 + Math.round(Math.sin(t / 3000) * 18), unit: "ms", trend: "stable" },
      { label: "Determinism", value: 97.8, unit: "%", trend: "up" },
      { label: "Committee Health", value: 94.1, unit: "%", trend: "up" },
      { label: "Policy Alignment", value: 98.2, unit: "%", trend: "stable" },
      { label: "Archive Coverage", value: 95.4, unit: "%", trend: "up" },
    ],
  };
}

async function refreshResearchSignals() {
  try {
    const query = "all:(governance OR agents OR orchestration OR workflow) AND cat:cs.AI";
    const response = await fetch(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=6&sortBy=lastUpdatedDate&sortOrder=descending`);
    const xml = await response.text();
    const parsed = parser.parse(xml);
    const entries = Array.isArray(parsed.feed?.entry) ? parsed.feed.entry : parsed.feed?.entry ? [parsed.feed.entry] : [];

    researchSignals = entries.map((entry: any, index: number) => ({
      id: `arxiv-${index + 1}`,
      source: "arXiv",
      title: String(entry.title || "Untitled").replace(/\s+/g, " ").trim(),
      category: "Research",
      strength: 86 + index * 2,
      publishedAt: entry.updated || now(),
      url: entry.id,
    }));
  } catch {
    researchSignals = [
      {
        id: "fallback-1",
        source: "Archive",
        title: "Governed autonomy requires plan/run separation and evidence-first execution.",
        category: "Doctrine",
        strength: 91,
        publishedAt: now(),
      },
      {
        id: "fallback-2",
        source: "Archive",
        title: "Skill provenance and committee ownership are prerequisites for institutional trust.",
        category: "Governance",
        strength: 88,
        publishedAt: now(),
      },
    ];
  }
}

function localPlan(intent: string): Omit<InstitutionalPlan, "id" | "createdAt"> {
  const objective = intent.length > 140 ? `${intent.slice(0, 137)}...` : intent;
  const selectedPillars = ["governance", "product", "engineering", "growth", "operations"];
  const selectedCommittees = ["signal-council", "execution-board", "founder-council"];
  const votes: CommitteeVote[] = [
    { member: "Gemini Strategy Chair", model: "fallback-planner", vote: "approve", rationale: "Objective maps cleanly to a governed operating flow." },
    { member: "Policy Steward", model: "fallback-planner", vote: "challenge", rationale: "Risk controls must stay attached to skill use and billing impact." },
  ];

  return {
    title: objective.split(" ").slice(0, 6).join(" ") || "Institutional Plan",
    intent,
    objective,
    pricingModel: "Subscription + operator usage tiers",
    payingUser: "Operators buying governed execution and audited automation",
    status: "draft",
    revision: 1,
    riskTier: "medium",
    pillars: selectedPillars,
    committeeIds: selectedCommittees,
    graph: {
      nodes: [
        { id: "n1", label: "Intent Intake", stage: "intent", ownerCommitteeId: "founder-council", pillarIds: ["governance"], summary: "Normalize the founder request into a monetizable institutional objective.", latencyMs: 70 },
        { id: "n2", label: "Model Council", stage: "reasoning", ownerCommitteeId: "signal-council", pillarIds: ["knowledge-research", "growth"], summary: "Run council deliberation and identify the competitive angle.", latencyMs: 160 },
        { id: "n3", label: "Risk Gate", stage: "governance", ownerCommitteeId: "founder-council", pillarIds: ["governance", "compliance-risk"], summary: "Check policy, payment control, and permitted skills.", latencyMs: 85 },
        { id: "n4", label: "Run Assembly", stage: "execution", ownerCommitteeId: "execution-board", pillarIds: ["engineering", "operations"], summary: "Assemble governed skills, workflows, and owner committees.", latencyMs: 250 },
        { id: "n5", label: "Archive Commit", stage: "evidence", ownerCommitteeId: "execution-board", pillarIds: ["operations"], summary: "Write evidence, metrics, and traces into the Archives.", latencyMs: 45 },
      ],
      edges: [
        { from: "n1", to: "n2" },
        { from: "n2", to: "n3" },
        { from: "n3", to: "n4" },
        { from: "n4", to: "n5" },
      ],
    },
    votes,
    guardrails: [
      "Every plan maps to committees and pillars.",
      "Every run has a payment-bearing business objective.",
      "Every governance decision is replayable.",
    ],
    successMetrics: ["Policy alignment >= 97%", "Approval latency < 2m", "Archive coverage >= 95%"],
  };
}

async function generatePlan(intent: string): Promise<Omit<InstitutionalPlan, "id" | "createdAt">> {
  if (!ai) {
    return localPlan(intent);
  }

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Convert this intent into a UACP V3 institutional plan: ${intent}`,
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
          },
          required: ["title", "objective", "pricingModel", "payingUser", "riskTier", "pillars", "committeeIds", "graph", "votes", "guardrails", "successMetrics"],
        },
      },
    });

    const parsed = JSON.parse(result.text || "{}");
    return {
      ...parsed,
      intent,
      status: "draft",
      revision: 1,
    };
  } catch {
    return localPlan(intent);
  }
}

async function simulateRun(runId: string) {
  const run = runs.find((item) => item.id === runId);
  if (!run) return;
  const plan = plans.find((item) => item.id === run.planId);
  if (!plan) return;

  for (const [index, node] of plan.graph.nodes.entries()) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000 + node.latencyMs, 1800)));
    run.status = "executing";
    run.currentStage = node.label;
    run.progress = Math.round(((index + 1) / plan.graph.nodes.length) * 100);
    run.evidenceCount += 1;
    if (node.stage === "governance") run.approvals += 1;
    addEvent("RUN_STAGE", `${run.id} advanced to ${node.label}`, "sunnyvale", { runId: run.id, stage: node.stage });
    broadcast({ type: "run_update", data: run });
  }

  run.status = "completed";
  run.currentStage = "Autonomous Continuity";
  run.completedAt = now();
  run.output = `Plan ${plan.title} cleared committee governance, executed through Sunnyvale, and committed replayable evidence into the Archives.`;
  addEvent("RUN_COMPLETED", `${run.id} completed with archived evidence`, "archives", { runId: run.id, planId: plan.id });
  addArchive({
    title: `${plan.title} replay package`,
    category: "run",
    summary: `${run.output} Approvals: ${run.approvals}. Evidence records: ${run.evidenceCount}.`,
    lineage: [plan.id, run.id],
  });
  broadcast({ type: "run_update", data: run });
}

async function startServer() {
  seedState();
  await refreshResearchSignals();
  setInterval(refreshResearchSignals, 1000 * 60 * 15);

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
      version: "3.0.0",
      thesis: "Institutional control plane for governed AI-native operations.",
      surfaces,
      doctrines: [
        "Plans are promises, not prompts.",
        "Governance is distinct from execution.",
        "Skills are governed execution artifacts.",
        "Archives preserve replayable judgment.",
      ],
    };
    res.json(payload);
  });

  app.get("/api/pillars", (_req, res) => res.json(pillars));
  app.get("/api/committees", (_req, res) => res.json(committees));
  app.get("/api/skills", (_req, res) => res.json(skills));
  app.get("/api/workflows", (_req, res) => res.json(workflows));
  app.get("/api/research-signals", (_req, res) => res.json(researchSignals));
  app.get("/api/plans", (_req, res) => res.json(plans));
  app.get("/api/runs", (_req, res) => res.json(runs));
  app.get("/api/events", (_req, res) => res.json(events));
  app.get("/api/archives", (_req, res) => res.json(archives));
  app.get("/api/telemetry", (_req, res) => res.json(buildTelemetry()));

  app.post("/api/plans", async (req, res) => {
    const intent = String(req.body?.intent || "").trim();
    if (!intent) {
      res.status(400).json({ error: "Intent is required." });
      return;
    }

    const draft = await generatePlan(intent);
    const plan: InstitutionalPlan = {
      id: randomId("plan"),
      createdAt: now(),
      ...draft,
    };
    plans = [plan, ...plans];
    addEvent("PLAN_CREATED", `Plan ${plan.title} created from institutional intent.`, "deterministic-engine", { planId: plan.id });
    addArchive({
      title: `${plan.title} doctrine snapshot`,
      category: "plan",
      summary: `Plan created with ${plan.pillars.length} pillars and ${plan.committeeIds.length} committees.`,
      lineage: [plan.id],
    });
    res.json(plan);
  });

  app.post("/api/runs", (req, res) => {
    const planId = String(req.body?.planId || "");
    const plan = plans.find((item) => item.id === planId);
    if (!plan) {
      res.status(404).json({ error: "Plan not found." });
      return;
    }

    const run: GovernedRun = {
      id: randomId("run"),
      planId,
      status: "queued",
      currentStage: "Admission control",
      progress: 0,
      approvals: 0,
      evidenceCount: 0,
      startedAt: now(),
    };
    runs = [run, ...runs];
    addEvent("RUN_QUEUED", `Run queued for plan ${plan.title}.`, "sunnyvale", { runId: run.id, planId });
    void simulateRun(run.id);
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
    addEvent("SYSTEM_ONLINE", "UACP V3 constitutional control plane initialized.", "silicon-valley");
    console.log(`UACP V3 running on http://localhost:${PORT}`);
  });
}

void startServer();
