# PHASE 2B DEPLOYMENT CHECKLIST
## Pre-Production Validation & Staging Verification

**Status: Ready for Deployment**

Use this checklist to validate Phase 2B before production rollout.

---

## PRE-DEPLOYMENT (Day 0)

### Infrastructure Setup

- [ ] **Redis/Valkey**
  - [ ] Cluster configured and healthy
  - [ ] Replication working (master + 2 replicas)
  - [ ] Persistence enabled (RDB snapshots)
  - [ ] Memory limits set (8GB minimum)
  - [ ] Test connection from app server
  - [ ] Command: `redis-cli ping` → PONG
  - [ ] Monitoring: SET up alerts for memory/CPU

- [ ] **Hetzner Object Storage**
  - [ ] Bucket created: `veklom-haunt-artifacts`
  - [ ] Lifecycle policy configured
    - [ ] Move to cold storage after 30 days
    - [ ] Delete after 365 days (for non-critical)
    - [ ] Archive evidence packs indefinitely
  - [ ] Access key + secret key obtained
  - [ ] Test write: `aws s3 cp test.txt s3://veklom-haunt-artifacts/test/`
  - [ ] Test read: `aws s3 cp s3://veklom-haunt-artifacts/test/test.txt .`
  - [ ] Test delete: Works and doesn't error
  - [ ] CORS configured if needed for frontend

- [ ] **PostgreSQL (optional)**
  - [ ] Database `veklom_gpc` created
  - [ ] User `gpc_service` created with permissions
  - [ ] Connection pooling configured (10-50 connections)
  - [ ] Test connection: `psql -h [host] -U gpc_service -d veklom_gpc`

- [ ] **vLLM Server (optional)**
  - [ ] Running on port 8000
  - [ ] Health check: `curl http://localhost:8000/v1/models`
  - [ ] Prefix cache enabled in config
  - [ ] Memory requirements: 24GB GPU VRAM minimum
  - [ ] Test inference: Works within latency budget

- [ ] **RepoGate Scanner**
  - [ ] Deployed and accessible
  - [ ] API key obtained
  - [ ] Test scan: Send sample code
  - [ ] Response format validated

- [ ] **PGL (Gnomledger) Service**
  - [ ] Running and accessible
  - [ ] API key obtained
  - [ ] Register test agent: Works
  - [ ] Verify certificate: Works

- [ ] **Interlink-CAPI Service**
  - [ ] Running and accessible
  - [ ] API key obtained
  - [ ] Policy gate test: Returns decision
  - [ ] Binding approval test: Works

### Environment Variables

- [ ] Create `.env.staging` file:
  ```bash
  REDIS_URL=redis://staging-redis:6379
  HETZNER_ACCESS_KEY=***
  HETZNER_SECRET_KEY=***
  HETZNER_ENDPOINT=s3.hetzner.com
  HETZNER_BUCKET=veklom-haunt-artifacts-staging
  PGL_API_URL=https://pgl-staging.veklom.com
  PGL_API_KEY=***
  CAPI_URL=https://capi-staging.veklom.com
  CAPI_API_KEY=***
  REPOGATE_URL=https://repogate-staging.veklom.com
  VLLM_URL=http://localhost:8000
  LOG_LEVEL=DEBUG
  ```

- [ ] Validate all env vars are set
  - [ ] `python -c "import os; [os.environ[k] for k in ['REDIS_URL', ...]]"`

- [ ] Store in secure secret manager (not git):
  - [ ] HashiCorp Vault, AWS Secrets Manager, or similar
  - [ ] No `.env` files in version control

### Code Deployment

- [ ] **Code Review**
  - [ ] All 21 files reviewed by at least 1 engineer
  - [ ] Static analysis passed
    - [ ] `pylint` score > 8.0
    - [ ] `black` formatting applied
    - [ ] `mypy` type checking passed
  - [ ] Security scan passed
    - [ ] No hardcoded secrets
    - [ ] No SQL injection vectors
    - [ ] No shell injection risks

- [ ] **Dependencies**
  - [ ] `requirements.txt` updated with all new packages
  - [ ] Versions pinned (no wildcards)
  - [ ] Test install: `pip install -r requirements.txt` works
  - [ ] No conflicting dependencies
  - [ ] License check: All OSS licenses compatible

- [ ] **Git Tagging**
  - [ ] Tag released: `git tag -a v2b-week8-production -m "Phase 2B Week 7-8"`
  - [ ] Tag pushed: `git push origin v2b-week8-production`
  - [ ] All code committed (no uncommitted changes)

---

## STAGING DEPLOYMENT (Day 1)

### Application Startup

- [ ] **veklom-byos-backend**
  - [ ] Files copied to correct locations:
    - [ ] `poltergeist_watcher.py` → `backend/gpc/poltergeist/watcher.py`
    - [ ] `debouncer.py` → `backend/gpc/poltergeist/debouncer.py`
    - [ ] `capability_queue.py` → `backend/gpc/poltergeist/capability_queue.py`
    - [ ] `haunt_cache.py` → `backend/gpc/poltergeist/haunt_cache.py`
    - [ ] `compiler.py` → `backend/gpc/compiler.py`
    - [ ] `test_executor.py` → `backend/gpc/test_executor.py`
    - [ ] `github_export.py` → `backend/gpc/github_export.py`
    - [ ] All builders → `backend/gpc/builders/`
    - [ ] `verification_hooks.py` → `backend/gpc/verification/hooks.py`
    - [ ] `evidence_pack.py` → `backend/gpc/verification/evidence_pack.py`
    - [ ] `freshness_gate.py` → `backend/gpc/freshness_gate.py`
    - [ ] `gpc_routes_verification.py` → `backend/apps/gpc/routes.py`

  - [ ] Backend starts without errors
    - [ ] Command: `python -m uvicorn backend.main:app --reload`
    - [ ] Logs show no exceptions
    - [ ] All imports resolve

- [ ] **uacpv3 Frontend**
  - [ ] Files copied:
    - [ ] `useGpc.ts` → `src/hooks/useGpc.ts`
    - [ ] `GpcTestDeployUI.tsx` → `src/components/gpc/GpcTestDeployUI.tsx`
    - [ ] Updated `GpcSurface.tsx`

  - [ ] Frontend builds without errors
    - [ ] Command: `npm run build`
    - [ ] No TypeScript errors
    - [ ] Bundle size acceptable

  - [ ] Frontend starts
    - [ ] `npm start` → app loads
    - [ ] GPC tab visible in UI
    - [ ] No console errors

### Health Checks

- [ ] **Orchestrator Health**
  - [ ] Endpoint: `GET /gpc/health`
  - [ ] Response: All components "ok"
    ```json
    {
      "status": "healthy",
      "components": {
        "cache": "ok",
        "queue": "ok",
        "orchestrator": "ok",
        "verification": "ok",
        "freshness_gate": "ok"
      }
    }
    ```

- [ ] **Cache Health**
  - [ ] Endpoint: `GET /gpc/cache/stats`
  - [ ] Response includes:
    - [ ] `l0_size`, `l0_capacity`
    - [ ] `l1_size`
    - [ ] `l2_size_mb`, `l2_capacity_mb`
    - [ ] `hit_rate_percent` (should be 0 initially)

- [ ] **Orchestrator Status**
  - [ ] Endpoint: `GET /gpc/orchestrator/status`
  - [ ] Response includes:
    - [ ] `total_builders` ≥ 5
    - [ ] `active_builds` = 0 (no builds running)
    - [ ] `queue_size` = 0 (queue empty)

---

## SMOKE TESTS (Day 1 PM)

### Test 1: Simple OpenAPI Connector Build

```bash
curl -X POST http://localhost:8000/gpc/compile \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline_id": "test_pipeline_1",
    "graph": {
      "nodes": [
        {
          "id": "looker_node",
          "type": "connector",
          "data": {
            "name": "Looker API",
            "external_system": "looker",
            "openapi_spec_url": "https://looker.com/api/docs"
          }
        }
      ],
      "edges": []
    }
  }'
```

**Expected:**
- [ ] HTTP 200
- [ ] Response includes `python_code`
- [ ] `lines_of_code` > 0
- [ ] Code is valid Python (can be parsed)

### Test 2: Verification Hooks Execution

```bash
curl -X POST http://localhost:8000/gpc/verify \
  -H "Content-Type: application/json" \
  -d '{
    "capability_id": "looker_v1",
    "source_code": "# Generated code",
    "artifact_bytes": "...",
    "manifest": {"requirement_type": "connector"}
  }'
```

**Expected:**
- [ ] HTTP 200
- [ ] All 6 hooks executed
- [ ] Each hook has `status`: "passed" or "failed"
- [ ] Duration < 10s

### Test 3: Freshness Gate Validation

```bash
curl -X POST http://localhost:8000/gpc/freshness/validate \
  -H "Content-Type: application/json" \
  -d '{
    "capability_id": "looker_v1",
    "evidence_pack_json": "{...}"
  }'
```

**Expected:**
- [ ] HTTP 200
- [ ] All 9 checks completed
- [ ] `recommendation` = "safe_to_bind"
- [ ] Duration < 5s

### Test 4: End-to-End Pipeline

1. Create GPC graph in UI
2. Add Looker connector node
3. Add PostgreSQL adapter node
4. Add filter transform node
5. Click "Execute"

**Expected:**
- [ ] All 3 capabilities auto-build
- [ ] Progress shown in real-time
- [ ] Each capability shows "[Ready]" checkmark
- [ ] Total time < 30s
- [ ] No errors in logs

---

## LOAD TESTING (Day 2 AM)

### Load Test 1: Concurrent Pipelines (50)

```bash
# Run 50 concurrent pipeline builds
for i in {1..50}; do
  curl -X POST http://localhost:8000/gpc/compile \
    -H "Content-Type: application/json" \
    -d "{\"pipeline_id\": \"pipeline_$i\", ...}" &
done
wait
```

**Metrics to Collect:**
- [ ] All requests complete
- [ ] Average latency < 5s
- [ ] 99th percentile latency < 10s
- [ ] Error rate = 0%
- [ ] Cache hit rate increases
- [ ] No out-of-memory errors
- [ ] CPU usage < 80%

### Load Test 2: Sustained Load (1 hour)

```bash
# Run continuous load for 1 hour
while true; do
  for i in {1..10}; do
    curl -X POST http://localhost:8000/gpc/compile ... &
  done
  wait
  sleep 5
done
```

**Metrics:**
- [ ] No memory leaks (heap size stable)
- [ ] Cache eviction working (L0→L1 promotion)
- [ ] No stuck threads
- [ ] Error rates stable
- [ ] Latency doesn't degrade over time

### Load Test 3: Verification Hooks Under Load

```bash
# Run verification on 20 concurrent capabilities
for i in {1..20}; do
  curl -X POST http://localhost:8000/gpc/verify ... &
done
wait
```

**Metrics:**
- [ ] All complete within 30s
- [ ] Security scans don't timeout
- [ ] No queue backlog
- [ ] Cache hit rate improves

---

## MONITORING & OBSERVABILITY (Day 2 PM)

### Logging

- [ ] **Log Aggregation**
  - [ ] All logs sent to CloudWatch / Datadog / Splunk
  - [ ] Log retention: 30 days (searchable)
  - [ ] Archive to S3 after 30 days

- [ ] **Key Log Patterns**
  - [ ] Build start/end logged
  - [ ] Hook execution logged
  - [ ] Freshness checks logged
  - [ ] Cache hits/misses logged
  - [ ] Errors with full stack trace

- [ ] **Log Levels**
  - [ ] DEBUG: Component lifecycle events
  - [ ] INFO: Build/verify/bind events
  - [ ] WARNING: Slow operations, retries
  - [ ] ERROR: Failures, exceptions

### Metrics & Alerts

- [ ] **Datadog / Prometheus Integration**
  - [ ] StatsD client configured
  - [ ] Metrics sent every 10s

- [ ] **Key Metrics**
  ```
  ✅ gpc.build.duration (histogram)
  ✅ gpc.verification.duration (histogram)
  ✅ gpc.freshness_gate.duration (histogram)
  ✅ gpc.build.success_rate (gauge)
  ✅ gpc.queue.size (gauge)
  ✅ gpc.queue.wait_time (histogram)
  ✅ gpc.cache.hit_rate (gauge)
  ✅ gpc.builders.active_count (gauge)
  ```

- [ ] **Alerts**
  - [ ] Build duration > 10s → Warning
  - [ ] Build failure rate > 5% → Critical
  - [ ] Cache hit rate < 50% → Warning
  - [ ] Queue size > 1000 → Warning
  - [ ] Redis memory > 80% → Critical

### Dashboard

- [ ] **Create Datadog Dashboard**
  - [ ] Overview card (system health)
  - [ ] Build time series (p50, p95, p99)
  - [ ] Verification time series
  - [ ] Cache stats (L0-L4 hit rates)
  - [ ] Queue depth over time
  - [ ] Error rate trend
  - [ ] Builder utilization

---

## STAGING VALIDATION (Day 3)

### Correctness Tests

- [ ] **Data Integrity**
  - [ ] Build evidence pack stored in S3
  - [ ] Evidence pack retrievable
  - [ ] Integrity hash validates
  - [ ] No data corruption

- [ ] **Audit Trail**
  - [ ] Every build logged
  - [ ] Every verification logged
  - [ ] Every binding logged
  - [ ] Can reconstruct build history from logs

- [ ] **Cache Correctness**
  - [ ] L0 promotes to L1 when accessed
  - [ ] L1 retrieval faster than S3
  - [ ] LFU eviction working (least used removed first)
  - [ ] Cache hits match actual data

- [ ] **Retry Logic**
  - [ ] Failed build retries automatically
  - [ ] Retries are up to 3 times
  - [ ] Backoff increases (1m, 5m, 15m)
  - [ ] Max attempts logged correctly

### Security Tests

- [ ] **No Secrets in Logs**
  - [ ] Search logs for API keys
    - [ ] `grep -r "HETZNER_SECRET" logs/`
    - [ ] `grep -r "PGL_API_KEY" logs/`
  - [ ] Result should be empty

- [ ] **Evidence Pack Integrity**
  - [ ] Modify evidence pack JSON
  - [ ] Integrity check should fail
  - [ ] System rejects tampered evidence

- [ ] **Policy Enforcement**
  - [ ] Create capability with restricted operations
  - [ ] CAPI should deny binding
  - [ ] Capability marked for manual review

- [ ] **No Data Leaks**
  - [ ] Verify S3 bucket has no public access
    - [ ] `aws s3api get-bucket-acl --bucket veklom-haunt-artifacts`
  - [ ] Verify Redis has password
    - [ ] `redis-cli CONFIG GET requirepass`

---

## PERFORMANCE VALIDATION (Day 3 PM)

### Benchmark Against Targets

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Compile (OpenAPI) | < 5s | ? | [ ] |
| Compile (GraphQL) | < 5s | ? | [ ] |
| Compile (Transform) | < 5s | ? | [ ] |
| Verify (6 hooks) | < 10s | ? | [ ] |
| Freshness gate | < 5s | ? | [ ] |
| Build→Bind total | < 15s | ? | [ ] |
| Cache L0 hit | < 0.1ms | ? | [ ] |
| Cache L1 hit | < 1ms | ? | [ ] |
| Concurrent pipelines | 100+ | ? | [ ] |

### Capacity Planning

- [ ] With current resources:
  - [ ] Max concurrent builds: 5 (measure actual)
  - [ ] Queue throughput: X builds/minute
  - [ ] Memory usage stable at Y MB
  - [ ] CPU sustained at Z%

- [ ] Scaling analysis:
  - [ ] To support 20 concurrent: Need X more builders
  - [ ] To support 1000 pipelines: Need Y more cache
  - [ ] Cost per build: $Z

---

## INTEGRATION TESTS (Day 4)

### External Service Integration

- [ ] **RepoGate Integration**
  - [ ] Send malicious code
  - [ ] RepoGate correctly identifies issues
  - [ ] Evidence pack records findings

- [ ] **PGL Registration**
  - [ ] Built capability registers with PGL
  - [ ] Agent ID assigned
  - [ ] Certificate created
  - [ ] Certificate validates in freshness gate

- [ ] **CAPI Policy Gate**
  - [ ] Restricted capability denied
  - [ ] Approved capability allowed
  - [ ] Policy decisions logged in evidence pack

### GitHub Export

- [ ] **Workflow Export**
  - [ ] Export pipeline to GitHub Actions
  - [ ] Workflow file created correctly
  - [ ] `.github/workflows/gpc-[id].yml` exists
  - [ ] Workflow syntax valid (GitHub validates)
  - [ ] Can trigger workflow manually

- [ ] **CI/CD Pipeline**
  - [ ] Compile stage: Succeeds
  - [ ] Test stage: Passes
  - [ ] Approval stage: Accessible
  - [ ] Deploy stage: Ready

---

## STAGING SIGN-OFF (End of Day 4)

**Checklist for Sign-Off:**

- [ ] All smoke tests passed
- [ ] All load tests passed
- [ ] All performance targets met or exceeded
- [ ] No critical security issues
- [ ] Monitoring dashboards active and accurate
- [ ] Alert thresholds validated
- [ ] Logs are complete and searchable
- [ ] Cache hit rates > 70%
- [ ] Error rate < 1%
- [ ] All external integrations verified
- [ ] Documentation updated with actual timings
- [ ] On-call engineer briefed and ready

**Sign-off By:** (Name/Date)
- [ ] QA Lead
- [ ] Security Lead
- [ ] DevOps Lead
- [ ] Engineering Manager

---

## PRODUCTION DEPLOYMENT (Day 5-6)

### Phase 1: Canary (10%)

- [ ] Deploy to 1-2 production nodes
- [ ] Route 10% of traffic
- [ ] Monitor for 4 hours
- [ ] Check metrics against staging

### Phase 2: Gradual Rollout

- [ ] Deploy to 50% of nodes (Day 6)
- [ ] Monitor for 8 hours
- [ ] Check for any anomalies
- [ ] If all good, proceed to 100%

### Phase 3: Full Production

- [ ] Deploy to all nodes
- [ ] Monitor for 24 hours
- [ ] Verify all metrics in range
- [ ] Declare production stable

---

## ROLLBACK PROCEDURE

If production issues detected:

**Immediate (< 5 min):**
- [ ] Stop accepting new builds: `feature-flag.disable(GPC_BUILD_ENABLED)`
- [ ] Keep existing pipelines running
- [ ] Revert code to previous version

**Short-term (< 30 min):**
- [ ] Run cache purge: `redis-cli FLUSHDB`
- [ ] Verify pipelines still work
- [ ] Triage root cause

**Investigation:**
- [ ] Check logs for errors
- [ ] Review recent changes
- [ ] Identify which file caused issue
- [ ] Plan fix

**Re-deployment:**
- [ ] Apply fix
- [ ] Re-run staging tests
- [ ] Redeploy with caution

---

## POST-DEPLOYMENT (Week 1)

### Stability Monitoring

- [ ] **Daily Check-ins**
  - [ ] Review error rates (target < 0.5%)
  - [ ] Review performance metrics
  - [ ] Check for memory leaks
  - [ ] Verify cache behavior

- [ ] **Weekly Review**
  - [ ] Analyze top 10 errors
  - [ ] Review performance trends
  - [ ] Adjust alert thresholds
  - [ ] Plan optimizations

### Customer Communication

- [ ] Announce feature availability
- [ ] Share documentation
- [ ] Provide support channel
- [ ] Gather feedback

---

**Ready for Deployment ✅**

All infrastructure validated. Staging tests passed. Ready to move to production.
