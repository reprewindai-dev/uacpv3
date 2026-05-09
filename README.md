# UACP V3 Control Plane

**Root = UACP V3 control plane. Nested `source-uacpgemini` = UACP V2 working reference copy.**

UACP V3 is the institutional control plane built on top of Quantum UACP and UACPGemini. The root app keeps the actual V2 Deterministic Engine as a surface inside a broader V3 institution:

- `Deterministic Engine`: live research ingestion, plan compilation, run telemetry, compiled artifacts
- `Sunnyvale`: plan review, approval, execution, workflows, live runs
- `Silicon Valley`: founder governance, pillars, committees, skills, source health
- `Archives`: replayable evidence, ordered events, compiled artifact memory

## Canonical structure

```txt
system-uacp-v3-control-plane-you/
├── README.md
├── UACP-V3-MASTER-PROMPT.md
├── UACP-V3-PROMPT-1-SYSTEM.md
├── UACP-V3-PROMPT-2-SKILLS-BUILDERS.md
├── package.json
├── render.yaml
├── server.ts
├── src/
├── data/
├── source-uacpgemini/
├── source-uacp-v1/
└── source-genai-processors/
```

Naming rule:

- `UACP V3 root project` = repository root
- `UACP V2 nested working copy` = `source-uacpgemini`
- `V2 executes; V3 governs.`

## What is real in the root app

- Live public-source research ingestion from:
  - arXiv
  - PubMed
  - Crossref
  - Zenodo
- Persistent file-backed control-plane state in `data/control-plane-state.json`
- Persistent governed registry in `data/governance-registry.json`
- Real plan compilation grounded in live references
- Real governed run stages with compiled artifacts
- Real archive records and ordered event logs
- Real source-health reporting with latency, item counts, and error state
- Telemetry derived from actual plans, runs, archives, and source status
- Real named worker registry, operator runtime, backend-event ingestion, and Command Center truth

The root app does not use seeded plans, hardcoded research cards, or artificial run generation.

## How the root app works

1. Enter intent in `Deterministic Engine`
2. Compile a governed plan
3. Review the plan, live references, pillars, committees, votes, and graph
4. Route the plan into `Sunnyvale`
5. Approve and launch the governed run
6. Inspect stage-by-stage execution telemetry
7. Open the compiled artifact
8. Verify evidence in `Archives`

## API

- `GET /api/bootstrap`
- `GET /api/governance-registry`
- `GET /api/pillars`
- `GET /api/committees`
- `GET /api/operator-committees`
- `GET /api/operators`
- `GET /api/operator-runtime`
- `GET /api/operator-runs`
- `GET /api/skills`
- `GET /api/workflows`
- `GET /api/escalation-rules`
- `GET /api/backend-summary`
- `GET /api/backend-events`
- `GET /api/command-center`
- `GET /api/research-signals`
- `GET /api/research-status`
- `POST /api/research-refresh`
- `GET /api/plans`
- `POST /api/plans`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/events`
- `GET /api/archives`
- `GET /api/telemetry`
- `GET /api/observability/signals`
- `GET /api/ssrn-signals`

Protected internal mutation routes:

- `PUT /api/governance-registry`
- `POST /api/v1/internal/backend/events`
- `POST /api/v1/internal/operators/:workerId/run`
- `POST /api/v1/internal/operators/:workerId/pause`
- `POST /api/v1/internal/operators/:workerId/resume`
- `POST /api/v1/internal/operators/:workerId/escalate`

## Local development

```bash
npm install
npm run dev
```

V3 root runs on [http://localhost:3000](http://localhost:3000).

## Runtime contract

- Veklom backend truth is ingested as normalized backend events and summary counters.
- UACP institutional truth owns pillars, committees, workers, operator runs, escalations, and archives.
- Minimum-live workers are scheduled automatically on startup and then on heartbeat intervals.
- Plans select from the governed registry; they do not silently invent active governance objects.

## Run both copies

### V3 working copy

Folder:

- [system-uacp-v3-control-plane-you](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you)

Run:

```bash
npm install
npm run dev
```

URL:

- [http://localhost:3000](http://localhost:3000)

### V2 working copy

Folder:

- [source-uacpgemini](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/source-uacpgemini)

Run:

```bash
npm install
npm run dev
```

URL:

- [http://localhost:3001](http://localhost:3001)

## Environment

Copy `.env.example` to `.env` and set:

```bash
PORT=3000
GEMINI_API_KEY=
USER_EMAIL=founder@company.com
CONTACT_EMAIL=founder@company.com
DEFAULT_RESEARCH_QUERY=governance agents orchestration workflow committees skills institutional control plane
DATA_DIR=./data
UACP_ADMIN_KEY=
UACP_INTERNAL_API_KEY=
```

`GEMINI_API_KEY` is optional. If it is absent, the root app still compiles plans with the deterministic local planner, and that planner remains grounded in live public research.

`UACP_ADMIN_KEY` enables governed registry updates.

`UACP_INTERNAL_API_KEY` secures backend-event ingestion and operator mutation endpoints. If it is unset, internal mutation routes are disabled.

## Render deployment

Deploy V3 from the repository root only.

- Service root: [system-uacp-v3-control-plane-you](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you)
- Blueprint: [render.yaml](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/render.yaml)
- Build command: `npm install && npm run build`
- Start command: `npm run start`

Required environment variables:

- `NODE_ENV=production`
- `USER_EMAIL`
- `CONTACT_EMAIL`

Optional environment variables:

- `GEMINI_API_KEY`
- `UACP_ADMIN_KEY`
- `UACP_INTERNAL_API_KEY`
- `DEFAULT_RESEARCH_QUERY`
- `DATA_DIR`

Do not point the V3 Render service at `source-uacpgemini` unless you explicitly want to deploy V2 instead.

## Doctrine

- Plans are promises, not prompts.
- Governance is distinct from execution.
- Skills are governed execution artifacts.
- Archives preserve replayable judgment.

## Prompt assets

- [UACP-V3-MASTER-PROMPT.md](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/UACP-V3-MASTER-PROMPT.md)
- [UACP-V3-PROMPT-1-SYSTEM.md](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/UACP-V3-PROMPT-1-SYSTEM.md)
- [UACP-V3-PROMPT-2-SKILLS-BUILDERS.md](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/UACP-V3-PROMPT-2-SKILLS-BUILDERS.md)

## Lineage

- [source-uacp-v1](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/source-uacp-v1): UACP V1 reference clone
- [source-uacpgemini](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/source-uacpgemini): UACP V2 nested working copy
- [source-genai-processors](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/source-genai-processors): reference clone for Gemini processor pipelines
