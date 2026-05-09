import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BadgeDollarSign,
  BookMarked,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronRight,
  Disc,
  Gavel,
  Layers,
  LibraryBig,
  Network,
  Radar,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { DeterministicEngineSurface } from "./components/DeterministicEngineSurface";
import type {
  ArchiveEntry,
  BackendProductEvent,
  BackendTruthSummary,
  BootstrapPayload,
  Committee,
  CommandCenterSnapshot,
  ControlTelemetry,
  EngineObservability,
  EngineSignal,
  EventItem,
  GovernedRun,
  InstitutionalPlan,
  OperatorCommittee,
  OperatorRun,
  OperatorWorker,
  Pillar,
  ResearchSignal,
  ResearchSourceStatus,
  SkillArtifact,
  SurfaceId,
  WorkerRuntimeState,
  WorkflowArtifact,
} from "./types";

type DataState = {
  bootstrap: BootstrapPayload | null;
  pillars: Pillar[];
  committees: Committee[];
  operatorCommittees: OperatorCommittee[];
  workers: OperatorWorker[];
  workerRuntime: WorkerRuntimeState[];
  operatorRuns: OperatorRun[];
  skills: SkillArtifact[];
  workflows: WorkflowArtifact[];
  backendSummary: BackendTruthSummary | null;
  backendEvents: BackendProductEvent[];
  commandCenter: CommandCenterSnapshot | null;
  plans: InstitutionalPlan[];
  runs: GovernedRun[];
  events: EventItem[];
  archives: ArchiveEntry[];
  researchSignals: ResearchSignal[];
  researchStatus: ResearchSourceStatus[];
  engineSignals: EngineSignal[];
  telemetry: ControlTelemetry | null;
  observability: EngineObservability | null;
};

const initialState: DataState = {
  bootstrap: null,
  pillars: [],
  committees: [],
  operatorCommittees: [],
  workers: [],
  workerRuntime: [],
  operatorRuns: [],
  skills: [],
  workflows: [],
  backendSummary: null,
  backendEvents: [],
  commandCenter: null,
  plans: [],
  runs: [],
  events: [],
  archives: [],
  researchSignals: [],
  researchStatus: [],
  engineSignals: [],
  telemetry: null,
  observability: null,
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
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [intent, setIntent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    void loadAll();

    const interval = setInterval(() => {
      void Promise.all([
        fetchJson<ControlTelemetry>("/api/telemetry"),
        fetchJson<EngineObservability>("/api/observability/signals"),
        fetchJson<WorkerRuntimeState[]>("/api/operator-runtime"),
        fetchJson<OperatorRun[]>("/api/operator-runs"),
        fetchJson<BackendTruthSummary>("/api/backend-summary"),
        fetchJson<BackendProductEvent[]>("/api/backend-events"),
        fetchJson<CommandCenterSnapshot>("/api/command-center"),
      ])
        .then(([telemetry, observability, workerRuntime, operatorRuns, backendSummary, backendEvents, commandCenter]) =>
          setState((current) => ({
            ...current,
            telemetry,
            observability,
            workerRuntime,
            operatorRuns,
            backendSummary,
            backendEvents,
            commandCenter,
          })),
        )
        .catch(() => {});
    }, 4000);

    connectSocket();

    return () => {
      clearInterval(interval);
      socketRef.current?.close();
    };
  }, []);

  const approvedSkills = useMemo(
    () => state.skills.filter((skill) => skill.status === "approved").length,
    [state.skills],
  );

  const activePlan = useMemo(() => {
    if (selectedPlanId) {
      const selected = state.plans.find((plan) => plan.id === selectedPlanId);
      if (selected) return selected;
    }
    return state.plans[0];
  }, [selectedPlanId, state.plans]);

  const latestRun = state.runs[0];

  async function loadAll() {
    const [
      bootstrap,
      pillars,
      committees,
      operatorCommittees,
      workers,
      workerRuntime,
      operatorRuns,
      skills,
      workflows,
      backendSummary,
      backendEvents,
      commandCenter,
      plans,
      runs,
      events,
      archives,
      researchSignals,
      researchStatus,
      engineSignals,
      telemetry,
      observability,
    ] = await Promise.all([
      fetchJson<BootstrapPayload>("/api/bootstrap"),
      fetchJson<Pillar[]>("/api/pillars"),
      fetchJson<Committee[]>("/api/committees"),
      fetchJson<OperatorCommittee[]>("/api/operator-committees"),
      fetchJson<OperatorWorker[]>("/api/operators"),
      fetchJson<WorkerRuntimeState[]>("/api/operator-runtime"),
      fetchJson<OperatorRun[]>("/api/operator-runs"),
      fetchJson<SkillArtifact[]>("/api/skills"),
      fetchJson<WorkflowArtifact[]>("/api/workflows"),
      fetchJson<BackendTruthSummary>("/api/backend-summary"),
      fetchJson<BackendProductEvent[]>("/api/backend-events"),
      fetchJson<CommandCenterSnapshot>("/api/command-center"),
      fetchJson<InstitutionalPlan[]>("/api/plans"),
      fetchJson<GovernedRun[]>("/api/runs"),
      fetchJson<EventItem[]>("/api/events"),
      fetchJson<ArchiveEntry[]>("/api/archives"),
      fetchJson<ResearchSignal[]>("/api/research-signals"),
      fetchJson<ResearchSourceStatus[]>("/api/research-status"),
      fetchJson<EngineSignal[]>("/api/ssrn-signals"),
      fetchJson<ControlTelemetry>("/api/telemetry"),
      fetchJson<EngineObservability>("/api/observability/signals"),
    ]);

    setState({
      bootstrap,
      pillars,
      committees,
      operatorCommittees,
      workers,
      workerRuntime,
      operatorRuns,
      skills,
      workflows,
      backendSummary,
      backendEvents,
      commandCenter,
      plans,
      runs,
      events,
      archives,
      researchSignals,
      researchStatus,
      engineSignals,
      telemetry,
      observability,
    });

    if (!selectedPlanId && plans[0]) {
      setSelectedPlanId(plans[0].id);
    }
  }

  function connectSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "event") {
        setState((current) => ({
          ...current,
          events: current.events.some((item) => item.id === payload.data.id)
            ? current.events
            : [payload.data, ...current.events].slice(0, 120),
        }));
      }

      if (payload.type === "archive") {
        setState((current) => ({
          ...current,
          archives: current.archives.some((item) => item.id === payload.data.id)
            ? current.archives
            : [payload.data, ...current.archives].slice(0, 80),
        }));
      }

      if (payload.type === "run_update") {
        setState((current) => ({
          ...current,
          runs: upsertById(current.runs, payload.data),
        }));
      }

      if (payload.type === "operator_run_update") {
        setState((current) => ({
          ...current,
          operatorRuns: upsertById(current.operatorRuns, payload.data),
        }));
      }

      if (payload.type === "backend_event") {
        setState((current) => ({
          ...current,
          backendEvents: current.backendEvents.some((item) => item.eventId === payload.data.eventId)
            ? current.backendEvents
            : [payload.data, ...current.backendEvents].slice(0, 200),
        }));
      }
    };

    socket.onclose = () => {
      setTimeout(connectSocket, 2500);
    };
  }

  async function createPlan(): Promise<InstitutionalPlan | null> {
    if (!intent.trim() || submitting) return null;
    setSubmitting(true);
    try {
      const plan = await fetchJson<InstitutionalPlan>("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      setState((current) => ({
        ...current,
        plans: [plan, ...current.plans.filter((entry) => entry.id !== plan.id)],
      }));
      setSelectedPlanId(plan.id);
      setIntent("");
      return plan;
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

    setState((current) => ({
      ...current,
      runs: [run, ...current.runs.filter((entry) => entry.id !== run.id)],
    }));
  }

  function routeToSunnyvale(planId: string) {
    setSelectedPlanId(planId);
    setActiveSurface("sunnyvale");
  }

  return (
    <div className="h-screen flex flex-col bg-[#050505] text-[#e0e0e0] font-sans selection:bg-blue-500/30 overflow-hidden relative">
      <div className="absolute inset-0 scanner pointer-events-none z-0 opacity-40" />

      <header className="relative z-10 border-b border-white/10 bg-[#0a0a0a] shadow-2xl">
        <div className="h-16 px-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden relative">
              <motion.div
                className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              <Zap size={16} className="text-white fill-current relative z-10" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif italic text-xl tracking-tight leading-none text-white/90">UACP V3</span>
              <span className="text-[8px] font-mono tracking-[0.4em] uppercase text-blue-400/60 mt-1">
                V2 executes / V3 governs
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-10 text-[10px] uppercase tracking-[0.25em] font-bold text-white/40">
            {(state.bootstrap?.surfaces ?? []).map((surface) => (
              <SurfaceButton
                key={surface.id}
                active={activeSurface === surface.id}
                label={surface.name}
                onClick={() => setActiveSurface(surface.id)}
              />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <MetricPill label="Policy" value={`${percent(state.telemetry?.policyAlignment)}%`} />
            <MetricPill label="Committees" value={String(state.committees.length)} />
            <MetricPill label="Skills" value={String(approvedSkills)} />
          </div>
        </div>

        <div className="px-8 pb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-wrap gap-2">
            {(state.bootstrap?.doctrines ?? []).map((doctrine) => (
              <span
                key={doctrine}
                className="px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-[10px] text-white/55"
              >
                {doctrine}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Top plan" value={activePlan?.title || "No active plan"} />
            <SummaryCard label="Risk tier" value={activePlan?.riskTier || "idle"} />
            <SummaryCard label="Revision" value={activePlan ? String(activePlan.revision) : "0"} />
            <SummaryCard label="Votes" value={activePlan ? String(activePlan.votes.length) : "0"} />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-hidden p-4">
        {activeSurface === "deterministic-engine" ? (
          <DeterministicEngineSurface
            identity={state.bootstrap?.userEmail || "FOUNDER"}
            intent={intent}
            loading={submitting}
            plans={state.plans}
            runs={state.runs}
            events={state.events}
            committees={state.committees}
            signals={state.engineSignals}
            observability={state.observability}
            onIntentChange={setIntent}
            onCreatePlan={createPlan}
            onRouteToSunnyvale={routeToSunnyvale}
          />
        ) : (
          <div className="h-full grid grid-cols-12 gap-4">
            {activeSurface === "sunnyvale" && (
              <SunnyvaleSurface
                plan={activePlan}
                plans={state.plans}
                runs={state.runs}
                workflows={state.workflows}
                committees={state.committees}
                onSelectPlan={(planId) => setSelectedPlanId(planId)}
                onLaunchRun={launchRun}
              />
            )}

            {activeSurface === "silicon-valley" && (
              <SiliconValleySurface
                pillars={state.pillars}
                committees={state.committees}
                operatorCommittees={state.operatorCommittees}
                workers={state.workers}
                workerRuntime={state.workerRuntime}
                operatorRuns={state.operatorRuns}
                skills={state.skills}
                backendSummary={state.backendSummary}
                backendEvents={state.backendEvents}
                commandCenter={state.commandCenter}
                researchStatus={state.researchStatus}
                telemetry={state.telemetry}
                observability={state.observability}
              />
            )}

            {activeSurface === "archives" && (
              <ArchivesSurface archives={state.archives} events={state.events} latestRun={latestRun} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SunnyvaleSurface({
  plan,
  plans,
  runs,
  workflows,
  committees,
  onSelectPlan,
  onLaunchRun,
}: {
  plan?: InstitutionalPlan;
  plans: InstitutionalPlan[];
  runs: GovernedRun[];
  workflows: WorkflowArtifact[];
  committees: Committee[];
  onSelectPlan: (planId: string) => void;
  onLaunchRun: (planId: string) => Promise<void>;
}) {
  return (
    <>
      <section className="col-span-8 h-full overflow-hidden glass-panel border border-white/5">
        <div className="p-6 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-serif italic text-3xl text-white/90">Sunnyvale</h2>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold mt-1">
                Execution floor / approval before run
              </p>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-[9px] font-mono uppercase tracking-[0.25em] text-blue-300">
              review before admission
            </div>
          </div>
        </div>

        <div className="h-[calc(100%-109px)] overflow-y-auto custom-scrollbar p-6 space-y-6">
          {plan ? (
            <>
              <Panel title="Governed plan review" icon={<BrainCircuit size={14} className="text-blue-400" />}>
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="text-white text-2xl">{plan.title}</div>
                      <p className="mt-3 text-sm text-white/55 italic">{plan.objective}</p>
                    </div>
                    <button
                      onClick={() => void onLaunchRun(plan.id)}
                      className="px-5 py-3 border border-white/10 text-[10px] uppercase font-bold tracking-[0.3em] hover:bg-white hover:text-black transition-all active:scale-95"
                    >
                      Approve & Launch Run
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    <MiniStat icon={<Building2 size={12} />} label="Paying user" value={plan.payingUser} />
                    <MiniStat icon={<BadgeDollarSign size={12} />} label="Pricing" value={plan.pricingModel} />
                    <MiniStat icon={<Gavel size={12} />} label="Risk" value={plan.riskTier} />
                    <MiniStat icon={<Layers size={12} />} label="Revision" value={String(plan.revision)} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <TokenPanel title="Pillars" items={plan.pillars} />
                    <TokenPanel title="Committees" items={plan.committeeIds.map((committeeId) => resolveCommittee(committeeId, committees))} />
                    <TokenPanel title="Workflows" items={plan.workflowIds} />
                    <TokenPanel title="Skills" items={plan.skillIds} />
                    <TokenPanel title="Escalation rules" items={plan.escalationRuleIds} />
                    <ListPanel title="Guardrails" items={plan.guardrails} />
                    <ListPanel title="Success metrics" items={plan.successMetrics} />
                    <ValuePanel title="Research query" value={plan.researchQuery || "No live research query recorded for this plan."} />
                    <ReferencePanel title="Live references" references={plan.researchReferences || []} />
                    <ProposalPanel title="Governance proposals" proposals={plan.proposals || []} />
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-white/25 font-bold">Execution graph</div>
                    {plan.graph.nodes.map((node) => (
                      <div key={node.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-white">{node.label}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/25">{node.stage}</div>
                          </div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-blue-300">
                            {resolveCommittee(node.ownerCommitteeId, committees)}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-white/55">{node.summary}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-white/25 font-bold">Committee votes</div>
                    {plan.votes.map((vote) => (
                      <div key={`${vote.member}-${vote.model}`} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-white">{vote.member}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/25">{vote.model}</div>
                          </div>
                          <div
                            className={`text-[10px] font-mono uppercase tracking-[0.25em] ${
                              vote.vote === "approve"
                                ? "text-green-400"
                                : vote.vote === "veto"
                                  ? "text-red-400"
                                  : "text-amber-300"
                            }`}
                          >
                            {vote.vote}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-white/55 italic">{vote.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel title="Queued plans" icon={<Network size={14} className="text-blue-400" />}>
                <div className="space-y-3">
                  {plans.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => onSelectPlan(entry.id)}
                      className={`w-full text-left p-4 rounded-xl border transition ${
                        plan.id === entry.id
                          ? "border-blue-500/30 bg-blue-500/10"
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-white">{entry.title}</div>
                        <ChevronRight size={14} className="text-white/30" />
                      </div>
                      <div className="mt-2 text-sm text-white/50">{entry.objective}</div>
                    </button>
                  ))}
                </div>
              </Panel>
            </>
          ) : (
            <EmptyState
              icon={<Disc size={44} />}
              title="No reviewed plan in Sunnyvale"
              body="Compile a plan in the Deterministic Engine first, then route it here for approval."
            />
          )}
        </div>
      </section>

      <section className="col-span-4 h-full overflow-hidden flex flex-col gap-4">
        <Panel title="Live runs" icon={<Activity size={14} className="text-blue-400" />}>
          <div className="space-y-4">
            {runs.length === 0 && (
              <div className="text-sm text-white/45 italic">No runs yet. Approval here opens the first governed run.</div>
            )}
            {runs.map((run) => (
              <div key={run.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-white">{run.id}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/25">{run.currentStage}</div>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-blue-300">{run.status}</div>
                </div>
                <div className="mt-4 h-2 bg-white/5 overflow-hidden rounded-full">
                  <motion.div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500" animate={{ width: `${run.progress}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniStat icon={<ShieldCheck size={12} />} label="Approvals" value={String(run.approvals)} />
                  <MiniStat icon={<BookMarked size={12} />} label="Evidence" value={String(run.evidenceCount)} />
                </div>
                {run.output && <p className="mt-4 text-sm text-white/55 italic">{run.output}</p>}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Workflow doctrine" icon={<LibraryBig size={14} className="text-blue-400" />}>
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="text-white">{workflow.name}</div>
                <div className="mt-2 text-sm text-white/55">{workflow.description}</div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-white/25">{workflow.outcome}</div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function SiliconValleySurface({
  pillars,
  committees,
  operatorCommittees,
  workers,
  workerRuntime,
  operatorRuns,
  skills,
  backendSummary,
  backendEvents,
  commandCenter,
  researchStatus,
  telemetry,
  observability,
}: {
  pillars: Pillar[];
  committees: Committee[];
  operatorCommittees: OperatorCommittee[];
  workers: OperatorWorker[];
  workerRuntime: WorkerRuntimeState[];
  operatorRuns: OperatorRun[];
  skills: SkillArtifact[];
  backendSummary: BackendTruthSummary | null;
  backendEvents: BackendProductEvent[];
  commandCenter: CommandCenterSnapshot | null;
  researchStatus: ResearchSourceStatus[];
  telemetry: ControlTelemetry | null;
  observability: EngineObservability | null;
}) {
  const runtimeByWorkerId = new Map(workerRuntime.map((runtime) => [runtime.workerId, runtime]));

  return (
    <>
      <section className="col-span-4 h-full overflow-y-auto custom-scrollbar glass-panel border border-white/5">
        <div className="p-6 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
          <h2 className="font-serif italic text-3xl text-white/90">Silicon Valley</h2>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold mt-1">
            Founder governance / backend truth / worker ownership
          </p>
        </div>

        <div className="p-6 space-y-4">
          <Panel title="Command Center truth" icon={<Building2 size={14} className="text-blue-400" />}>
            {commandCenter ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat icon={<Users size={12} />} label="Workers" value={String(commandCenter.institution.workerCount)} />
                  <MiniStat icon={<Activity size={12} />} label="Operator runs" value={String(commandCenter.institution.operatorRunCount)} />
                  <MiniStat icon={<ShieldCheck size={12} />} label="Escalations" value={String(commandCenter.institution.openEscalations)} />
                  <MiniStat icon={<Disc size={12} />} label="Archives" value={String(commandCenter.institution.archiveCount)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat icon={<Users size={12} />} label="Live users" value={String(commandCenter.backend.liveUsers)} />
                  <MiniStat icon={<BadgeDollarSign size={12} />} label="Revenue" value={`$${commandCenter.backend.revenue.toFixed(2)}`} />
                  <MiniStat icon={<LibraryBig size={12} />} label="Evaluations" value={String(commandCenter.backend.evaluationsStarted)} />
                  <MiniStat icon={<Gavel size={12} />} label="Reserve" value={`$${commandCenter.backend.reserveBalance.toFixed(2)}`} />
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/45 italic">Command Center state is still loading.</div>
            )}
          </Panel>

          <Panel title="Backend truth" icon={<Radar size={14} className="text-blue-400" />}>
            {backendSummary ? (
              <div className="grid grid-cols-2 gap-3">
                <MiniStat icon={<Users size={12} />} label="Signups" value={String(backendSummary.signups)} />
                <MiniStat icon={<Building2 size={12} />} label="Marketplace installs" value={String(backendSummary.marketplaceInstalls)} />
                <MiniStat icon={<LibraryBig size={12} />} label="Evidence exports" value={String(backendSummary.evidenceExports)} />
                <MiniStat icon={<ShieldCheck size={12} />} label="MFA events" value={String(backendSummary.mfaEvents)} />
                <MiniStat icon={<Activity size={12} />} label="Endpoint calls" value={String(backendSummary.endpointCalls)} />
                <MiniStat icon={<Gavel size={12} />} label="Failed routes" value={String(backendSummary.failedRoutes)} />
              </div>
            ) : (
              <div className="text-sm text-white/45 italic">No backend truth has been ingested yet.</div>
            )}
          </Panel>

          {pillars.map((pillar) => (
            <div key={pillar.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="text-white">{pillar.name}</div>
              <div className="mt-2 text-sm text-white/55">{pillar.mandate}</div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-blue-300">{pillar.kpi}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="col-span-5 h-full overflow-y-auto custom-scrollbar glass-panel border border-white/5">
        <div className="p-6 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-center gap-3">
            <Users size={16} className="text-blue-400" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-bold">Institutional ownership</div>
              <div className="text-white text-xl mt-1">Committees, worker registry, and run accountability</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {committees.map((committee) => (
            <div key={committee.id} className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-white text-lg">{committee.name}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-blue-300">{committee.authority}</div>
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/25">{committee.chair}</div>
              </div>
              <p className="mt-3 text-sm text-white/55">{committee.purpose}</p>
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/25 mb-2">Allowed actions</div>
                <div className="flex flex-wrap gap-2">
                  {committee.allowedActions.map((action) => (
                    <span key={action} className="px-3 py-1 rounded-full border border-white/10 text-[10px] text-white/55">
                      {action}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/25 mb-2">Veto conditions</div>
                <div className="space-y-2">
                  {committee.vetoConditions.map((condition) => (
                    <div key={condition} className="text-sm text-white/50 italic">{condition}</div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <Panel title="Operator committees" icon={<Layers size={14} className="text-blue-400" />}>
            <div className="space-y-3">
              {operatorCommittees.map((committee) => (
                <div key={committee.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="text-white">{committee.name}</div>
                  <div className="mt-2 text-sm text-white/55">{committee.purpose}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {committee.workerIds.map((workerId) => (
                      <span key={workerId} className="px-3 py-1 rounded-full border border-white/10 text-[10px] text-white/55">
                        {workers.find((worker) => worker.id === workerId)?.displayName || workerId}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Named worker registry" icon={<Network size={14} className="text-blue-400" />}>
            <div className="space-y-3">
              {workers.map((worker) => {
                const runtime = runtimeByWorkerId.get(worker.id);
                return (
                  <div key={worker.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-white">{worker.displayName}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-blue-300">{worker.schedule}</div>
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/35">
                        {runtime?.status || "idle"}
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-white/55">{worker.purpose}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <MiniStat
                        icon={<Building2 size={12} />}
                        label="Committee"
                        value={operatorCommittees.find((committee) => committee.id === worker.committeeId)?.name || worker.committeeId}
                      />
                      <MiniStat icon={<Layers size={12} />} label="Primary pillar" value={worker.primaryPillar} />
                      <MiniStat icon={<Activity size={12} />} label="Last run" value={runtime?.lastRunAt ? new Date(runtime.lastRunAt).toLocaleTimeString() : "none"} />
                      <MiniStat icon={<Radar size={12} />} label="Next run" value={runtime?.nextRunAt ? new Date(runtime.nextRunAt).toLocaleTimeString() : "paused"} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Recent operator runs" icon={<Disc size={14} className="text-blue-400" />}>
            <div className="space-y-3">
              {operatorRuns.length === 0 && (
                <div className="text-sm text-white/45 italic">No operator runs have been recorded yet.</div>
              )}
              {operatorRuns.slice(0, 10).map((run) => (
                <div key={run.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-white">{workers.find((worker) => worker.id === run.workerId)?.displayName || run.workerId}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/25">{run.id}</div>
                    </div>
                    <div className={`text-[10px] font-mono uppercase tracking-[0.25em] ${run.status === "completed" ? "text-green-400" : run.status === "escalated" ? "text-amber-300" : run.status === "failed" ? "text-red-400" : "text-blue-300"}`}>
                      {run.status}
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-white/55">{run.nextRecommendation}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      <section className="col-span-3 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4">
        <Panel title="Skill governance" icon={<BookMarked size={14} className="text-blue-400" />}>
          <div className="space-y-3">
            {skills.map((skill) => (
              <div key={skill.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white">{skill.name}</div>
                  <div className={`text-[10px] font-mono uppercase tracking-[0.25em] ${skill.status === "approved" ? "text-green-400" : "text-amber-300"}`}>
                    {skill.status}
                  </div>
                </div>
                <div className="mt-2 text-sm text-white/55">{skill.description}</div>
                <div className="mt-3 text-[10px] uppercase tracking-[0.25em] text-white/25">{skill.source} / {skill.ref}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Backend event feed" icon={<Activity size={14} className="text-blue-400" />}>
          <div className="space-y-3">
            {backendEvents.length === 0 && (
              <div className="text-sm text-white/45 italic">No backend events have been ingested into UACP yet.</div>
            )}
            {backendEvents.slice(0, 8).map((event) => (
              <div key={event.eventId} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white">{event.eventType}</div>
                  <div className={`text-[10px] font-mono uppercase tracking-[0.25em] ${event.severity === "critical" ? "text-red-400" : event.severity === "warning" ? "text-amber-300" : "text-blue-300"}`}>
                    {event.severity}
                  </div>
                </div>
                <div className="mt-2 text-sm text-white/55">{event.entityType} / {event.entityId}</div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-white/25">
                  {event.workerIds.length} workers / {event.committeeIds.length} committees
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Research ingress" icon={<LibraryBig size={14} className="text-blue-400" />}>
          <div className="space-y-3">
            {researchStatus.length === 0 && (
              <div className="text-sm text-white/45 italic">No source status yet. Trigger a research refresh or compile a plan.</div>
            )}
            {researchStatus.map((status) => (
              <div key={status.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white">{status.name}</div>
                  <div
                    className={`text-[10px] font-mono uppercase tracking-[0.25em] ${
                      status.status === "online"
                        ? "text-green-400"
                        : status.status === "degraded"
                          ? "text-amber-300"
                          : "text-red-400"
                    }`}
                  >
                    {status.status}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <MiniStat icon={<Activity size={12} />} label="Items" value={String(status.itemCount)} />
                  <MiniStat icon={<Radar size={12} />} label="Latency" value={status.lastLatencyMs ? `${status.lastLatencyMs}ms` : "n/a"} />
                </div>
                {status.error && <div className="mt-3 text-xs text-white/45 italic">{status.error}</div>}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Institutional metrics" icon={<Radar size={14} className="text-blue-400" />}>
          <div className="space-y-3">
            {(telemetry?.metrics ?? []).map((metric) => (
              <div key={metric.label} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white">{metric.label}</div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-blue-300">
                    {metric.value}{metric.unit}
                  </div>
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-white/25">{metric.trend}</div>
              </div>
            ))}
            {observability && (
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="text-white">UACP Pressure</div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-blue-300">
                  {(observability.uacp_pressure * 100).toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        </Panel>
      </section>
    </>
  );
}

function ArchivesSurface({
  archives,
  events,
  latestRun,
}: {
  archives: ArchiveEntry[];
  events: EventItem[];
  latestRun?: GovernedRun;
}) {
  return (
    <>
      <section className="col-span-7 h-full overflow-y-auto custom-scrollbar glass-panel border border-white/5">
        <div className="p-6 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
          <h2 className="font-serif italic text-3xl text-white/90">Archives</h2>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold mt-1">
            Replayable evidence / lineage / ordered memory
          </p>
        </div>

        <div className="p-6 space-y-4">
          {archives.map((archive) => (
            <div key={archive.id} className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-white text-lg">{archive.title}</div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-blue-300">{archive.category}</div>
              </div>
              <p className="mt-3 text-sm text-white/55">{archive.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {archive.lineage.map((item) => (
                  <span key={item} className="px-3 py-1 rounded-full border border-white/10 text-[10px] text-white/55">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="col-span-5 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4">
        <Panel title="Ordered events" icon={<CheckCircle2 size={14} className="text-blue-400" />}>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white">{event.type}</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-white/25">{surfaceLabels[event.surface]}</div>
                </div>
                <p className="mt-2 text-sm text-white/55">{event.message}</p>
                <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-blue-300">
                  {new Date(event.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Latest run evidence" icon={<Disc size={14} className="text-blue-400" />}>
          {latestRun ? (
            <div className="space-y-4">
              <div>
                <div className="text-white text-lg">{latestRun.id}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/25">{latestRun.currentStage}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat icon={<ShieldCheck size={12} />} label="Approvals" value={String(latestRun.approvals)} />
                <MiniStat icon={<BookMarked size={12} />} label="Evidence" value={String(latestRun.evidenceCount)} />
                <MiniStat icon={<Activity size={12} />} label="Progress" value={`${latestRun.progress}%`} />
                <MiniStat icon={<Disc size={12} />} label="Status" value={latestRun.status} />
              </div>
              {latestRun.output && <p className="text-sm text-white/55 italic">{latestRun.output}</p>}
              {latestRun.artifact && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="text-white">{latestRun.artifact.title}</div>
                  <div className="text-sm text-white/55">{latestRun.artifact.summary}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat icon={<LibraryBig size={12} />} label="Sources" value={String(latestRun.artifact.sourceCount)} />
                    <MiniStat icon={<Layers size={12} />} label="Workflows" value={String(latestRun.artifact.workflowIds.length)} />
                  </div>
                  <div className="text-xs text-white/50 italic">{latestRun.artifact.nextAction}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-white/45 italic">No run evidence yet.</div>
          )}
        </Panel>
      </section>
    </>
  );
}

function SurfaceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative py-1 transition-all group outline-none ${active ? "text-white" : "text-white/40 hover:text-white/70"}`}
    >
      {label}
      {active && (
        <motion.div
          layoutId="surface-tab"
          className="absolute -bottom-1 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
        />
      )}
    </button>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 border border-white/10 rounded-full bg-white/5 backdrop-blur-sm">
      <ArrowUpRight size={10} className="text-blue-400" />
      <span className="text-[9px] font-mono lowercase tracking-normal text-white/60">{label} {value}</span>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-mono">{label}</div>
      <div className="mt-1 text-sm text-white/75 truncate">{value}</div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="glass-panel border border-white/5 overflow-hidden">
      <div className="p-5 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent flex items-center gap-3">
        {icon}
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-bold">{title}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
      <div className="flex items-center gap-2 text-blue-300 mb-1">
        {icon}
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/25">{label}</span>
      </div>
      <div className="text-[11px] text-white/70">{value}</div>
    </div>
  );
}

function TokenPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/25 mb-3">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="px-3 py-1 rounded-full border border-white/10 text-[10px] text-white/55">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/25 mb-3">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="text-sm text-white/55 italic">{item}</div>
        ))}
      </div>
    </div>
  );
}

function ValuePanel({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/25 mb-3">{title}</div>
      <div className="text-sm text-white/65 leading-relaxed">{value}</div>
    </div>
  );
}

function ReferencePanel({
  title,
  references,
}: {
  title: string;
  references: Array<{ title: string; source: string; url?: string; publishedAt?: string }>;
}) {
  return (
    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/25 mb-3">{title}</div>
      <div className="space-y-3">
        {references.length === 0 && <div className="text-sm text-white/45 italic">No live references attached yet.</div>}
        {references.map((reference) => (
          <div key={`${reference.source}-${reference.title}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="text-sm text-white/70">{reference.title}</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-blue-300">
              {reference.source}
              {reference.publishedAt ? ` / ${new Date(reference.publishedAt).toLocaleDateString()}` : ""}
            </div>
            {reference.url && (
              <a
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-[10px] uppercase tracking-[0.25em] text-white/45 hover:text-blue-300 transition-colors"
              >
                Open source
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposalPanel({
  title,
  proposals,
}: {
  title: string;
  proposals: Array<{ id: string; type: string; name: string; rationale: string; status: string }>;
}) {
  return (
    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/25 mb-3">{title}</div>
      <div className="space-y-3">
        {proposals.length === 0 && <div className="text-sm text-white/45 italic">No new governance objects were proposed.</div>}
        {proposals.map((proposal) => (
          <div key={proposal.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/70">{proposal.name}</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-amber-300">{proposal.status}</div>
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-blue-300">{proposal.type}</div>
            <div className="mt-2 text-sm text-white/55 italic">{proposal.rationale}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-6">
      {icon}
      <span className="font-serif italic text-xl">{title}</span>
      <p className="max-w-xl text-center text-sm text-white/45">{body}</p>
    </div>
  );
}

function resolveCommittee(id: string, committees: Committee[]) {
  return committees.find((committee) => committee.id === id)?.name || id;
}

function upsertById<T extends { id: string }>(list: T[], item: T) {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [item, ...list];
  const next = [...list];
  next[index] = item;
  return next;
}

function percent(value?: number) {
  if (typeof value !== "number") return "0.0";
  return (Math.round(value * 1000) / 10).toFixed(1);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
