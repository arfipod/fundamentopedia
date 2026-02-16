import { useCallback, useRef, useState } from 'react';
import { parseFinancialMarkdown } from '../financials/parser';
import { analyzeFinancials } from '../financials/calculator';
import type { FinancialReport } from '../financials/types';
import { FinancialReportView } from './FinancialReport';

export function FinancialAnalysis() {
  const [markdown, setMarkdown] = useState('');
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyze = useCallback((text: string) => {
    setError(null);
    if (!text.trim()) {
      setError('Please paste or upload financial markdown data.');
      setReport(null);
      return;
    }
    try {
      const parsed = parseFinancialMarkdown(text);
      if (Object.keys(parsed.sections).length === 0) {
        setError('No financial sections found. Please check the markdown format (expected ## Income Statement, ## Balance Sheet, etc.).');
        setReport(null);
        return;
      }
      const result = analyzeFinancials(parsed);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse financial data.');
      setReport(null);
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    analyze(markdown);
  }, [markdown, analyze]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setMarkdown(text);
      analyze(text);
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsText(file);
    // Reset the input so the same file can be re-uploaded
    e.target.value = '';
  }, [analyze]);

  const handleClear = useCallback(() => {
    setMarkdown('');
    setReport(null);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.txt') || file.type.startsWith('text/'))) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setMarkdown(text);
        analyze(text);
      };
      reader.readAsText(file);
    } else {
      // Try pasted text from drag
      const text = e.dataTransfer.getData('text/plain');
      if (text) {
        setMarkdown(text);
        analyze(text);
      }
    }
  }, [analyze]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div>
      {!report && (
        <div className="card mb-4">
          <div className="card-body">
            <h4 className="card-title mb-3">Financial Statement Analysis</h4>
            <p className="text-muted small mb-3">
              Paste TIKR Terminal markdown data or upload a .md file. The parser recognises
              Income Statement, Balance Sheet, Cash Flow, Ratios, Valuation Multiples,
              Analyst Price Targets, and Consensus Estimates sections.
            </p>

            <div
              className="border border-2 border-dashed rounded p-3 mb-3 text-center"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={{ minHeight: 60, cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
            >
              <div className="text-muted">
                Drop a .md / .txt file here, or click to browse
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,text/plain,text/markdown"
                className="d-none"
                onChange={handleFileUpload}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="financial-md-input" className="form-label fw-semibold">
                Or paste markdown below:
              </label>
              <textarea
                id="financial-md-input"
                className="form-control font-monospace"
                rows={14}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder={"# TICKER – Company Name\nPrice: US$100.00 | Extracted: ...\nPeriod: annual | Sections: 7\n\n---\n\n## Income Statement\n\n| Income Statement | 30/09/20 | ...\n| --- | --- |\n| Revenues | 100.000,00 | ..."}
                style={{ fontSize: '0.8rem' }}
              />
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="d-flex gap-2">
              <button type="button" className="btn btn-primary" onClick={handleAnalyze} disabled={!markdown.trim()}>
                Analyze Financials
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={handleClear} disabled={!markdown}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {report && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="mb-0">
              {report.header.ticker || 'Financial'} Analysis Report
            </h4>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleClear}>
                New Analysis
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${report.header.ticker || 'financial'}_analysis.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download Report JSON
              </button>
            </div>
          </div>
          <FinancialReportView report={report} />
        </div>
      )}
    </div>
  );
}
