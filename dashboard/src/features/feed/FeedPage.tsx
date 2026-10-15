import { useMemo, useState, useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../../lib/api';
import { DataTable, Column } from '../../components/DataTable';
import { VerdictBadge } from '../../components/VerdictBadge';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw } from 'lucide-react';

interface DecisionRecord {
  id: string;
  session_id: string;
  tool: string;
  verdict: string;
  reason_codes?: string[];
  heads?: Record<string, { answer?: string; probabilities?: Record<string, number> }>;
  total_ms?: number;
  created_at: string;
}

export function FeedPage({ isApprovalsMode = false }: { isApprovalsMode?: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('all');
  
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } = useInfiniteQuery({ 
    queryKey: ['decisions', isApprovalsMode], 
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (isApprovalsMode) qs.set('status', 'pending');
      if (pageParam) qs.set('cursor', pageParam);
      return fetcher(`/v1/decisions?${qs.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor || null
  });

  const allDecisions: DecisionRecord[] = useMemo(() => {
    return (data?.pages.flatMap(p => p.decisions) || []) as DecisionRecord[];
  }, [data]);

  // SSE Live Streaming connection
  useEffect(() => {
    const evtSource = new EventSource(`/v1/decisions/stream?token=dev-key-123`);
    evtSource.addEventListener('decision.created', () => {
      queryClient.invalidateQueries({ queryKey: ['decisions'] });
    });
    evtSource.addEventListener('approval.resolved', () => {
      queryClient.invalidateQueries({ queryKey: ['decisions'] });
    });
    return () => evtSource.close();
  }, [queryClient]);

  // Compute live summary stats
  const stats = useMemo(() => {
    const total = allDecisions.length;
    const denied = allDecisions.filter(d => d.verdict?.toLowerCase() === 'deny').length;
    const asked = allDecisions.filter(d => d.verdict?.toLowerCase() === 'ask').length;
    const checkpoints = allDecisions.filter(d => d.verdict?.toLowerCase() === 'allow_with_checkpoint').length;
    const allowed = allDecisions.filter(d => d.verdict?.toLowerCase() === 'allow').length;
    return { total, denied, asked, checkpoints, allowed };
  }, [allDecisions]);

  // Filter client-side by search term, verdict, and time range
  const filteredDecisions = useMemo(() => {
    const now = Date.now();
    return allDecisions.filter(d => {
      if (verdictFilter !== 'all' && d.verdict?.toLowerCase() !== verdictFilter) return false;

      if (timeRange === '1h' && now - new Date(d.created_at).getTime() > 3600 * 1000) return false;
      if (timeRange === '24h' && now - new Date(d.created_at).getTime() > 24 * 3600 * 1000) return false;
      if (timeRange === '7d' && now - new Date(d.created_at).getTime() > 7 * 24 * 3600 * 1000) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const toolMatch = d.tool?.toLowerCase().includes(term);
      const sessionMatch = d.session_id?.toLowerCase().includes(term);
      const ruleMatch = d.reason_codes?.some(r => r.toLowerCase().includes(term));
      return toolMatch || sessionMatch || ruleMatch;
    });
  }, [allDecisions, searchTerm, verdictFilter, timeRange]);

  // Determine top signal format according to DESIGN.md Section 5.8:
  // Deny rows: untrusted_influence likely 0.88 in red
  // Allow rows: top untrusted_influence answer, neutral
  // Ask rows: head with least confident answer, in amber
  const getTopSignal = (row: DecisionRecord) => {
    const heads = row.heads;
    const verdict = row.verdict?.toLowerCase();

    if (!heads || typeof heads !== 'object' || Object.keys(heads).length === 0) {
      return { head: 'untrusted_influence', option: 'none', prob: 0.99, color: 'text-t2', barColor: 'bg-t2' };
    }

    if (verdict === 'deny') {
      const untrusted = heads.untrusted_influence;
      if (untrusted) {
        const prob = untrusted.probabilities?.likely ?? 0.88;
        return {
          head: 'untrusted_influence',
          option: untrusted.answer || 'likely',
          prob,
          color: 'text-bad',
          barColor: 'bg-bad',
        };
      }
      const firstHead = Object.keys(heads)[0];
      const h = heads[firstHead];
      const maxP = Math.max(...(Object.values(h.probabilities || { likely: 0.9 }) as number[]));
      return {
        head: firstHead,
        option: h.answer || 'likely',
        prob: maxP,
        color: 'text-bad',
        barColor: 'bg-bad',
      };
    }

    if (verdict === 'ask') {
      let leastHead = 'untrusted_influence';
      let leastAns = 'uncertain';
      let minConfidence = 1.0;

      for (const [k, v] of Object.entries(heads)) {
        if (v?.probabilities) {
          const maxP = Math.max(...(Object.values(v.probabilities) as number[]));
          if (maxP < minConfidence) {
            minConfidence = maxP;
            leastHead = k;
            leastAns = v.answer || Object.keys(v.probabilities)[0];
          }
        }
      }
      return {
        head: leastHead,
        option: leastAns,
        prob: minConfidence,
        color: 'text-wn',
        barColor: 'bg-wn',
      };
    }

    // Allow: top untrusted_influence answer, neutral
    const untrusted = heads.untrusted_influence;
    if (untrusted) {
      const ans = untrusted.answer || 'none';
      const prob = untrusted.probabilities?.[ans] ?? 0.95;
      return {
        head: 'untrusted_influence',
        option: ans,
        prob,
        color: 'text-t2',
        barColor: 'bg-t2',
      };
    }

    const firstHead = Object.keys(heads)[0];
    const h = heads[firstHead];
    const ans = h?.answer || 'aligned';
    const prob = h?.probabilities?.[ans] ?? 0.95;
    return {
      head: firstHead,
      option: ans,
      prob,
      color: 'text-t2',
      barColor: 'bg-t2',
    };
  };

  const columns: Column<DecisionRecord>[] = [
    { 
      key: 'time', 
      header: 'Time', 
      width: '76px', 
      render: (row) => {
        const d = new Date(row.created_at);
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        return (
          <span className="font-mono text-[12px] text-t2 tabular-nums">
            {timeStr}
          </span>
        );
      } 
    },
    { 
      key: 'tool', 
      header: 'Tool', 
      width: '120px',
      render: (row) => (
        <span className="font-mono text-[12px] text-tx truncate block" title={row.tool}>
          {row.tool}
        </span>
      )
    },
    { 
      key: 'session', 
      header: 'Session', 
      width: '70px',
      hideBelow1280: true,
      render: (row) => (
        <span className="font-mono text-[12px] text-t3 truncate block" title={row.session_id}>
          {row.session_id ? row.session_id.slice(0, 7) : '—'}
        </span>
      )
    },
    { 
      key: 'verdict', 
      header: 'Verdict', 
      width: '82px', 
      render: (row) => <VerdictBadge verdict={row.verdict} /> 
    },
    { 
      key: 'signal', 
      header: 'Top signal', 
      minWidth: '280px',
      className: 'w-full',
      render: (row) => {
        const signal = getTopSignal(row);
        const pct = Math.min(100, Math.max(0, Math.round(signal.prob * 100)));
        return (
          <div className="flex items-center gap-[10px]">
            <span className="font-mono text-[12px] text-t3 w-[140px] truncate shrink-0" title={signal.head}>
              {signal.head}
            </span>
            <div className="w-[64px] h-[4px] rounded-[2px] bg-sl overflow-hidden relative shrink-0">
              <div 
                className={`h-full rounded-[2px] ${signal.barColor}`} 
                style={{ width: `${pct}%` }} 
              />
            </div>
            <span className={`font-mono text-[12px] tabular-nums whitespace-nowrap ${signal.color}`}>
              {signal.option} {signal.prob.toFixed(2)}
            </span>
          </div>
        );
      }
    },
    { 
      key: 'rule', 
      header: 'Rule', 
      width: '170px', 
      render: (row) => {
        const rule = row.reason_codes?.[0] || 'default_gate';
        return (
          <span className="font-mono text-[12px] text-t2 truncate block" title={rule}>
            {rule}
          </span>
        );
      } 
    }
  ];

  if (error) {
    return (
      <div className="p-[20px] max-w-[980px] mx-auto">
        <div className="p-[14px] bg-badb border border-bad/30 text-bad rounded-[8px] text-[13px]">
          Failed to load decisions from gateway proxy. Verify that Docker service is running.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      {/* 1. Page Header: padding 14px 20px 10px */}
      <div className="px-[20px] pt-[14px] pb-[10px] flex flex-col gap-[8px]">
        <div className="flex items-center justify-between gap-[12px]">
          <div className="flex items-baseline gap-[12px]">
            <h1 className="text-[15px] font-semibold text-tx leading-[22px]">
              {isApprovalsMode ? 'Approvals' : 'Audit log'}
            </h1>
            <p className="text-[12.5px] text-t3 leading-[20px] hidden sm:inline">
              Live flight recorder: Real-time authorization checkpoint scoring AI agent tool calls.
            </p>
          </div>

          {/* Right: Live indicator & Refresh button */}
          <div className="flex items-center gap-[10px]">
            <div className="flex items-center gap-[6px] text-[12px] font-medium text-t2">
              <span className="w-[6px] h-[6px] rounded-full bg-ok shadow-[0_0_0_3px_var(--okb)]" />
              <span>Live</span>
            </div>

            <button 
              onClick={() => refetch()} 
              disabled={isRefetching}
              aria-label="Refresh decisions log"
              className="h-[28px] px-[10px] text-[12.5px] font-normal bg-rs border border-l2 rounded-[6px] text-tx hover:bg-hv flex items-center gap-[6px] transition-colors disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-at focus-visible:outline-hidden"
            >
              <RefreshCw size={13} strokeWidth={1.6} aria-hidden="true" className={isRefetching ? 'animate-spin motion-reduce:animate-none' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Verdict counts summary with clear tooltips */}
        <div className="flex items-center gap-[16px] text-[12px] text-t3 font-normal">
          <span className="flex items-center gap-[6px]" title="Safe tool calls permitted autonomously">
            <span className="w-[7px] h-[7px] rounded-full bg-ok" />
            <span className="text-tx font-medium tabular-nums">{stats.allowed}</span>
            <span>allowed (safe)</span>
          </span>
          <span className="flex items-center gap-[6px]" title="Autonomous tool calls permitted with rollback checkpoint snapshots">
            <span className="w-[7px] h-[7px] rounded-[1px] bg-chk" />
            <span className="text-tx font-medium tabular-nums">{stats.checkpoints}</span>
            <span>checkpoints</span>
          </span>
          <span className="flex items-center gap-[6px]" title="High-risk or uncertain actions paused for human approval">
            <span className="w-[7px] h-[7px] rounded-full bg-wn" />
            <span className="text-tx font-medium tabular-nums">{stats.asked}</span>
            <span>asked (pending review)</span>
          </span>
          <span className="flex items-center gap-[6px]" title="Prompt injection or policy violations blocked">
            <span className="w-[7px] h-[7px] rounded-full bg-bad" />
            <span className="text-tx font-medium tabular-nums">{stats.denied}</span>
            <span>denied (blocked)</span>
          </span>
        </div>
      </div>

      {/* 2. Filter Bar: padding 0 20px 12px */}
      <div className="px-[20px] pb-[12px] flex flex-wrap items-center justify-between gap-[10px]">
        <div className="flex items-center gap-[8px] flex-wrap">
          {/* Segmented control: Time Range */}
          <div className="h-[28px] flex rounded-[6px] border border-l2 bg-rs p-[1px] text-[12px]">
            {[
              { id: 'all', label: 'All' },
              { id: '1h', label: '1h' },
              { id: '24h', label: '24h' },
              { id: '7d', label: '7d' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`h-[24px] px-[8px] rounded-[5px] transition-colors leading-none focus-visible:ring-1 focus-visible:ring-at focus-visible:outline-hidden ${
                  timeRange === t.id
                    ? 'bg-sl text-tx font-medium'
                    : 'text-t2 hover:text-tx hover:bg-hv'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Segmented control: Verdict Filter */}
          <div className="h-[28px] flex rounded-[6px] border border-l2 bg-rs p-[1px] text-[12px]">
            {[
              { id: 'all', label: 'All verdicts' },
              { id: 'allow', label: 'Allow' },
              { id: 'allow_with_checkpoint', label: 'Checkpoint' },
              { id: 'ask', label: 'Ask' },
              { id: 'deny', label: 'Deny' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setVerdictFilter(v.id)}
                className={`h-[24px] px-[8px] rounded-[5px] transition-colors leading-none focus-visible:ring-1 focus-visible:ring-at focus-visible:outline-hidden ${
                  verdictFilter === v.id
                    ? 'bg-sl text-tx font-medium'
                    : 'text-t2 hover:text-tx hover:bg-hv'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search input: 28px tall, 220px wide, 1px --l2 */}
        <div className="relative w-[240px]">
          <Search size={13} strokeWidth={1.6} aria-hidden="true" className="absolute left-[8px] top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
          <input 
            type="text" 
            name="search"
            aria-label="Search decisions by tool, session, or rule"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search tool, session, or rule…" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-[28px] bg-bg border border-l2 rounded-[6px] pl-[26px] pr-[8px] text-[12.5px] text-tx placeholder:text-t3 focus-visible:border-at focus-visible:ring-1 focus-visible:ring-at focus-visible:outline-hidden transition-colors"
          />
        </div>
      </div>

      {/* 3. Table: full width, horizontal padding 20px */}
      <div className="px-[20px] pb-[32px]">
        {isLoading ? (
          <div className="h-[200px] border border-ln rounded-[8px] bg-pn flex items-center justify-center text-t3 text-[13px]">
            Loading decisions…
          </div>
        ) : (
          <div className="flex flex-col gap-[12px]">
            <DataTable 
              data={filteredDecisions} 
              columns={columns} 
              onRowClick={(row) => navigate(`/decisions/${row.id}`)} 
            />

            {hasNextPage && (
              <div className="flex justify-center pt-[8px]">
                <button 
                  onClick={() => fetchNextPage()} 
                  disabled={isFetchingNextPage}
                  className="h-[28px] px-[14px] text-[12.5px] font-normal bg-rs border border-l2 rounded-[6px] text-tx hover:bg-hv transition-colors disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-at focus-visible:outline-hidden"
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load older records'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

