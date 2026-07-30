/**
 * GPC Test/Deploy UI Components
 * Visual preview mode + GitHub Actions export dialog
 * 
 * Generated for: veklom-control-plane/components/gpc/
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Play,
  Github,
  Loader,
  X,
} from 'lucide-react';
import { GPCPipelineGraph, PreviewData, ExecutionEvent } from '../../types/gpc';

// ============================================================================
// TEST PREVIEW PANEL
// ============================================================================

interface TestPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineId: string;
  graph: GPCPipelineGraph;
  onApprove?: () => void;
}

export const TestPreviewModal: React.FC<TestPreviewModalProps> = React.memo(
  ({ isOpen, onClose, pipelineId, graph, onApprove }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<
      Array<{
        nodeId: string;
        nodeType: string;
        status: 'success' | 'failure' | 'pending';
        rows: number;
        columns: string[];
        sample: any[][];
        error?: string;
      }>
    >([]);
    const [testRunId, setTestRunId] = useState<string | null>(null);
    const [canDeploy, setCanDeploy] = useState(false);

    const handleTestRun = useCallback(async () => {
      setIsRunning(true);
      setResults([]);
      setTestRunId(null);
      setCanDeploy(false);

      try {
        const response = await fetch('/api/v1/gpc/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            pipeline_id: pipelineId,
            tenant_id: graph.tenant_id,
            graph: { ...graph, pipeline_id: pipelineId },
          }),
        });
        if (!response.ok) {
          throw new Error(`GPC test failed: ${response.status} ${response.statusText}`);
        }

        const stream = await response.text();
        for (const frame of stream.split('\n\n')) {
          const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          const data: ExecutionEvent = JSON.parse(dataLine.slice(6));
          if (data.event === 'node_complete' && data.preview) {
            setResults((prev) => [
              ...prev,
              {
                nodeId: data.node_id || 'unknown',
                nodeType: 'Transform',
                status: data.success === false ? 'failure' : 'success',
                rows: data.preview.rows,
                columns: data.preview.columns,
                sample: data.preview.sample,
                error: data.success === false ? data.error || data.message : undefined,
              },
            ]);
          } else if (data.event === 'complete') {
            if (data.success !== true) throw new Error(data.error || data.message || 'GPC test failed');
            setTestRunId(pipelineId);
            setCanDeploy(true);
          } else if (data.event === 'error' || data.success === false) {
            throw new Error(data.error || data.message || 'GPC test failed');
          }
        }
        setIsRunning(false);      } catch (err) {
        console.error('Test run failed:', err);
        setIsRunning(false);
      }
    }, [pipelineId, graph]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Test Pipeline</h2>
              <p className="text-sm text-gray-500 mt-1">
                Run the active graph through the governed GPC execution path
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Execution contract */}
          <div className="p-6 border-b border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Execution Mode
            </label>
            <p className="text-sm font-medium text-gray-700">
              Governed execution of the active graph
            </p>
          </div>

          {/* Results */}
          <div className="p-6">
            {results.length === 0 && !isRunning && (
              <div className="text-center py-12">
                <Play size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">
                  Click "Start Test" to run the active graph
                </p>
              </div>
            )}

            {isRunning && (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader size={24} className="animate-spin text-blue-600" />
                <span className="text-gray-700">Running test execution...</span>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-3">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-4 ${
                      result.status === 'success'
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {result.status === 'success' ? (
                        <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900">
                          {result.nodeId}
                        </h4>
                        {result.status === 'success' ? (
                          <div className="mt-2 text-sm text-gray-700">
                            <p>
                              <strong>Output:</strong> {result.rows} rows,{' '}
                              {result.columns.length} columns
                            </p>
                            {result.sample.length > 0 && (
                              <div className="mt-2 bg-white rounded p-2 text-xs overflow-x-auto">
                                <pre className="font-mono">
                                  {JSON.stringify(result.sample[0], null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-red-700">
                            {result.error || 'Unknown error'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleTestRun}
              disabled={isRunning}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Play size={16} />
              {isRunning ? 'Running...' : 'Start Test'}
            </button>
            {canDeploy && onApprove && (
              <button
                onClick={onApprove}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <CheckCircle size={16} />
                Approve & Deploy
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

TestPreviewModal.displayName = 'TestPreviewModal';

// ============================================================================
// GITHUB ACTIONS EXPORT DIALOG
// ============================================================================

interface GitHubExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineId: string;
  pipelineName: string;
}

export const GitHubExportDialog: React.FC<GitHubExportDialogProps> = React.memo(
  ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full mx-4">
          <div className="border-b border-gray-200 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Github size={24} className="text-gray-900" />
              <h2 className="text-xl font-bold text-gray-900">
                GitHub Workflow Export
              </h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
              GitHub workflow export is unavailable in the canonical GPC backend.
              No repository credentials or pipeline data will be sent.
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
);

GitHubExportDialog.displayName = 'GitHubExportDialog';
