import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Download, Github, Loader, Play, X } from "lucide-react";
import type { ExecutionEvent } from "../../types/gpc";
import { applyTestEvent, createTestDeployState, type TestDeployState } from "../../gpc/contracts";

type TestPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pipelineId: string;
  tenantId: string;
  onApprove?: () => void;
};

export const TestPreviewModal = React.memo(function TestPreviewModal({
  isOpen,
  onClose,
  pipelineId,
  tenantId,
  onApprove,
}: TestPreviewModalProps) {
  const [state, setState] = useState<TestDeployState>(createTestDeployState);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isOpen) {
      setState(createTestDeployState());
      setError(undefined);
      setIsRunning(false);
    }
  }, [isOpen]);

  const startTest = useCallback(() => {
    setState({ status: "running", results: [] });
    setError(undefined);
    setIsRunning(true);
    const query = new URLSearchParams({ pipeline_id: pipelineId, tenant_id: tenantId });
    const source = new EventSource(`/api/v1/gpc/execute?${query.toString()}`);
    const close = () => {
      source.close();
      setIsRunning(false);
    };
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as ExecutionEvent;
        setState((current) => applyTestEvent(current, event));
        if (event.event === "complete" || event.event === "error") close();
      } catch (eventError) {
        setError(eventError instanceof Error ? eventError.message : "Invalid test event");
        setState((current) => ({ ...current, status: "failure", error: "Invalid test event" }));
        close();
      }
    };
    source.onerror = () => {
      setError("Test connection lost");
      setState((current) => ({ ...current, status: "failure", error: "Test connection lost" }));
      close();
    };
  }, [pipelineId, tenantId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Test Pipeline</h2>
            <p className="mt-1 text-sm text-gray-500">Run the compiled graph through the current UACP SSE execution seam.</p>
          </div>
          <button onClick={onClose} className="rounded p-2 hover:bg-gray-100" aria-label="Close test dialog"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-6">
          {state.results.length === 0 && !isRunning && <p className="py-8 text-center text-sm text-gray-500">Start a test to stream node previews.</p>}
          {isRunning && <div className="flex items-center justify-center gap-2 py-8 text-sm text-blue-700"><Loader size={18} className="animate-spin" /> Running test…</div>}
          {state.results.map((result) => (
            <div key={result.nodeId} className={`rounded border p-3 ${result.status === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-start gap-2">
                {result.status === "success" ? <CheckCircle size={18} className="text-green-600" /> : <AlertCircle size={18} className="text-red-600" />}
                <div className="min-w-0 text-sm"><strong>{result.nodeId}</strong>{result.preview && <p className="mt-1 text-gray-700">{result.preview.rows} rows · {result.preview.columns.length} columns</p>}{result.error && <p className="mt-1 text-red-700">{result.error}</p>}</div>
              </div>
            </div>
          ))}
          {(error || state.error) && <p role="alert" className="text-sm text-red-700">{error || state.error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-6">
          <button onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm">Close</button>
          <button onClick={startTest} disabled={isRunning} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"><Play size={16} />{isRunning ? "Running…" : "Start Test"}</button>
          {state.status === "ready_to_deploy" && onApprove && <button onClick={onApprove} className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm text-white"><CheckCircle size={16} />Approve Test</button>}
        </div>
      </div>
    </div>
  );
});

TestPreviewModal.displayName = "TestPreviewModal";

type GitHubExportDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  pipelineId: string;
  tenantId: string;
};

export const GitHubExportDialog = React.memo(function GitHubExportDialog({ isOpen, onClose, pipelineId, tenantId }: GitHubExportDialogProps) {
  const [schedule, setSchedule] = useState("0 0 * * *");
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<{ fileName: string; workflow: string }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isOpen) { setResult(undefined); setError(undefined); setIsExporting(false); }
  }, [isOpen]);

  const exportWorkflow = useCallback(async () => {
    setIsExporting(true);
    setError(undefined);
    try {
      const response = await fetch("/api/v1/gpc/export-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, tenant_id: tenantId, schedule }),
      });
      const payload = await response.json() as { success?: boolean; file_name?: string; workflow?: string; error?: string };
      if (!response.ok || payload.success !== true || !payload.file_name || !payload.workflow) throw new Error(payload.error || "Workflow export failed");
      setResult({ fileName: payload.file_name, workflow: payload.workflow });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Workflow export failed");
    } finally { setIsExporting(false); }
  }, [pipelineId, tenantId, schedule]);

  const download = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.workflow], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }, [result]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-6"><h2 className="flex items-center gap-2 text-xl font-bold"><Github size={20} /> Generate GitHub Actions Workflow</h2><button onClick={onClose} aria-label="Close export dialog"><X size={18} /></button></div>
        {!result ? <div className="space-y-4 p-6"><p className="text-sm text-gray-600">Generate a reviewable workflow artifact. This UACP-only integration does not write to GitHub.</p><label className="block text-sm font-medium">Schedule (cron)<input value={schedule} onChange={(event) => setSchedule(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm" disabled={isExporting} /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button onClick={exportWorkflow} disabled={isExporting} className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{isExporting ? <Loader size={16} className="animate-spin" /> : <Github size={16} />}{isExporting ? "Generating…" : "Generate Workflow"}</button></div> : <div className="space-y-4 p-6"><p className="text-sm text-green-700">Workflow generated: <code>{result.fileName}</code></p><pre className="max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">{result.workflow}</pre><button onClick={download} className="flex w-full items-center justify-center gap-2 rounded bg-green-600 px-4 py-2 text-sm text-white"><Download size={16} />Download Workflow</button></div>}
      </div>
    </div>
  );
});

GitHubExportDialog.displayName = "GitHubExportDialog";
