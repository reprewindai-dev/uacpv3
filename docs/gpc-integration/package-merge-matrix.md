# Package-to-repository merge matrix

The supplied archive contains 40 files. Actions use these meanings:

- **merge**: package capability is integrated into the existing UACP v3 file/path.
- **adapt**: package intent is implemented through an existing UACP seam without copying incompatible package code.
- **defer**: backend file requires write access to the intended backend repository.
- **represented**: existing UACP v3 implementation already supplies the capability; package source was compared and not blindly copied.
- **documentation**: retained as repository documentation, not runtime code.
- **deployment**: operational material, deferred with backend deployment.
- **test**: backend test material, deferred with its target backend.
- **duplicate/superseded**: package variant is not independently installed because another package file is the applicable source.

| ZIP file | Target existing file or proposed location | Action | Reason | Dependencies | Risk |
|---|---|---|---|---|---|
| `UACP_V3_GPC_INTEGRATION_PLAN.md` | `docs/gpc-integration/README.md` | documentation | Defines the intended UACP/GPC scope and acceptance criteria. | None | Low; recorded as scope, not executable authority. |
| `GPC_INTEGRATION_GUIDE.md` | `docs/gpc-integration/backend-deferred-manifest.md` | documentation | Contains backend integration steps that cannot be applied in this writable repo. | BYOS backend | Medium; treated as reference only. |
| `INDEX.md` | `docs/gpc-integration/README.md` | documentation | Package index and phase summary are represented by the audit docs. | Package inventory | Low |
| `FINAL_SYSTEM_SUMMARY.md` | `docs/gpc-integration/README.md` | documentation | Summary is useful for handoff but does not belong in runtime code. | Backend package | Low |
| `PHASE2_COMPLETION_SUMMARY.md` | `docs/gpc-integration/README.md` | documentation | Phase history only. | None | Low |
| `PHASE2B_ARCHITECTURE_AUDIT.md` | `docs/gpc-integration/backend-deferred-manifest.md` | documentation | Architecture reference; not permission to redesign other services. | Existing backend interfaces | Medium |
| `PHASE2B_COMPLETE.md` | `docs/gpc-integration/README.md` | documentation | Package completion claim is explicitly not reused as UACP completion claim. | None | Low |
| `PHASE2B_MANIFEST.md` | `docs/gpc-integration/package-merge-matrix.md` | documentation | Manifest is captured by this file-level matrix. | Package inventory | Low |
| `PHASE2B_WEEK3-4_SUMMARY.md` | `docs/gpc-integration/backend-deferred-manifest.md` | documentation | Queue/cache phase reference only. | Redis/Valkey backend services | Medium |
| `PHASE2B_WEEK5-6_SUMMARY.md` | `docs/gpc-integration/backend-deferred-manifest.md` | documentation | Builders/orchestration reference only. | Existing builder subsystem | Medium |
| `gpc_page.tsx` | `src/components/gpc/GpcSurface.tsx` | represented | Existing UACP page already contains graph, compile, execute, intent, and preview behavior. | `useGpc`, `GpcCanvas`, stores | Low |
| `gpc_page_updated.tsx` | `src/components/gpc/GpcSurface.tsx` | merge/adapt | Adds test/deploy lifecycle; adapted to UACP relative imports and existing shell/page seam. | `GpcTestDeployUI`, current GPC stores | Medium; package used placeholder `pipeline_123`, removed. |
| `GpcCanvas.tsx` | `src/components/gpc/GpcCanvas.tsx` | represented | Existing ReactFlow canvas already supplies editing, node movement, selection, and edges. | `reactflow`, `gpc_stores` | Low |
| `GpcTestDeployUI.tsx` | `src/components/gpc/GpcTestDeployUI.tsx` | merge/adapt | New frontend capability required by the package; rewritten to use existing SSE and honest artifact generation. | `ExecutionEvent`, `contracts.ts`, UACP export route | Medium |
| `useGpc.ts` | `src/hooks/useGpc.ts` | merge/adapt | Existing hook retained; active graph payload and strict response validation added. | `contracts.ts`, current API routes | Medium |
| `gpc_stores.ts` | `src/stores/gpc_stores.ts` | merge | Package store behavior merged without replacing the working store; pipeline/tenant identity is now stateful. | `zustand`, GPC types | Medium |
| `gpc_types.ts` | `src/types/gpc_types.ts` and `src/types/gpc.ts` | represented | Existing type mirrors match the package schema; no duplicate type namespace added. | Backend schema contract | Low |
| `compiler.py` | `veklom-byos-backend/backend/gpc/compiler.py` | defer | Backend AST compiler must be reconciled in its existing Python namespace. | `gpc_schemas.py`, existing builders | High; requires backend write access. |
| `gpc_compiler.py` | `veklom-byos-backend/backend/gpc/gpc_compiler.py` | defer/duplicate review | Overlaps `compiler.py`; requires backend owner to choose merge without creating a third compiler. | Existing BYOS GPC compiler | High |
| `gpc_routes.py` | `veklom-byos-backend/backend/apps/gpc/routes.py` | merge/adapt | Canonical router mounted; authenticated workspace identity and fail-closed unsupported capabilities preserved. | Schemas, compiler, DB, auth | Medium |
| `gpc_routes_complete.py` | `veklom-byos-backend/backend/apps/gpc/routes.py` | rejected as duplicate | Overlapping route variant was not installed; one canonical route family remains. | Existing router registration | Low |
| `gpc_schemas.py` | `veklom-byos-backend/backend/apps/gpc/schemas.py` | merge/adapt | Active graph compile/execute schemas aligned with the frontend contract. | Pydantic, route imports | Medium |
| `orchestrator.py` | `veklom-byos-backend/backend/services/orchestrator.py` or existing GPC orchestrator seam | defer/adapt | Must connect to existing service without taking execution authority. | Queue, builders, verification | High |
| `verification_hooks.py` | `veklom-byos-backend/backend/ops/builders/verification.py` | defer/adapt | Verification belongs beside existing builder verification, not in UACP frontend. | RepoGate/policy interfaces | High |
| `evidence_pack.py` | `veklom-byos-backend/backend/apps/api/services/evidence.py` | defer/adapt | Evidence fields and integrity hashing must use existing evidence service contracts. | Audit DB, policy hashes | High |
| `capability_queue.py` | `veklom-byos-backend/backend/core/workers/priority_queue.py` | defer/adapt | Queue behavior must merge with existing priority queue. | Redis/Valkey | High |
| `haunt_cache.py` | `veklom-byos-backend/backend/core/services/redis_cache.py` | defer/adapt | Cache tiers require existing cache/runtime configuration. | Redis/Valkey/object storage | High |
| `debouncer.py` | `veklom-byos-backend/backend/ops/poltergeist_daemon.py` | defer/adapt | Requirement settling belongs in the existing Poltergeist daemon. | Queue/cache | High |
| `base_builder.py` | `veklom-byos-backend/backend/ops/builders/base.py` | defer/adapt | Package lifecycle must be merged into the existing builder base. | Verification/evidence | High |
| `python_builder.py` | `veklom-byos-backend/backend/ops/builders/transform_builder.py` | defer/adapt | Existing transform builder is the corresponding implementation. | Base builder/compiler | High |
| `openapi_builder.py` | `veklom-byos-backend/backend/ops/builders/openapi_builder.py` | defer/adapt | Existing OpenAPI builder must receive only compatible package behavior. | Base builder | High |
| `graphql_builder.py` | `veklom-byos-backend/backend/ops/builders/` proposed GraphQL builder path | defer | No UACP frontend target; backend builder requires backend access and dependency review. | Base builder, GraphQL client | High |
| `database_builder.py` | `veklom-byos-backend/backend/ops/builders/database_builder.py` | defer/adapt | Existing database builder is the corresponding implementation. | Base builder, DB drivers | High |
| `github_export.py` | `veklom-byos-backend/backend/gpc/github_export.py` | defer/adapt | Backend exporter may perform repository integration; UACP only generates a local artifact. | Compiler, GitHub API/auth | High |
| `gpc_github_export.py` | `veklom-byos-backend/backend/gpc/gpc_github_export.py` | defer/duplicate review | Overlaps `github_export.py`; do not install both. | Existing exporter | High |
| `gpc_test_executor.py` | `veklom-byos-backend/backend/gpc/test_executor.py` | defer/duplicate review | Test executor variants overlap and require sandbox authority. | Compiler, sandbox, SSE | High |
| `test_executor.py` | `veklom-byos-backend/backend/gpc/test_executor.py` | defer/adapt | Backend sample/full execution needs isolated runtime access. | Sandbox, compiler | High |
| `poltergeist_watcher.py` | `veklom-byos-backend/backend/ops/poltergeist_daemon.py` | defer/adapt | Watcher must merge into existing Poltergeist service. | Debouncer, queue | High |
| `test_gpc_suite.py` | `veklom-byos-backend/backend/tests/test_gpc_*.py` | defer/adapt | Python suite belongs with backend compiler/routes/builders. | Backend dependencies | Medium |
| `DEPLOY.sh` | `veklom-byos-backend/deployment/` | defer/deployment | Deployment script cannot be run or installed from UACP v3. | Backend infrastructure/secrets | High |
