import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  BookMarked,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileStack,
  Gavel,
  Network,
  Radar,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import type {
  ArchiveEntry,
  BootstrapPayload,
  Committee,
  ControlTelemetry,
  EventItem,
  GovernedRun,
  InstitutionalPlan,
  Pillar,
  ResearchSignal,
  SkillArtifact,
  SurfaceId,
  WorkflowArtifact,
} from "./types";

type DataState = {
  bootstrap: BootstrapPayload | null;
  pillars: Pillar[];
  committees: Committee[];
  skills: SkillArtifact[];
  workflows: WorkflowArtifact[];
  plans: InstitutionalPlan[];
  runs: GovernedRun[];
  events: EventItem[];
  archives: ArchiveEntry[];
  signals: ResearchSignal[];
  telemetry: ControlTelemetry | null;
};

const initialState: DataState = {
  bootstrap: null,
  pillars: [],
  committees: [],
  skills: [],
  workflows: [],
  plans: [],
  runs: [],
  events: [],
  archives: [],
  signals: [],
  telemetry: null,
};

const surfaceLabels: Record<SurfaceId, string> = {
  "deterministic-engine": "Deterministic Engine",
  sunnyvale: "Sunnyvale",
  "silicon-valley": "Silicon Valley",
  archives: "Archives",
};

export default function App() {
  const [state, setState] = useState<DataState>(initialState);
  const [activeSurface, setActiveSurface] = useState<SurfaceId>("deterministic-engine");
  const [intent, setIntent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    void loadAll();

    const telemetryInterval = setInterval(() => {
      fetchJson<ControlTelemetry>("/api/telemetry").then((telemetry) => {
        setState((current) => ({ ...current, telemetry }));
      }).catch(() => {});
    }, 4000);

    connectSocket();

    return () => {
      clearInterval(telemetryInterval);
      socketRef.current?.close();
    };
  }, []);

  const topPlan = state.plans[0];
  const topRun = state.runs[0];
  const approvedSkills = useMemo(
    () => state.skills.filter((skill) => skill.status === "approved").length,
    [state.skills],
  );

  async function loadAll() {
    const [
      bootstrap,
      pillars,
      committees,
      skills,
      workflows,
      plans,
      runs,
      events,
      archives,
      signals,
      telemetry,
    ] = await Promise.all([
      fetchJson<BootstrapPayload>("/api/bootstrap"),
      fetchJson<Pillar[]>("/api/pillars"),
      fetchJson<Committee[]>("/api/committees"),
      fetchJson<SkillArtifact[]>("/api/skills"),
      fetchJson<WorkflowArtifact[]>("/api/workflows"),
      fetchJson<InstitutionalPlan[]>("/api/plans"),
      fetchJson<GovernedRun[]>("/api/runs"),
      fetchJson<EventItem[]>("/api/events"),
      fetchJson<ArchiveEntry[]>("/api/archives"),
      fetchJson<ResearchSignal[]>("/api/research-signals"),
      fetchJson<ControlTelemetry>("/api/telemetry"),
    ]);

    setState({
      bootstrap,
      pillars,
      committees,
      skills,
      workflows,
      plans,
      runs,
      events,
      archives,
      signals,
      telemetry,
    });
  }

  function connectSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "event") {
        setState((current) => ({ ...current, events: [payload.data, ...current.events].slice(0, 120) }));
      }
      if (payload.type === "archive") {
        setState((current) => ({ ...current, archives: [payload.data, ...current.archives].slice(0, 80) }));
      }
      if (payload.type === "run_update") {
        setState((current) => {
          const existing = current.runs.findIndex((run) => run.id === payload.data.id);
          const nextRuns = [...current.runs];
          if (existing === -1) nextRuns.unshift(payload.data);
          else nextRuns[existing] = payload.data;
          return { ...current, runs: nextRuns };
        });
      }
    };

    socket.onclose = () => {
      setTimeout(connectSocket, 2500);
    };
  }

  async function createPlan() {
    if (!intent.trim() || submitting) return;
    setSubmitting(true);
    try {
      const plan = await fetchJson<InstitutionalPlan>("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      setState((current) => ({ ...current, plans: [plan, ...current.plans] }));
      setIntent("");
      setActiveSurface("sunnyvale");
    } finally {
      setSubmitting(false);
    }
  }

  async function launchRun(planId: string) {
    const run = await fetchJson<GovernedRun>("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    setState((current) => ({ ...current, runs: [run, ...current.runs] }));
    setActiveSurface("sunnyvale");
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="absolute inset-0 pointer-events-none hero-mesh opacity-70" />

      <header className="sticky top-0 z-20 border-b border-white/10 backdrop-blur-xl bg-[color:rgba(6,10,15,0.84)]">
        <div className="mx-auto max-w-[1500px] px-6 py-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--muted)]">UACP V3 Control Plane</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white lg:text-5xl">
                Constitutional operating system for AI-native institutions.
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-[var(--soft)] lg:text-base">
                Govern plans, committees, skills, workflows, and replayable evidence as one institutional system.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard label="Determinism" value={`${percent(state.telemetry?.determinismScore)}%`} icon={<Sparkles size={16} />} />
              <MetricCard label="Policy" value={`${percent(state.telemetry?.policyAlignment)}%`} icon={<Shield size={16} />} />
              <MetricCard label="Committees" value={String(state.committees.length)} icon={<Users size={16} />} />
              <MetricCard label="Approved Skills" value={String(approvedSkills)} icon={<BookMarked size={16} />} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="panel p-4">
          <div className="mb-4 flex items-center gap-3 border-b border-white/8 pb-4">
            <div className="rounded-2xl bg-[var(--accent)]/15 p-3 text-[var(--accent)]">
              <Radar size={20} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Surfaces</div>
              <div className="text-sm text-white/90">Four locked product planes</div>
            </div>
          </div>

          <div className="space-y-2">
            {(state.bootstrap?.surfaces ?? []).map((surface) => (
              <button
                key={surface.id}
                onClick={() => setActiveSurface(surface.id)}
                className={`surface-button ${activeSurface === surface.id ? "surface-button-active" : ""}`}
              >
                <div>
                  <div className="text-sm font-medium text-white">{surface.name}</div>
                  <div className="mt-1 text-xs text-[var(--soft)]">{surface.purpose}</div>
                </div>
                <ChevronRight size={16} className="text-[var(--muted)]" />
              </button>
            ))}
          </div>

          <div className="mt-6 border-t border-white/8 pt-5">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Doctrine</div>
            <div className="space-y-3">
              {state.bootstrap?.doctrines.map((doctrine) => (
                <div key={doctrine} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-[var(--soft)]">
                  {doctrine}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="panel overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[1.25fr_0.95fr]">
              <div className="border-b border-white/8 p-6 lg:border-b-0 lg:border-r">
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-[var(--muted)]">
                    {surfaceLabels[activeSurface]}
                  </div>
                  <div className="text-sm text-[var(--soft)]">Intent → reasoning → governance → execution → evidence</div>
                </div>

                <div className="mt-5">
                  <textarea
                    className="h-44 w-full resize-none rounded-[28px] border border-white/10 bg-black/20 px-5 py-4 text-base text-white outline-none transition focus:border-[var(--accent)]/60"
                    placeholder="State the founder objective. UACP V3 will convert it into a governed institutional plan."
                    value={intent}
                    onChange={(event) => setIntent(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void createPlan();
                      }
                    }}
                  />
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[var(--soft)]">
                      Revenue objective, paying user, pricing model, committees, pillars, and evidence path are generated together.
                    </p>
                    <button className="primary-button" onClick={() => void createPlan()} disabled={submitting || !intent.trim()}>
                      {submitting ? "Designing plan..." : "Create governed plan"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Founder readout</div>
                <div className="mt-4 space-y-4">
                  <InsightRow icon={<BadgeDollarSign size={16} />} label="Paying user" value={topPlan?.payingUser || "Founder-led operator teams"} />
                  <InsightRow icon={<Building2 size={16} />} label="Pricing model" value={topPlan?.pricingModel || "Platform license + usage"} />
                  <InsightRow icon={<Gavel size={16} />} label="Committees active" value={String(topPlan?.committeeIds.length ?? state.committees.length)} />
                  <InsightRow icon={<FileStack size={16} />} label="Archive coverage" value={`${percent(state.telemetry?.archiveCoverage)}%`} />
                </div>
              </div>
            </div>
          </div>

          {activeSurface === "deterministic-engine" && (
            <DeterministicEngineView
              signals={state.signals}
              plans={state.plans}
              workflows={state.workflows}
            />
          )}

          {activeSurface === "sunnyvale" && (
            <SunnyvaleView plans={state.plans} runs={state.runs} onLaunchRun={launchRun} />
          )}

          {activeSurface === "silicon-valley" && (
            <SiliconValleyView pillars={state.pillars} committees={state.committees} skills={state.skills} telemetry={state.telemetry} />
          )}

          {activeSurface === "archives" && (
            <ArchivesView archives={state.archives} events={state.events} />
          )}
        </section>

        <aside className="space-y-6">
          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Top plan</div>
                <div className="mt-1 text-lg font-medium text-white">{topPlan?.title || "No active plan"}</div>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
                {topPlan?.status || "idle"}
              </div>
            </div>
            {topPlan ? (
              <div className="space-y-4 text-sm text-[var(--soft)]">
                <p>{topPlan.objective}</p>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Risk tier" value={topPlan.riskTier} />
                  <MiniStat label="Revision" value={String(topPlan.revision)} />
                  <MiniStat label="Pillars" value={String(topPlan.pillars.length)} />
                  <MiniStat label="Votes" value={String(topPlan.votes.length)} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--soft)]">Create an institutional intent to generate the first governed plan.</p>
            )}
          </div>

          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Latest run</div>
              <Activity size={16} className="text-[var(--accent)]" />
            </div>
            {topRun ? (
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-medium text-white">{topRun.currentStage}</div>
                  <div className="text-sm text-[var(--soft)]">{topRun.status} • {topRun.progress}% complete</div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <motion.div className="h-full bg-[var(--accent)]" animate={{ width: `${topRun.progress}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Approvals" value={String(topRun.approvals)} />
                  <MiniStat label="Evidence" value={String(topRun.evidenceCount)} />
                </div>
                {topRun.output && <p className="text-sm text-[var(--soft)]">{topRun.output}</p>}
              </div>
            ) : (
              <p className="text-sm text-[var(--soft)]">Runs appear here after committee admission control opens an execution path.</p>
            )}
          </div>

          <div className="panel p-5">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Event stream</div>
            <div className="space-y-3">
              {state.events.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white">{event.type}</div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">{surfaceLabels[event.surface]}</div>
                  </div>
                  <div className="mt-1 text-sm text-[var(--soft)]">{event.message}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function DeterministicEngineView({
  signals,
  plans,
  workflows,
}: {
  signals: ResearchSignal[];
  plans: InstitutionalPlan[];
  workflows: WorkflowArtifact[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Signal intake</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Research and opportunity pressure</h2>
          </div>
          <Radar size={18} className="text-[var(--accent)]" />
        </div>
        <div className="mt-6 grid gap-4">
          {signals.slice(0, 6).map((signal) => (
            <div key={signal.id} className="rounded-[26px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm uppercase tracking-[0.25em] text-[var(--muted)]">{signal.source}</div>
                <div className="text-sm text-[var(--accent)]">{signal.strength}% match</div>
              </div>
              <div className="mt-2 text-base text-white">{signal.title}</div>
              <div className="mt-2 text-sm text-[var(--soft)]">{signal.category}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Workflow doctrine</div>
          <div className="mt-4 space-y-3">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white">{workflow.name}</div>
                  <ArrowRight size={16} className="text-[var(--accent)]" />
                </div>
                <div className="mt-2 text-sm text-[var(--soft)]">{workflow.description}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)]">{workflow.outcome}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Recent plans</div>
          <div className="mt-4 space-y-3">
            {plans.slice(0, 3).map((plan) => (
              <div key={plan.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-white">{plan.title}</div>
                  <div className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">{plan.status}</div>
                </div>
                <div className="mt-2 text-sm text-[var(--soft)]">{plan.objective}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SunnyvaleView({
  plans,
  runs,
  onLaunchRun,
}: {
  plans: InstitutionalPlan[];
  runs: GovernedRun[];
  onLaunchRun: (planId: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Execution floor</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Governed plans waiting for launch</h2>
          </div>
          <Network size={18} className="text-[var(--accent)]" />
        </div>
        <div className="mt-6 space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-lg text-white">{plan.title}</div>
                  <div className="mt-2 text-sm text-[var(--soft)]">{plan.objective}</div>
                </div>
                <button className="secondary-button" onClick={() => void onLaunchRun(plan.id)}>
                  Launch run
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.graph.nodes.map((node) => (
                  <span key={node.id} className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--soft)]">
                    {node.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Live runs</div>
        <div className="mt-6 space-y-4">
          {runs.length === 0 && <div className="text-sm text-[var(--soft)]">No runs yet.</div>}
          {runs.map((run) => (
            <div key={run.id} className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white">{run.id}</div>
                  <div className="mt-1 text-sm text-[var(--soft)]">{run.currentStage}</div>
                </div>
                <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
                  {run.status}
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <motion.div className="h-full bg-[var(--accent)]" animate={{ width: `${run.progress}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <MiniStat label="Progress" value={`${run.progress}%`} />
                <MiniStat label="Approvals" value={String(run.approvals)} />
                <MiniStat label="Evidence" value={String(run.evidenceCount)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SiliconValleyView({
  pillars,
  committees,
  skills,
  telemetry,
}: {
  pillars: Pillar[];
  committees: Committee[];
  skills: SkillArtifact[];
  telemetry: ControlTelemetry | null;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="panel p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Nine pillars</div>
        <div className="mt-4 grid gap-3">
          {pillars.map((pillar) => (
            <div key={pillar.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="text-white">{pillar.name}</div>
              <div className="mt-1 text-sm text-[var(--soft)]">{pillar.mandate}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)]">{pillar.kpi}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Committee governance</div>
            <Users size={18} className="text-[var(--accent)]" />
          </div>
          <div className="mt-4 space-y-4">
            {committees.map((committee) => (
              <div key={committee.id} className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg text-white">{committee.name}</div>
                  <div className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">{committee.authority}</div>
                </div>
                <div className="mt-2 text-sm text-[var(--soft)]">{committee.purpose}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {committee.allowedActions.map((action) => (
                    <span key={action} className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--soft)]">
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Skill governance</div>
          <div className="mt-4 grid gap-3">
            {skills.map((skill) => (
              <div key={skill.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-white">{skill.name}</div>
                  <div className={`text-xs uppercase tracking-[0.25em] ${skill.status === "approved" ? "text-emerald-300" : "text-amber-300"}`}>
                    {skill.status}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--soft)]">{skill.description}</div>
                <div className="mt-2 text-xs text-[var(--muted)]">{skill.source} • {skill.ref}</div>
              </div>
            ))}
          </div>

          {telemetry && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              {telemetry.metrics.map((metric) => (
                <MiniStat key={metric.label} label={metric.label} value={`${metric.value}${metric.unit}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArchivesView({
  archives,
  events,
}: {
  archives: ArchiveEntry[];
  events: EventItem[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Replay packages</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Institutional memory</h2>
          </div>
          <BookMarked size={18} className="text-[var(--accent)]" />
        </div>
        <div className="mt-6 space-y-4">
          {archives.map((archive) => (
            <div key={archive.id} className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-white">{archive.title}</div>
                <div className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">{archive.category}</div>
              </div>
              <div className="mt-2 text-sm text-[var(--soft)]">{archive.summary}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {archive.lineage.map((item) => (
                  <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--soft)]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Ordered events</div>
        <div className="mt-6 space-y-3">
          {events.map((event) => (
            <div key={event.id} className="flex gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mt-1 text-[var(--accent)]">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div className="text-white">{event.type}</div>
                <div className="mt-1 text-sm text-[var(--soft)]">{event.message}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                  {surfaceLabels[event.surface]} • {new Date(event.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center justify-between text-[var(--muted)]">
        <span className="text-xs uppercase tracking-[0.25em]">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</div>
    </div>
  );
}

function InsightRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <div className="rounded-xl bg-white/[0.04] p-2 text-[var(--accent)]">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">{label}</div>
        <div className="mt-1 text-sm text-white">{value}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-[0.25em] text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-base text-white">{value}</div>
    </div>
  );
}

function percent(value?: number) {
  if (typeof value !== "number") return 0;
  return Math.round(value * 1000) / 10;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
