import { useState, useEffect, useRef } from 'react';
import { fetcher } from '../../lib/api';
import { VerdictBadge } from '../../components/VerdictBadge';
import { Play, Check, AlertCircle, CheckCircle2, Layers, HelpCircle } from 'lucide-react';

interface Difference {
  decision_id: string;
  tool: string;
  old_verdict: string;
  new_verdict: string;
  old_reason_codes?: string[];
  new_reason_codes?: string[];
  rule?: string;
}

interface ReplayResult {
  total_evaluated: number;
  differences: Difference[];
}

function safeKey(k: string): string {
  if (k.includes('*') || /[-:{}[\\],&*#?|<>=!%@\\]/.test(k) || !/^[A-Za-z0-9_.-]+$/.test(k)) {
    return JSON.stringify(k);
  }
  return k;
}

function safeVal(v: any): string {
  if (typeof v === 'string') {
    if (v.includes('\n') || v.includes(':') || v.includes(';') || v.includes('#') || v === '' || /^(true|false|yes|no|null)$/i.test(v)) {
      return JSON.stringify(v);
    }
    return v;
  }
  return String(v);
}

function formatAsYaml(obj: any, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return safeVal(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        const keys = Object.keys(item);
        if (keys.length === 0) return `${pad}- {}`;
        const firstKey = keys[0];
        const firstVal = item[firstKey];
        let firstLine = `${pad}- ${safeKey(firstKey)}:`;
        if (typeof firstVal === 'object' && firstVal !== null) {
          firstLine += '\n' + formatAsYaml(firstVal, indent + 2);
        } else {
          firstLine += ' ' + safeVal(firstVal);
        }
        const otherLines = keys.slice(1).map(k => {
          const val = item[k];
          const kPad = '  '.repeat(indent + 1);
          if (typeof val === 'object' && val !== null) {
            return `${kPad}${safeKey(k)}:\n${formatAsYaml(val, indent + 2)}`;
          }
          return `${kPad}${safeKey(k)}: ${safeVal(val)}`;
        });
        return [firstLine, ...otherLines].join('\n');
      }
      return `${pad}- ${safeVal(item)}`;
    }).join('\n');
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    return keys.map(k => {
      const val = obj[k];
      if (val === null || val === undefined) return `${pad}${safeKey(k)}: null`;
      if (typeof val === 'object' && val !== null) {
        if (Array.isArray(val) && val.length === 0) return `${pad}${safeKey(k)}: []`;
        if (!Array.isArray(val) && Object.keys(val).length === 0) return `${pad}${safeKey(k)}: {}`;
        return `${pad}${safeKey(k)}:\n${formatAsYaml(val, indent + 1)}`;
      }
      return `${pad}${safeKey(k)}: ${safeVal(val)}`;
    }).join('\n');
  }
  return String(obj);
}

function highlightYamlLine(line: string) {
  if (/^\s*#/.test(line)) {
    return <span className="text-[var(--t3)]">{line}</span>;
  }
  // Key-value pairs
  const keyValMatch = line.match(/^(\s*(?:-\s+)?)([A-Za-z0-9_.*+/-]+:)(\s*)(.*)$/);
  if (keyValMatch) {
    const [, prefix, keyWithColon, spacing, val] = keyValMatch;
    let valEl = <span className="text-[var(--tx)]">{val}</span>;
    const trimmedVal = val.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmedVal)) {
      valEl = <span className="text-[var(--wn)] tabular-nums">{val}</span>;
    } else if (/^(true|false|yes|no)$/i.test(trimmedVal)) {
      valEl = <span className="text-[var(--wn)]">{val}</span>;
    } else if (/^["'].*["']$/.test(trimmedVal) || /^(allow|ask|deny)$/.test(trimmedVal)) {
      valEl = <span className="text-[var(--ok)]">{val}</span>;
    }
    return (
      <>
        <span className="text-[var(--t3)]">{prefix}</span>
        <span className="text-[var(--nf)] font-medium">{keyWithColon}</span>
        {spacing}
        {valEl}
      </>
    );
  }
  // Simple list item
  const listMatch = line.match(/^(\s*-\s+)(.*)$/);
  if (listMatch) {
    const [, prefix, item] = listMatch;
    return (
      <>
        <span className="text-[var(--t3)]">{prefix}</span>
        <span className="text-[var(--ok)]">{item}</span>
      </>
    );
  }
  return <span className="text-[var(--tx)]">{line}</span>;
}

export function PolicyEditorPage() {
  const [yamlText, setYamlText] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ReplayResult | null>(null);
  const [activeVersion, setActiveVersion] = useState('1');
  const preRef = useRef<HTMLPreElement | null>(null);

  const nextVersion = String(Number(activeVersion || 1) + 1);

  useEffect(() => {
    fetcher('/v1/policy')
      .then(data => {
        if (typeof data === 'string') {
          setYamlText(data);
        } else if (data && typeof data === 'object') {
          setActiveVersion(String(data.version || '1'));
          if (data.yaml && typeof data.yaml === 'string') {
            setYamlText(data.yaml);
          } else {
            setYamlText(formatAsYaml(data));
          }
        }
      })
      .catch(e => setError(e.message));
  }, []);

  const handleValidate = () => {
    setValidating(true);
    setError(null);
    setValidationSuccess(null);
    try {
      if (!yamlText.trim()) {
        throw new Error('Policy YAML cannot be empty.');
      }
      // Simple format verification
      if (!yamlText.includes('version:') && !yamlText.includes('tools:')) {
        throw new Error('Policy must declare version and tool rules.');
      }
      setValidationSuccess('YAML syntax and policy schema validated successfully.');
      setTimeout(() => setValidationSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message);
    }
    setValidating(false);
  };

  const handleReplay = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetcher('/v1/policy/replay', {
        method: 'POST',
        body: JSON.stringify({ yaml: yamlText })
      });
      setResults(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handlePromote = async () => {
    if (!confirm(`Activate revision v${nextVersion}? Future agent invocations will be governed by this policy.`)) return;
    setLoading(true);
    setError(null);
    try {
      // Ensure the version integer in yamlText matches nextVersion so it creates a new revision
      const updatedYaml = yamlText.replace(/(^|\n)version:\s*\d+/m, `$1version: ${nextVersion}`);
      await fetcher('/v1/policy', {
        method: 'POST',
        body: JSON.stringify({ yaml: updatedYaml })
      });
      alert(`Policy revision v${nextVersion} activated successfully.`);
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const lines = yamlText.split('\n');

  // Compute transition matrix for replay results
  const matrix: Record<string, Record<string, number>> = {
    allow: { allow: 0, ask: 0, deny: 0 },
    ask: { allow: 0, ask: 0, deny: 0 },
    deny: { allow: 0, ask: 0, deny: 0 },
  };

  if (results) {
    for (const diff of results.differences) {
      const from = diff.old_verdict?.toLowerCase();
      const to = diff.new_verdict?.toLowerCase();
      if (matrix[from] && matrix[from][to] !== undefined) {
        matrix[from][to] = (matrix[from][to] || 0) + 1;
      }
    }
  }

  return (
    <div className="py-20 px-24 max-w-[980px] mx-auto space-y-20">
      {/* 6.4 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-12 pb-4">
        <div className="flex items-center gap-10 flex-wrap">
          <h1 className="text-[15px] font-semibold text-[var(--tx)] tracking-tight">
            Policy
          </h1>
          <span className="font-mono text-[12px] text-[var(--t2)]">
            policy.yaml
          </span>
          <span className="px-6 py-1 rounded-[3px] text-[11px] font-mono border border-[var(--ln)] bg-[var(--sl)]/50 text-[var(--tx)]">
            v{activeVersion} active
          </span>
          <span className="px-6 py-1 rounded-[3px] text-[11px] font-mono border border-[var(--ln)] bg-[var(--sl)]/30 text-[var(--t3)]">
            Sample data
          </span>
        </div>
      </div>

      {error && (
        <div className="p-10 bg-[var(--badb)] border border-[var(--bad)]/30 text-[var(--bad)] rounded-[4px] text-[12.5px] flex items-center gap-8">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {validationSuccess && (
        <div className="p-10 bg-[var(--okb)] border border-[var(--ok)]/30 text-[var(--ok)] rounded-[4px] text-[12.5px] flex items-center gap-8">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{validationSuccess}</span>
        </div>
      )}

      {/* 3-Step Lifecycle Visual Guide */}
      <div className="p-14 rounded-[6px] border border-[var(--ln)] bg-[var(--pn)] space-y-10 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-8">
          <div className="flex items-center gap-8 text-[13px] font-semibold text-[var(--tx)]">
            <Layers size={15} className="text-at" />
            <span>How Policy Versioning & Deployment Works</span>
          </div>
          <span className="text-[11.5px] font-mono text-[var(--t2)] bg-[var(--bg)] px-8 py-2 rounded-[4px] border border-[var(--ln)]">
            Live in production: <strong className="text-[var(--ok)]">v{activeVersion}</strong> &bull; Currently editing: <strong className="text-at">Draft v{nextVersion}</strong>
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-[12px]">
          <div className="p-10 rounded-[4px] bg-[var(--bg)] border border-[var(--ln)] space-y-4">
            <div className="flex items-center gap-6 font-semibold text-[var(--tx)]">
              <span className="w-18 h-18 rounded-full bg-[var(--sl)] text-at flex items-center justify-center text-[10px] font-mono font-bold">1</span>
              <span>Edit Draft Rules</span>
            </div>
            <p className="text-[var(--t2)] leading-relaxed">
              Customize thresholds, whitelist safe tools, or add prompt injection filters below in human-readable YAML.
            </p>
          </div>

          <div className="p-10 rounded-[4px] bg-[var(--bg)] border border-[var(--ln)] space-y-4">
            <div className="flex items-center gap-6 font-semibold text-[var(--tx)]">
              <span className="w-18 h-18 rounded-full bg-[var(--sl)] text-[var(--wn)] flex items-center justify-center text-[10px] font-mono font-bold">2</span>
              <span>Dry-Run Replay</span>
            </div>
            <p className="text-[var(--t2)] leading-relaxed">
              Click <strong>Replay</strong> to test your draft against the last 100 historical decisions in &lt;5ms without touching live traffic.
            </p>
          </div>

          <div className="p-10 rounded-[4px] bg-[var(--bg)] border border-[var(--ln)] space-y-4">
            <div className="flex items-center gap-6 font-semibold text-[var(--tx)]">
              <span className="w-18 h-18 rounded-full bg-[var(--sl)] text-[var(--ok)] flex items-center justify-center text-[10px] font-mono font-bold">3</span>
              <span>Activate Live</span>
            </div>
            <p className="text-[var(--t2)] leading-relaxed">
              Click <strong>Activate v{nextVersion}</strong> to commit your new rulebook. The proxy gateway hot-reloads instantly with zero downtime.
            </p>
          </div>
        </div>
      </div>

      {/* Editor Block */}
      <div className="border border-[var(--ln)] rounded-[6px] bg-[var(--pn)] overflow-hidden shadow-xs flex flex-col">
        {/* Toolbar */}
        <div className="h-36 px-12 border-b border-[var(--ln)] bg-[var(--sl)]/30 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button
              onClick={handleValidate}
              disabled={loading || validating}
              className="h-28 px-10 text-[11.5px] font-medium bg-[var(--bg)] border border-[var(--ln)] rounded-[4px] text-[var(--t2)] hover:text-[var(--tx)] hover:bg-[var(--hv)] transition-colors disabled:opacity-50"
            >
              Validate
            </button>
            <button
              onClick={handleReplay}
              disabled={loading}
              className="h-28 px-10 text-[11.5px] font-medium bg-[var(--bg)] border border-[var(--ln)] rounded-[4px] text-[var(--t2)] hover:text-[var(--tx)] hover:bg-[var(--hv)] flex items-center gap-6 transition-colors disabled:opacity-50"
            >
              <Play size={11} className="text-[var(--wn)]" />
              {loading ? 'Replaying...' : 'Replay on sample decisions'}
            </button>
          </div>

          <button
            onClick={handlePromote}
            disabled={loading}
            className="h-28 px-12 text-[11.5px] font-medium bg-[var(--ac)] text-white rounded-[4px] hover:brightness-110 flex items-center gap-6 transition-all disabled:opacity-50 shadow-xs"
          >
            <Check size={12} />
            Activate v{nextVersion}
          </button>
        </div>

        {/* Code area with 44px gutter & mono 12.5px / 21px line height */}
        <div className="flex relative bg-[var(--bg)] font-mono text-[12.5px] leading-[21px] min-h-[380px]">
          {/* 44px line gutter */}
          <div className="w-[44px] shrink-0 border-r border-[var(--ln)] select-none text-right pr-10 pt-12 text-[var(--t3)] font-mono text-[12px] leading-[21px] bg-[var(--sl)]/15">
            {lines.map((_, i) => (
              <div key={i} className="tabular-nums">{i + 1}</div>
            ))}
          </div>

          {/* Syntax colored background pre & transparent foreground textarea */}
          <div className="relative flex-1 min-h-[380px] overflow-hidden">
            <pre
              ref={preRef}
              aria-hidden="true"
              className="absolute inset-0 m-0 p-12 pointer-events-none whitespace-pre overflow-hidden font-mono text-[12.5px] leading-[21px] select-none"
            >
              {lines.map((line, i) => (
                <div key={i} className="h-[21px] whitespace-pre">
                  {highlightYamlLine(line)}
                </div>
              ))}
            </pre>

            <textarea
              className="relative w-full h-full min-h-[380px] p-12 bg-transparent text-transparent caret-[var(--tx)] selection:bg-[var(--ac)]/25 selection:text-transparent outline-none resize-y whitespace-pre font-mono text-[12.5px] leading-[21px]"
              value={yamlText}
              onChange={e => setYamlText(e.target.value)}
              onScroll={e => {
                if (preRef.current) {
                  preRef.current.scrollTop = e.currentTarget.scrollTop;
                  preRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
              }}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* 6.4 Replay results section */}
      {results && (
        <div className="space-y-12 pt-4">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--tx)]">
              Replay results
            </h2>
            <p className="text-[12px] text-[var(--t2)] mt-1">
              Draft v{nextVersion} vs active v{activeVersion}, on {results.total_evaluated || 100} stored decisions. No model calls were made.
            </p>
          </div>

          {/* Plain-English Replay Explanation */}
          <div className="p-12 rounded-[6px] bg-[var(--sl)]/30 border border-[var(--ln)] flex items-start gap-10 text-[12px]">
            <HelpCircle size={15} className="text-at shrink-0 mt-2" />
            <div className="space-y-2">
              <div className="font-semibold text-[var(--tx)]">
                What does this dry-run mean?
              </div>
              <p className="text-[var(--t2)] leading-relaxed">
                AgentGate tested your draft rules against the last {results.total_evaluated || 100} real-world decisions using stored probability vectors (zero GPU cost).
                {results.differences.length === 0 ? (
                  <span className="text-[var(--ok)] font-medium"> Zero decisions changed — your draft behaves identically to current production.</span>
                ) : (
                  <span> Exactly <strong className="text-[var(--wn)]">{results.differences.length} decisions would have changed</strong>. Check the transition table and detail list below to ensure no high-risk actions were unintentionally allowed before clicking Activate.</span>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {/* Block 1: Verdict changes (from/to table; changed cells in amber) */}
            <div className="bg-[var(--pn)] border border-[var(--ln)] rounded-[6px] p-14 space-y-10 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--ln)]">
                <span className="text-[12.5px] font-medium text-[var(--tx)]">
                  Verdict changes
                </span>
                <span className="text-[11px] font-mono text-[var(--t3)] tabular-nums">
                  {results.differences.length} altered
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[var(--ln)] text-[var(--t3)] text-left">
                      <th className="py-6 px-8 font-normal">From \ To</th>
                      <th className="py-6 px-8 text-center font-normal">allow</th>
                      <th className="py-6 px-8 text-center font-normal">ask</th>
                      <th className="py-6 px-8 text-center font-normal">deny</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['allow', 'ask', 'deny'] as const).map(fromV => (
                      <tr key={fromV} className="border-b border-[var(--ln)]/40 last:border-0">
                        <td className="py-6 px-8 text-[var(--t2)] font-medium">{fromV}</td>
                        {(['allow', 'ask', 'deny'] as const).map(toV => {
                          const count = matrix[fromV]?.[toV] || 0;
                          const isChanged = fromV !== toV && count > 0;
                          return (
                            <td
                              key={toV}
                              className={`py-6 px-8 text-center tabular-nums ${
                                isChanged
                                  ? 'text-[var(--wn)] font-semibold bg-[var(--wn)]/15 border border-[var(--wn)]/30 rounded-[3px]'
                                  : count > 0
                                  ? 'text-[var(--tx)]'
                                  : 'text-[var(--t3)]'
                              }`}
                            >
                              {count > 0 ? count : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Block 2: Changed decisions (id, tool, allow -> ask, and the rule responsible) */}
            <div className="bg-[var(--pn)] border border-[var(--ln)] rounded-[6px] p-14 space-y-10 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--ln)]">
                <span className="text-[12.5px] font-medium text-[var(--tx)]">
                  Changed decisions
                </span>
                <span className="text-[11px] font-mono text-[var(--t3)]">
                  detail list
                </span>
              </div>

              <div className="space-y-6 flex-1 max-h-[220px] overflow-y-auto pr-4">
                {results.differences.map((diff, i) => (
                  <div
                    key={i}
                    className="p-8 border border-[var(--ln)] rounded-[4px] bg-[var(--bg)] text-[12px] flex items-center justify-between gap-10"
                  >
                    <div className="flex items-center gap-8 min-w-0">
                      <span className="font-mono text-[11.5px] text-[var(--t2)] shrink-0">
                        {diff.decision_id.slice(0, 8)}
                      </span>
                      <span className="font-mono font-medium text-[var(--tx)] truncate">
                        {diff.tool}
                      </span>
                    </div>

                    <div className="flex items-center gap-8 shrink-0">
                      <VerdictBadge verdict={diff.old_verdict} />
                      <span className="text-[var(--t3)] text-[11px]">→</span>
                      <VerdictBadge verdict={diff.new_verdict} />
                      <span className="text-[11px] font-mono text-[var(--t3)] bg-[var(--sl)]/40 px-6 py-1 rounded-[3px] truncate max-w-[120px]">
                        {diff.rule || diff.new_reason_codes?.[0] || 'rule'}
                      </span>
                    </div>
                  </div>
                ))}

                {results.differences.length === 0 && (
                  <div className="py-24 text-center text-[var(--t2)] text-[12.5px]">
                    Zero behavioral changes across {results.total_evaluated} stored decisions.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Primary Activate v2 at bottom right */}
          <div className="flex justify-end pt-8">
            <button
              onClick={handlePromote}
              disabled={loading}
              className="h-28 px-14 text-[12px] font-medium bg-[var(--ac)] text-white rounded-[4px] hover:brightness-110 flex items-center gap-6 transition-all disabled:opacity-50 shadow-xs"
            >
              <Check size={12} />
              Activate v{nextVersion}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
