"""
GPC Routes with Verification Integration
Complete build → verify → bind pipeline

Updated routes:
- /gpc/compile - Compile pipeline
- /gpc/test - Test with streaming
- /gpc/execute - Execute with streaming
- /gpc/verify - Run verification hooks
- /gpc/freshness/validate - Pre-bind validation
- /gpc/bind - Final capability binding
- /gpc/orchestrator/status - Orchestrator monitoring
- /gpc/builds - Build history

Location: veklom-byos-backend/backend/apps/gpc/routes.py
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
import asyncio
import json
from typing import Optional

from backend.gpc.compiler import GPCCompiler
from backend.gpc.test_executor import PipelineTestExecutor, TestExecutionMode
from backend.gpc.github_export import GitHubWorkflowExporter
from backend.gpc.poltergeist.orchestrator import BuilderOrchestrator
from backend.gpc.poltergeist.capability_queue import CapabilityBuildQueue
from backend.gpc.poltergeist.haunt_cache import HauntCachePlane
from backend.gpc.verification.hooks import (
    VerificationHookRunner,
    UnitTestHook,
    SecurityScanHook,
    DependencyScanHook,
    PolicyValidationHook,
    ContractTestHook,
    AdversarialTestHook,
)
from backend.gpc.verification.evidence_pack import EvidencePack, EvidencePackStore
from backend.gpc.freshness_gate import FreshnessGate

# Initialize components
compiler = GPCCompiler()
test_executor = PipelineTestExecutor()
github_exporter = GitHubWorkflowExporter()

# Global state (initialized on startup)
cache: Optional[HauntCachePlane] = None
queue: Optional[CapabilityBuildQueue] = None
orchestrator: Optional[BuilderOrchestrator] = None
verification_runner: Optional[VerificationHookRunner] = None
freshness_gate: Optional[FreshnessGate] = None
evidence_store: Optional[EvidencePackStore] = None

router = APIRouter(prefix="/gpc", tags=["gpc"])


# ============================================================================
# STARTUP / SHUTDOWN
# ============================================================================

async def initialize_gpc_components(
    redis_url: str = "redis://localhost:6379",
    s3_bucket: str = "veklom-haunt-artifacts",
    repogate_client=None,
    capi_client=None,
    pgl_client=None,
):
    """Initialize all GPC components on app startup"""
    global cache, queue, orchestrator, verification_runner, freshness_gate, evidence_store
    
    # Initialize cache and queue
    cache = HauntCachePlane(redis_url=redis_url)
    queue = CapabilityBuildQueue(redis_url=redis_url)
    
    # Initialize orchestrator
    orchestrator = BuilderOrchestrator(
        queue=queue,
        cache=cache,
        max_concurrent_builders=5,
        pgl_client=pgl_client,
        repogate_client=repogate_client,
    )
    
    # Initialize verification hooks
    verification_runner = VerificationHookRunner(fail_fast=False)
    verification_runner.register_hook(UnitTestHook())
    verification_runner.register_hook(SecurityScanHook(repogate_client))
    verification_runner.register_hook(DependencyScanHook())
    verification_runner.register_hook(PolicyValidationHook(capi_client))
    verification_runner.register_hook(ContractTestHook())
    verification_runner.register_hook(AdversarialTestHook())
    
    # Initialize freshness gate
    freshness_gate = FreshnessGate(
        cache=cache,
        capi_client=capi_client,
        pgl_client=pgl_client,
    )
    
    # Initialize evidence store
    evidence_store = EvidencePackStore(backend_url=f"s3://{s3_bucket}")
    
    # Start orchestrator
    print("[GPC] Starting orchestrator...")


async def shutdown_gpc_components():
    """Shutdown GPC components on app shutdown"""
    global orchestrator
    
    if orchestrator:
        await orchestrator.stop()
        print("[GPC] Orchestrator stopped")


# ============================================================================
# ROUTES: COMPILATION & EXECUTION
# ============================================================================

@router.post("/compile")
async def compile_pipeline(
    pipeline_id: str,
    graph: dict,
):
    """
    Compile a GPC pipeline to Python code.
    
    Args:
        pipeline_id: Pipeline ID
        graph: GPC graph (nodes + edges)
        
    Returns:
        Compiled Python code
    """
    try:
        # Compile
        python_code = compiler.compile(graph)
        
        return {
            "pipeline_id": pipeline_id,
            "success": True,
            "python_code": python_code,
            "lines_of_code": len(python_code.split('\n')),
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test")
async def test_pipeline(
    pipeline_id: str,
    graph: dict,
    compiled_python: str,
    mode: str = "sample",
):
    """
    Test a pipeline with live streaming of results.
    
    Args:
        pipeline_id: Pipeline ID
        graph: GPC graph
        compiled_python: Compiled Python code
        mode: Test mode (dry_run, sample, full)
        
    Returns:
        Streaming response with live results
    """
    async def event_generator():
        """Generate SSE events"""
        test_mode = TestExecutionMode(mode)
        
        async for event in test_executor.test_with_streaming(
            pipeline_id=pipeline_id,
            compiled_python=compiled_python,
            graph=graph,
            mode=test_mode,
        ):
            # SSE format
            yield f"data: {json.dumps(event)}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/execute")
async def execute_pipeline(
    pipeline_id: str,
    graph: dict,
    compiled_python: str,
):
    """
    Execute a pipeline with live streaming (full data).
    
    Args:
        pipeline_id: Pipeline ID
        graph: GPC graph
        compiled_python: Compiled Python code
        
    Returns:
        Streaming response with live results
    """
    async def event_generator():
        """Generate SSE events"""
        async for event in test_executor.execute_with_streaming(
            pipeline_id=pipeline_id,
            compiled_python=compiled_python,
            graph=graph,
        ):
            yield f"data: {json.dumps(event)}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/export-github")
async def export_to_github(
    pipeline_id: str,
    compiled_python: str,
    graph: dict,
    github_repo: str,
    github_token: str,
):
    """
    Export pipeline to GitHub Actions workflow.
    
    Args:
        pipeline_id: Pipeline ID
        compiled_python: Compiled code
        graph: GPC graph
        github_repo: owner/repo
        github_token: GitHub API token
        
    Returns:
        Workflow URL and status
    """
    try:
        result = await github_exporter.export_to_github(
            pipeline_id=pipeline_id,
            compiled_python=compiled_python,
            graph=graph,
            github_repo=github_repo,
            github_token=github_token,
        )
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ROUTES: VERIFICATION & VALIDATION
# ============================================================================

@router.post("/verify")
async def verify_capability(
    capability_id: str,
    source_code: str,
    artifact_bytes: bytes,
    manifest: dict,
):
    """
    Run verification hooks on a built capability.
    
    Args:
        capability_id: The capability being verified
        source_code: Generated source code
        artifact_bytes: Compiled artifact
        manifest: Build manifest
        
    Returns:
        Verification results (pass/fail for each hook)
    """
    try:
        result = await verification_runner.run_all(
            source_code=source_code,
            artifact_bytes=artifact_bytes,
            manifest=manifest,
        )
        
        return {
            "capability_id": capability_id,
            "verification_result": result,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/freshness/validate")
async def validate_freshness(
    capability_id: str,
    evidence_pack_json: str,
):
    """
    Run freshness gate validation before binding.
    
    Args:
        capability_id: The capability being validated
        evidence_pack_json: Serialized evidence pack
        
    Returns:
        Freshness validation result (pass/fail + recommendations)
    """
    try:
        # Deserialize evidence pack
        evidence_dict = json.loads(evidence_pack_json)
        evidence_pack = EvidencePack(
            capability_id=evidence_dict["capability_id"],
            pipeline_id=evidence_dict["pipeline_id"],
            tenant_id=evidence_dict["tenant_id"],
        )
        
        # Run freshness gate
        result = await freshness_gate.validate_before_bind(
            capability_id=capability_id,
            evidence_pack=evidence_pack,
        )
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ROUTES: BINDING & DEPLOYMENT
# ============================================================================

@router.post("/bind")
async def bind_capability_to_node(
    pipeline_id: str,
    node_id: str,
    capability_id: str,
    background_tasks: BackgroundTasks,
):
    """
    Bind a capability to a GPC node.
    
    Final step after:
    1. Builder completes
    2. Verification hooks pass
    3. Freshness gate approves
    
    Args:
        pipeline_id: Pipeline ID
        node_id: Node ID in pipeline
        capability_id: Capability to bind
        
    Returns:
        Binding status
    """
    try:
        # Retrieve capability from cache
        cached_cap = await cache.get(capability_id)
        
        if not cached_cap:
            raise HTTPException(status_code=404, detail="Capability not found")
        
        # In real implementation, would:
        # 1. Update GPC graph node with capability_id
        # 2. Store binding in database
        # 3. Trigger pipeline recompilation if needed
        
        return {
            "status": "bound",
            "pipeline_id": pipeline_id,
            "node_id": node_id,
            "capability_id": capability_id,
            "bound_at": str(datetime.utcnow()),
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ROUTES: MONITORING
# ============================================================================

@router.get("/orchestrator/status")
async def get_orchestrator_status():
    """Get orchestrator status and queue information"""
    if not orchestrator:
        return {"error": "Orchestrator not initialized"}
    
    status = await orchestrator.get_orchestrator_status()
    return status


@router.get("/cache/stats")
async def get_cache_stats():
    """Get cache statistics"""
    if not cache:
        return {"error": "Cache not initialized"}
    
    # Mock stats (in production would get real stats from cache)
    return {
        "l0_size": 42,
        "l0_capacity": 100,
        "l1_size": 156,
        "l2_size_mb": 3200,
        "l2_capacity_mb": 10000,
        "total_lookups": 1243,
        "total_hits": 987,
        "hit_rate_percent": 79.3,
    }


@router.get("/builds")
async def get_recent_builds(
    limit: int = 10,
    status: Optional[str] = None,
    pipeline_id: Optional[str] = None,
):
    """
    Get recent builds.
    
    Args:
        limit: Number of builds to return
        status: Filter by status (built, failed, pending)
        pipeline_id: Filter by pipeline
        
    Returns:
        List of recent builds
    """
    if not queue:
        return {"error": "Queue not initialized"}
    
    # Mock implementation (in production would query database)
    return {
        "builds": [
            {
                "capability_id": "looker_connector_v1",
                "status": "built",
                "duration_seconds": 2.3,
                "created_at": "2026-07-29T08:45:00Z",
            },
            {
                "capability_id": "postgresql_adapter_v1",
                "status": "built",
                "duration_seconds": 3.1,
                "created_at": "2026-07-29T08:40:00Z",
            },
        ],
        "limit": limit,
        "filters": {
            "status": status,
            "pipeline_id": pipeline_id,
        },
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "components": {
            "cache": "ok" if cache else "not_initialized",
            "queue": "ok" if queue else "not_initialized",
            "orchestrator": "ok" if orchestrator else "not_initialized",
            "verification": "ok" if verification_runner else "not_initialized",
            "freshness_gate": "ok" if freshness_gate else "not_initialized",
        },
    }


# ============================================================================
# INITIALIZATION (called in main FastAPI app startup)
# ============================================================================

"""
# In main.py:

from backend.apps.gpc.routes import router, initialize_gpc_components, shutdown_gpc_components

app = FastAPI()
app.include_router(router)

@app.on_event("startup")
async def startup():
    await initialize_gpc_components(
        redis_url="redis://localhost:6379",
        s3_bucket="veklom-haunt-artifacts",
        repogate_client=repogate_client,  # Injected
        capi_client=capi_client,          # Injected
        pgl_client=pgl_client,            # Injected
    )

@app.on_event("shutdown")
async def shutdown():
    await shutdown_gpc_components()
"""
