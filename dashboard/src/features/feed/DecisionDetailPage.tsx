import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetcher } from '../../lib/api';
import { VerdictBadge } from '../../components/VerdictBadge';
import { HeadCard } from '../../components/HeadCard';
import { ArrowLeft } from 'lucide-react';

export function DecisionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: decision, isLoading, error, refetch } = useQuery({
    queryKey: ['decision', id],
    queryFn: async () => {
      return fetcher(`/v1/decisions/${id}`);
    },
    retry: 2,
    refetchOnWindowFocus: true
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="p-[36px] text-center text-t3 text-[13px]">
        Loading decision audit record...
      </div>
    );
  }

  if (error || !decision) {
    const errorMsg = error instanceof Error ? error.message : '';
    const isNotFound = errorMsg.includes('404') || errorMsg.includes('not found') || (!error && !decision);

    return (
      <div className="max-w-[980px] mx-auto px-[28px] py-[24px] flex flex-col gap-[16px]">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-[6px] text-t2 hover:text-tx text-[12.5px] w-fit"
        >
          <ArrowLeft size={13} strokeWidth={1.6} /> 
          <span>Audit log</span>
        </button>
        <div className="p-[14px] bg-badb border border-bad/30 text-bad rounded-[8px] text-[13px] flex items-center justify-between gap-[16px]">
          <div>
            {isNotFound ? (
              <span>Decision record <span className="font-mono">{id}</span> was not found.</span>
            ) : (
              <span>Failed to load decision <span className="font-mono">{id}</span>: {errorMsg || 'Connection failed'}</span>
            )}
          </div>
          <button
            onClick={() => refetch()}
            className="px-[12px] py-[5px] bg-rs border border-l2 rounded-[6px] text-tx text-[12px] hover:bg-hv transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const ruleName = decision.reason_codes?.[0];

  return (
    <div className="max-w-[980px] mx-auto px-[28px] pt-[18px] pb-[48px] flex flex-col gap-[16px]">
      {/* 1. Toolbar row: ghost back button, navigation hint */}
      <div className="flex items-center justify-between pb-[10px] border-b border-ln">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-[6px] text-[12.5px] font-normal text-t2 hover:text-tx transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.6} />
          <span>Decisions</span>
        </button>

        <div className="flex items-center gap-[8px] text-[11.5px] text-t3 font-mono">
          <span>Esc back</span>
        </div>
      </div>

      {/* 2. Meta line: id · time · session in mono, muted */}
      <div className="flex items-center gap-[8px] font-mono text-[12px] text-t3">
        <span>{decision.id}</span>
        <span>·</span>
        <span>{new Date(decision.created_at).toLocaleString()}</span>
        <span>·</span>
        <span>session {decision.session_id ? decision.session_id.slice(0, 8) : '—'}</span>
      </div>

      {/* 3. Heading: tool name (mono) and the verdict */}
      <div className="flex items-center gap-[12px]">
        <h1 className="text-[20px] font-semibold text-tx leading-[28px] font-mono tracking-[-0.01em]">
          {decision.tool}
        </h1>
        <VerdictBadge verdict={decision.verdict} />
      </div>

      {/* 4. Block: "Why this verdict" */}
      <div className="border border-ln rounded-[8px] bg-pn overflow-hidden">
        <div className="min-h-[36px] px-[14px] py-[9px] border-b border-ln flex items-center text-[12px] text-t3">
          Why this verdict
        </div>
        <div className="p-[14px] flex flex-col gap-[10px] text-[13px] leading-[20px]">
          {ruleName ? (
            <>
              <p className="text-tx">
                Rule <code className="font-mono text-at font-medium bg-rs px-[6px] py-[2px] rounded-[4px] border border-ln">{ruleName}</code> matched, and the strictest action wins.
              </p>
              <div className="bg-bg border border-ln rounded-[6px] p-[10px] font-mono text-[12px] text-t2">
                <div>condition: {ruleName}</div>
                <div>verdict: {decision.verdict}</div>
              </div>
            </>
          ) : (
            <p className="text-tx">
              No specific deny rule triggered. The top probability was evaluated under baseline safety policies.
            </p>
          )}
        </div>
      </div>

      {/* 5. Block: "Action" */}
      <div className="border border-ln rounded-[8px] bg-pn overflow-hidden">
        <div className="min-h-[36px] px-[14px] py-[9px] border-b border-ln flex items-center justify-between text-[12px] text-t3">
          <span>Action</span>
          {decision.args_sha256 && (
            <span className="font-mono text-[11px]">sha256: {decision.args_sha256.slice(0, 12)}...</span>
          )}
        </div>
        <div className="p-[14px] flex flex-col gap-[12px]">
          <pre className="bg-bg border border-ln rounded-[6px] p-[10px] font-mono text-[12px] text-t2 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            <strong className="text-tx font-medium">{decision.tool}</strong>(
            {JSON.stringify(decision.args_redacted || {}, null, 2)}
            )
          </pre>
        </div>
      </div>

      {/* 6. Block: "Signals" (four head cards in a 2x2 grid) */}
      <div className="border border-ln rounded-[8px] bg-pn overflow-hidden">
        <div className="min-h-[36px] px-[14px] py-[9px] border-b border-ln flex items-center justify-between text-[12px] text-t3">
          <span>Signals</span>
          <span className="text-[11.5px] font-mono">4 calibrated heads</span>
        </div>
        <div className="p-[14px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
            {decision.heads && Object.entries(decision.heads).map(([headName, data]: [string, any]) => (
              <HeadCard 
                key={headName}
                headName={headName}
                answer={data.answer}
                probabilities={data.probabilities}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 7. Footer row */}
      <div className="flex items-center justify-between pt-[8px] text-[12px] text-t3 font-mono">
        <div className="flex items-center gap-[10px]">
          <button 
            onClick={() => navigate('/')}
            className="h-[28px] px-[10px] bg-rs border border-l2 rounded-[6px] text-tx text-[12.5px] font-normal hover:bg-hv transition-colors"
          >
            Back to audit log
          </button>
        </div>

        <div>
          policy v{decision.policy_version || 1} · {decision.model_version || 'agentgate-stub'} · {decision.total_ms || 45}ms
        </div>
      </div>
    </div>
  );
}

