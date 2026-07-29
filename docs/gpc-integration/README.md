# UACP v3 GPC package integration

Status: frontend integration implemented in UACP v3; backend package integration deferred because this session is writable only in `C:\Users\antho\.windsurf\uacpv3`.

This folder records the complete 40-file package audit. The raw ZIP is intentionally not committed.

## Completed in UACP v3

- Preserved `pipeline_id` and `tenant_id` through canvas load/export.
- Sent the active graph in compile requests.
- Added strict compilation response validation; empty or malformed results fail honestly.
- Added `src/components/gpc/GpcTestDeployUI.tsx` with streamed test preview, explicit failure state, approval gate, and downloadable workflow artifact.
- Added the UACP-only `POST /api/v1/gpc/export-github` artifact route. It does not write to GitHub or claim external deployment.
- Preserved the existing ReactFlow canvas, compiler result modal, execution progress, intent generation, and preview panel.
- Added `tests/gpc-contract.test.ts` and the `test:gpc` script.

## Deferred because backend repositories are read-only

The Python compiler, FastAPI route package, builders, Poltergeist queue/cache/orchestrator, verification hooks, evidence pack, GitHub service exporter, and test executor remain package references. They are not copied into UACP v3 and no external repository was modified.

See [package-merge-matrix.md](./package-merge-matrix.md) and [backend-deferred-manifest.md](./backend-deferred-manifest.md).

## Validation

- `npm run test:gpc` — 5 passed.
- `npm run lint` — passed.
- `npm run build` — passed after elevated esbuild execution; Vite emitted only its existing chunk-size warning.

This is not a claim that the full cross-repository backend package is complete.

## Local route verification

On 2026-07-29, the local UACP v3 server was exercised with one generated graph. The exact request payloads and response bodies are recorded in [local-route-verification.json](./local-route-verification.json).

- `GET /api/v1/gpc/components` — HTTP 200.
- `POST /api/v1/gpc/generate` — HTTP 200; returned `pipeline_id=gpc_9283448a0cc9` and `tenant_id=tenant_verify`.
- `POST /api/v1/gpc/compile` — HTTP 200; active graph included in request; returned `node_count=3`, valid generated Python, and execution order `input → normalize → result`.
- `GET /api/v1/gpc/execute` — HTTP 200; streamed `start`, `node_start`, `node_complete` previews for all three nodes, and `complete`.
- `POST /api/v1/gpc/export-github` — HTTP 200; returned `gpc-gpc_9283448a0cc9.yml` with a real curl-based compile/execute workflow artifact.

This verifies the UACP v3 local route contract and frontend wiring target. It does not verify the deferred Python backend package or a browser-driven production deployment.

## Deferred backend boundary

The local UACP route lifecycle works with the current TypeScript server. The Python package remains deferred, so Python-side builder manufacturing, queue/cache/orchestrator execution, evidence-pack persistence, and governed backend deployment are not verified here. No full GPC integration claim is made.