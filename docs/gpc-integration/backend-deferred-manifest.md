# Residual backend integration manifest

This manifest is a residual handoff, not a full package-completion claim. The canonical GPC router, schemas, compiler path, application registration, compile contract, and governed execute path have been reconciled in `veklom-byos-backend` and published. The remaining package files require backend-owner reconciliation against live dependencies, auth, persistence, sandboxing, governance, and deployment configuration.

| ZIP file | Intended repository | Intended target path | Existing corresponding implementation | Action | Why write access is required |
|---|---|---|---|---|---|
| `gpc_routes.py` | `veklom-byos-backend` | `backend/apps/gpc/routes.py` | `backend/apps/gpc/routes.py` | completed/adapted | Canonical route is mounted, uses authenticated workspace identity, and fails unsupported capabilities closed. |
| `gpc_routes_complete.py` | `veklom-byos-backend` | `backend/apps/gpc/routes.py` | `backend/apps/gpc/routes.py` | rejected as duplicate | The overlapping variant was not installed; one canonical router remains. |
| `gpc_schemas.py` | `veklom-byos-backend` | `backend/apps/gpc/schemas.py` | `backend/apps/gpc/schemas.py` | completed/adapted | Compile and execute payloads use one active-graph contract with tenant and pipeline identity. |
| `compiler.py` | `veklom-byos-backend` | `backend/apps/gpc/compiler.py` | `backend/apps/gpc/compiler.py` | existing implementation used | The canonical route uses the existing compiler; package compiler changes remain for backend-owner review. |
| `gpc_compiler.py` | `veklom-byos-backend` | `backend/gpc/gpc_compiler.py` | `backend/gpc/gpc_compiler.py` | duplicate review/adapt | Must not create competing compiler authorities; backend owner must reconcile imports. |
| `orchestrator.py` | `veklom-byos-backend` | `backend/services/orchestrator.py` or existing GPC service seam | `backend/services/orchestrator.py` | adapt | Queue consumers and lifecycle ownership must be tested in the live worker runtime. |
| `verification_hooks.py` | `veklom-byos-backend` | `backend/ops/builders/verification.py` | `backend/ops/builders/verification.py` | merge/adapt | RepoGate/policy interfaces and security scan behavior are backend-owned. |
| `evidence_pack.py` | `veklom-byos-backend` | `backend/apps/api/services/evidence.py` | `backend/apps/api/services/evidence.py`, `backend/apps/api/routers/evidence_pack.py` | adapter | Evidence hashing and persistence must use existing audit stores and contracts. |
| `capability_queue.py` | `veklom-byos-backend` | `backend/core/workers/priority_queue.py` | `backend/core/workers/priority_queue.py` | adapt | Redis/Valkey serialization, leases, and retry behavior require live queue tests. |
| `haunt_cache.py` | `veklom-byos-backend` | `backend/core/services/redis_cache.py` | `backend/core/services/redis_cache.py`, `backend/core/ai/cache.py` | adapt | Cache tiers must respect existing TTLs, credentials, and storage providers. |
| `debouncer.py` | `veklom-byos-backend` | `backend/ops/poltergeist_daemon.py` or adjacent Poltergeist module | `backend/ops/poltergeist_daemon.py` | merge | Requirement settling must not duplicate the daemon or alter worker ownership. |
| `base_builder.py` | `veklom-byos-backend` | `backend/ops/builders/base.py` | `backend/ops/builders/base.py` | merge/adapt | Builder lifecycle contracts affect every existing builder. |
| `python_builder.py` | `veklom-byos-backend` | `backend/ops/builders/transform_builder.py` | `backend/ops/builders/transform_builder.py` | adapt | Existing transform builder must remain compatible with current tests and imports. |
| `openapi_builder.py` | `veklom-byos-backend` | `backend/ops/builders/openapi_builder.py` | Same path | adapt | Package behavior must merge without replacing deployed OpenAPI connector logic. |
| `graphql_builder.py` | `veklom-byos-backend` | `backend/ops/builders/graphql_builder.py` | No confirmed live file from inventory | defer as adapter | New backend file requires dependency, security, and registration decisions. |
| `database_builder.py` | `veklom-byos-backend` | `backend/ops/builders/database_builder.py` | Same path | adapt | Database credentials and driver behavior cannot be validated from UACP. |
| `github_export.py` | `veklom-byos-backend` | `backend/gpc/github_export.py` | No safe UACP equivalent for external mutation | adapter | Real GitHub commits require backend secret handling and authorization. |
| `gpc_github_export.py` | `veklom-byos-backend` | `backend/gpc/gpc_github_export.py` | Overlaps `github_export.py` | duplicate review | Only one exporter should own remote repository mutation. |
| `gpc_test_executor.py` | `veklom-byos-backend` | `backend/gpc/test_executor.py` | `backend/gpc/test_executor.py` | duplicate review/adapt | Sandbox execution cannot be safely implemented in the frontend repo. |
| `test_executor.py` | `veklom-byos-backend` | `backend/gpc/test_executor.py` | Same target | merge/adapt | Sample/full execution and SSE require backend process isolation. |
| `poltergeist_watcher.py` | `veklom-byos-backend` | `backend/ops/poltergeist_daemon.py` | Same daemon seam | adapt | Watcher lifecycle and queue handoff require backend runtime access. |
| `test_gpc_suite.py` | `veklom-byos-backend` | `backend/tests/test_gpc_*.py` | `backend/tests/test_gpc_contract.py`, `test_gpc_compiler.py`, `test_gpc_imports.py` | adapted/verified | Focused backend GPC coverage passes; broader package suite remains deferred. |
| `DEPLOY.sh` | `veklom-byos-backend` | `deployment/` | Existing deployment scripts | defer | Running deployment scripts from UACP would cross repository and infrastructure boundaries. |

No CAPPO, cAPI, PGL, Genome Ledger/Gnomledger, Locus, or execution-authority files were modified or proposed as integration targets.
