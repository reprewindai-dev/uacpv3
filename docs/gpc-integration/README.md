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

- `npm run test:gpc` — 4 passed.
- `npm run lint` — passed.
- `npm run build` — passed after elevated esbuild execution; Vite emitted only its existing chunk-size warning.

This is not a claim that the full cross-repository backend package is complete.
