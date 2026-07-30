# UACP v3 GPC package integration

Status: direct GPC frontend and canonical backend route integration is published. The broader 40-file package remains only partially integrated; this is not a full package completion claim.

The raw ZIP is intentionally not committed. The package inventory and disposition are recorded in the merge matrix and residual backend manifest.

## Completed in UACP v3

- Preserved `pipeline_id` and `tenant_id` through canvas load/export.
- Sent the active graph in compile and execute requests.
- Added strict compilation response validation; empty or malformed results fail honestly.
- Added governed execution streaming with explicit failure handling and approval state.
- Removed misleading dry-run/sample/full labels that were not represented by the backend contract.
- Disabled the unsupported GitHub workflow export request; the UI fails closed without sending tokens.
- Preserved the existing ReactFlow canvas, compiler result modal, execution progress, and intent-generation UI.
- Added `tests/gpc-contract.test.ts` and the `test:gpc` script.

## Published canonical backend integration

The canonical FastAPI router is mounted from `backend.apps.gpc.routes` in `veklom-byos-backend`. Its active graph compile and governed execute contracts preserve authenticated workspace tenant identity and pipeline identity. The unreferenced legacy mock `backend/apps/gpc/gpc_routes.py` module was removed.

The current backend uses the existing tenant-aware governed inference provider for natural-language generation and validates the returned graph through Pydantic and the compiler. Audit storage, statistics storage, and GitHub export remain unavailable; no mock success is claimed.

## Residual package work

The package builders, queue/cache/debouncer, orchestrator, verification hooks, evidence pack, GitHub service exporter, test executors, Poltergeist watcher, and deployment script remain deferred package references. They require backend-owner reconciliation with existing runtime, governance, persistence, and deployment contracts. No CAPPO, cAPI, PGL, Genome Ledger/Gnomledger, Locus, or execution-authority architecture was modified.

See [package-merge-matrix.md](./package-merge-matrix.md) and [backend-deferred-manifest.md](./backend-deferred-manifest.md).

## Validation

- `npm run test:gpc` — 5 passed.
- `npm run lint` — passed.
- `npm run build` — passed; Vite emitted only its existing chunk-size warning.
- Backend focused GPC suite — 10 passed after legacy-route cleanup.
- Backend application import — passed.

## Historical route verification

The committed [local-route-verification.json](./local-route-verification.json) records a 2026-07-29 UACP-only TypeScript route exercise. It is retained for provenance and is not evidence of the current Python backend or a Coolify deployment.

Current canonical backend route status:

- `GET /api/v1/gpc/components` — supported.
- `POST /api/v1/gpc/compile` — supported for a non-empty active graph with matching authenticated tenant and pipeline identity.
- `POST /api/v1/gpc/execute` — supported through the governed worker and SSE lifecycle.
- `POST /api/v1/gpc/generate` — supported through the existing governed inference provider; provider or invalid-output failures return explicit errors.
- `GET /api/v1/gpc/audit` and `/stats` — explicit `501` unavailable; storage is not configured.
- GitHub workflow export — unavailable; the frontend does not send an unsupported request.

This does not verify Coolify deployment, production routing, or a browser-driven production execution.