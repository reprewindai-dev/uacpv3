# UACP V3 Control Plane

**Root = UACP V3 control plane. Nested `source-uacpgemini` = UACP V2 working reference copy.**

UACP V3 is the institutional control plane built on top of the earlier Quantum UACP and UACPGemini prototypes. This build turns the V2 prototype into a four-surface operating shell for governed AI-native business operations:

- `Deterministic Engine`: public narrative and signal intake
- `Sunnyvale`: execution floor for plans, runs, approvals, and workflows
- `Silicon Valley`: founder governance console for pillars, committees, skills, and telemetry
- `Archives`: replayable memory for evidence, lineage, and ordered events

## Objective

Convert founder intent into governed institutional plans that carry:

- a revenue objective
- a paying user definition
- a pricing model
- assigned pillars and committees
- explicit governance guardrails
- replayable evidence through archived runs

## Canonical structure

```txt
system-uacp-v3-control-plane-you/
├── README.md                  # V3 root documentation
├── UACP-V3-MASTER-PROMPT.md   # V3 doctrine / master system prompt
├── package.json               # V3 scripts
├── server.ts                  # V3 backend
├── ...
└── source-uacpgemini/         # Nested UACP V2 working copy
    ├── README.md
    ├── package.json
    ├── server.ts
    └── ...
```

Naming rule:

- `UACP V3 root project` = the repository root
- `UACP V2 nested working copy` = `source-uacpgemini`
- `V2 executes; V3 governs.`

## Current system components

### Backend

- Express API server
- WebSocket event stream
- in-memory control-plane state for:
  - plans
  - runs
  - pillars
  - committees
  - governed skills
  - workflows
  - archives
  - telemetry
  - research signals

### Frontend

- React 19 shell with four locked V3 surfaces
- governed intent composer
- plan launch and run tracking
- committee and skill governance views
- archive and event replay surface

## API

- `GET /api/bootstrap`
- `GET /api/pillars`
- `GET /api/committees`
- `GET /api/skills`
- `GET /api/workflows`
- `GET /api/research-signals`
- `GET /api/plans`
- `POST /api/plans`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/events`
- `GET /api/archives`
- `GET /api/telemetry`

## Local development

```bash
npm install
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

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

## Render deployment

Deploy V3 from the repository root only.

- Service root: [system-uacp-v3-control-plane-you](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you)
- Render blueprint: [render.yaml](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/render.yaml)
- Build command: `npm install && npm run build`
- Start command: `npm run start`

Required environment variables:

- `NODE_ENV=production`
- `GEMINI_API_KEY=...`

Do not point this Render service at `source-uacpgemini` unless you intentionally want to deploy V2 instead of V3.

## Environment

Copy `.env.example` to `.env` and set:

```bash
GEMINI_API_KEY=...
PORT=3000
```

If `GEMINI_API_KEY` is not set, UACP V3 falls back to a deterministic local planner so the shell remains runnable.

## Research and model pipeline notes

This build uses public research signals from arXiv for live doctrine pressure. The repository `google-gemini/genai-processors` is included locally as a reference because it is a strong fit for the next V3 step:

- committee streaming pipelines
- model-council processor chains
- low-latency asynchronous reasoning stages
- unified multimodal content handling for future control-plane workers

That processor layer is not yet wired into this Node runtime, but the architecture now has a clear place for it under governed execution.

## Lineage

- `source-uacp-v1/`: original UACP v1 reference clone
- `source-uacpgemini/`: UACPGemini v2 reference clone
- `source-genai-processors/`: Gemini processor pipeline reference clone

## Doctrine

- Plans are promises, not prompts.
- Governance is distinct from execution.
- Skills are governed execution artifacts.
- Archives are replayable institutional memory.

## Prompt assets

- [UACP-V3-MASTER-PROMPT.md](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/UACP-V3-MASTER-PROMPT.md)
- [UACP-V3-PROMPT-1-SYSTEM.md](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/UACP-V3-PROMPT-1-SYSTEM.md)
- [UACP-V3-PROMPT-2-SKILLS-BUILDERS.md](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/UACP-V3-PROMPT-2-SKILLS-BUILDERS.md)

## Workspace split

- Root folder: UACP V3 root project
- [source-uacpgemini](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/source-uacpgemini): UACP V2 nested working copy
- [source-uacp-v1](C:/Users/antho/Documents/Codex/2026-05-08/system-uacp-v3-control-plane-you/source-uacp-v1): UACP V1 reference clone
