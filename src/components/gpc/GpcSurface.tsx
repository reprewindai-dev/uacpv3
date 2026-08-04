/**
 * GPC Page (UPDATED) — Full Pipeline Lifecycle
 * Compile → Test (sample data) → Approve → Deploy (GitHub Actions)
 *
 * Fixed: useState hooks declared before useGpc so setToast is in scope.
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Play,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  TestTube2,
  Github,
  Copy,
} from 'lucide-react';
import { useGpc } from '../../hooks/useGpc';
import { GpcCanvas, GpcPropertyPanel } from './GpcCanvas';
import { TestPreviewModal, GitHubExportDialog } from './GpcTestDeployUI';
import { useCanvasStore, useExecutionStore, usePreviewStore } from '../../stores/gpc_stores';
import { buildActiveGraph } from '../../gpc/contracts';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col min-h-screen bg-gray-50 p-6">{children}</div>
);

const Pill = ({ children, tone, dot }: { children: React.ReactNode; tone: string; dot?: boolean }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${tone}-100 text-${tone}-800`}>
    {dot && <span className={`w-2 h-2 mr-1 rounded-full bg-${tone}-500`} />}
    {children}
  </span>
);

const ModuleHeader = ({ breadcrumb, title, subtitle, pills }: { breadcrumb: string; title: string; subtitle: string; pills: React.ReactNode }) => (
  <div className="mb-6">
    <div className="text-xs text-gray-500 mb-1">{breadcrumb}</div>
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600">{subtitle}</p>
      </div>
      <div className="flex gap-2">{pills}</div>
    </div>
  </div>
);

interface CompilationModal {
  isOpen: boolean;
  pythonCode: string;
  nodeCount: number;
  warnings: string[];
}

export default function GpcPage() {
  // useState FIRST — so setToast is defined before useGpc callbacks reference it
  const [showIntentDialog, setShowIntentDialog] = useState(false);
  const [intentInput, setIntentInput] = useState('');
  const [compilationModal, setCompilationModal] = useState<CompilationModal>({ isOpen: false, pythonCode: '', nodeCount: 0, warnings: [] });
  const [showTestModal, setShowTestModal] = useState(false);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [pipelineName, setPipelineName] = useState('Untitled Pipeline');
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null);

  // GPC hook — setToast now safely in scope
  const { compile, execute, generateFromIntent, isLoading } = useGpc({
    onSuccess: (msg) => setToast({ message: msg, type: 'success' }),
    onError: (msg) => setToast({ message: msg, type: 'error' }),
  });

  const pipelineId = useCanvasStore((s) => s.pipelineId);
  const tenantId = useCanvasStore((s) => s.tenantId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const activeGraph = useMemo(
    () => buildActiveGraph({ pipeline_id: pipelineId, tenant_id: tenantId, nodes, edges }),
    [pipelineId, tenantId, nodes, edges],
  );
  const isExecuting = useExecutionStore((s) => s.isRunning);
  const progress = useExecutionStore((s) => s.getRunProgress());
  const selectedPreview = usePreviewStore((s) => {
    const nodeId = s.selectedPreviewNodeId;
    return nodeId ? s.previews.get(nodeId) : undefined;
  });

  const handleCompile = useCallback(async () => {
    const result = await compile();
    if (result) {
      setCompilationModal({ isOpen: true, pythonCode: result.python_code, nodeCount: result.node_count, warnings: result.warnings || [] });
    }
  }, [compile]);

  const handleExecute = useCallback(async () => { await execute(); }, [execute]);

  const handleGenerateIntent = useCallback(async () => {
    if (!intentInput.trim()) { setToast({ message: 'Please describe your pipeline intent', type: 'error' }); return; }
    await generateFromIntent(intentInput);
    setShowIntentDialog(false);
    setIntentInput('');
  }, [intentInput, generateFromIntent]);

  const handleApproveTest = useCallback(async () => {
    setToast({ message: 'Test passed! Ready for deployment.', type: 'success' });
    setShowTestModal(false);
    setDeploymentStatus('tested');
  }, []);

  return (
    <Shell>
      <ModuleHeader
        breadcrumb="GPC · Generative Pipeline Compiler"
        title="Pipeline Generator"
        subtitle="Visual intent → Executable pipeline → Auto-deployed to production"
        pills={
          <>
            <Pill tone="green" dot>Backend live</Pill>
            <Pill tone="cyan">Test → Deploy</Pill>
            {deploymentStatus && <Pill tone="amber">{deploymentStatus === 'tested' ? 'Ready to deploy' : deploymentStatus}</Pill>}
            <Pill tone="amber" dot={isExecuting}>{isExecuting ? 'Running' : 'Ready'}</Pill>
          </>
        }
      />

      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-lg flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-auto text-xs font-medium">Dismiss</button>
        </div>
      )}

      {isExecuting && (
        <div className="mb-4 bg-gray-100 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Executing: {progress.completed}/{progress.total} nodes</span>
            <span className="text-sm text-gray-600">{progress.percent.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      )}

      <div className="mb-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowIntentDialog(true)} disabled={isExecuting || isLoading} className="px-4 py-2 text-sm font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            <BookOpen size={16} /> Generate from Intent
          </button>
          <button onClick={handleCompile} disabled={isExecuting || isLoading} className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {isLoading ? 'Compiling...' : '📋 Compile'}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowTestModal(true)} disabled={isExecuting || !compilationModal.pythonCode} className="px-4 py-2 text-sm font-medium rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
            <TestTube2 size={16} /> Test on Sample Data
          </button>
          <button onClick={handleExecute} disabled={isExecuting || isLoading || !compilationModal.pythonCode} className="px-4 py-2 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
            <Play size={16} /> {isExecuting ? 'Running...' : 'Execute'}
          </button>
          <button onClick={() => setShowGitHubDialog(true)} disabled={deploymentStatus !== 'tested'} className={`px-4 py-2 text-sm font-medium rounded text-white flex items-center gap-2 ${deploymentStatus === 'tested' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'}`}>
            <Github size={16} /> Export to GitHub Actions
          </button>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          <strong>Workflow:</strong> Generate or edit the graph → Compile → Test → Deploy via GitHub Actions.
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-320px)] rounded-xl overflow-hidden border border-gray-200 shadow-md">
        <div className="flex-1"><GpcCanvas onCompile={handleCompile} onExecute={handleExecute} /></div>
        <GpcPropertyPanel />
        {selectedPreview && (
          <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-sm mb-1">Data Preview</h3>
              <p className="text-xs text-gray-500">{selectedPreview.rows} rows, {selectedPreview.columns.length} columns</p>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead><tr>{selectedPreview.columns.slice(0, 3).map((col) => <th key={col} className="border border-gray-300 px-2 py-1 bg-gray-100 font-medium text-left">{col}</th>)}</tr></thead>
                <tbody>{selectedPreview.sample.slice(0, 5).map((row, i) => <tr key={i}>{row.slice(0, 3).map((val, j) => <td key={j} className="border border-gray-300 px-2 py-1 text-gray-700">{String(val).slice(0, 20)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showIntentDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 p-6">
            <h2 className="text-xl font-semibold mb-4">Generate Pipeline from Intent</h2>
            <textarea value={intentInput} onChange={(e) => setIntentInput(e.target.value)} placeholder="E.g., 'Load sales.csv, filter completed orders, group by customer, save to results.parquet'" className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm mb-4 h-24" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowIntentDialog(false)} className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
              <button onClick={handleGenerateIntent} disabled={isLoading} className="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{isLoading ? 'Generating...' : 'Generate'}</button>
            </div>
          </div>
        </div>
      )}

      {compilationModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Compiled Pipeline</h2>
            {compilationModal.warnings.length > 0 && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800"><strong>Warnings:</strong><ul className="mt-1 space-y-1">{compilationModal.warnings.map((w, i) => <li key={i}>• {w}</li>)}</ul></div>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-600 mb-2"><strong>Nodes:</strong> {compilationModal.nodeCount}</p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs max-h-64 overflow-y-auto">{compilationModal.pythonCode}</pre>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { navigator.clipboard.writeText(compilationModal.pythonCode); setToast({ message: 'Copied to clipboard', type: 'success' }); }} className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-2"><Copy size={16} /> Copy Code</button>
              <button onClick={() => setCompilationModal({ ...compilationModal, isOpen: false })} className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Close</button>
            </div>
          </div>
        </div>
      )}

      <TestPreviewModal isOpen={showTestModal} onClose={() => setShowTestModal(false)} pipelineId={pipelineId} graph={activeGraph} onApprove={handleApproveTest} />
      <GitHubExportDialog isOpen={showGitHubDialog} onClose={() => setShowGitHubDialog(false)} pipelineId={pipelineId} pipelineName={pipelineName} />
    </Shell>
  );
}
