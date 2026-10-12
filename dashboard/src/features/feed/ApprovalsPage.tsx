import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../../lib/api';
import { HeadCard } from '../../components/HeadCard';
import { CheckCircle2 } from 'lucide-react';

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { data: decisions, isLoading } = useQuery({ 
    queryKey: ['decisions', 'pending'], 
    queryFn: async () => {
      const res = await fetcher(`/v1/decisions?status=pending`);
      return res.decisions || [];
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string, action: 'approve' | 'deny' }) => {
      return fetcher(`/v1/approvals/${id}`, {
        method: 'POST',
        body: JSON.stringify({ action, note: note || undefined })
      });
    },
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['decisions'] });
    }
  });

  const pendingList = useMemo(() => decisions || [], [decisions]);
  const selected = pendingList.find((d: any) => d.id === selectedId) || pendingList[0];

  // Keyboard shortcuts: A for Approve, D for Deny, J/K for navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selected || resolveMutation.isPending) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'a' || e.key === 'A') {
        resolveMutation.mutate({ id: selected.approval_id, action: 'approve' });
      } else if (e.key === 'd' || e.key === 'D') {
        resolveMutation.mutate({ id: selected.approval_id, action: 'deny' });
      } else if (e.key === 'j' || e.key === 'J') {
        const curIdx = pendingList.findIndex((d: any) => d.id === selected.id);
        if (curIdx < pendingList.length - 1) setSelectedId(pendingList[curIdx + 1].id);
      } else if (e.key === 'k' || e.key === 'K') {
        const curIdx = pendingList.findIndex((d: any) => d.id === selected.id);
        if (curIdx > 0) setSelectedId(pendingList[curIdx - 1].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, pendingList, resolveMutation]);

  if (isLoading) {
    return <div className="p-[36px] text-center text-t3 text-[13px]">Loading pending queue...</div>;
  }

  if (pendingList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-[48px] text-center gap-[12px] select-none">
        <div className="w-[44px] h-[44px] rounded-full bg-okb border border-ok/20 flex items-center justify-center text-ok">
          <CheckCircle2 size={20} strokeWidth={1.6} />
        </div>
        <div className="flex flex-col gap-[4px]">
          <h2 className="text-[15px] font-semibold text-tx">All clear</h2>
          <p className="text-[12.5px] text-t3 max-w-[340px]">
            No agent actions are awaiting manual intervention. All calls resolved under active policy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* 1. Queue Strip: padding 10px 28px, bottom hairline */}
      <div className="px-[28px] py-[10px] border-b border-ln bg-pn flex items-center justify-between gap-[16px] shrink-0 select-none min-w-0">
        <div 
          className="flex items-center gap-[8px] overflow-x-auto min-w-0 flex-1 no-scrollbar py-[2px]"
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          {pendingList.map((d: any) => {
            const isSelected = selected?.id === d.id;
            return (
              <button 
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`h-[30px] px-[12px] rounded-[15px] border flex items-center gap-[7px] font-mono text-[12px] whitespace-nowrap shrink-0 transition-colors ${
                  isSelected 
                    ? 'bg-sl border-l2 text-tx font-medium' 
                    : 'bg-pn border-ln text-t3 hover:text-tx hover:border-l2'
                }`}
              >
                <span className="w-[6px] h-[6px] rounded-full bg-wn shrink-0" />
                <span>{d.tool}</span>
                <span className="text-[11px] text-wn tabular-nums">120s</span>
              </button>
            );
          })}
        </div>

        <div className="text-[12px] text-t3 shrink-0 whitespace-nowrap">
          <span className="text-tx font-medium tabular-nums">{pendingList.length}</span> pending
        </div>
      </div>

      {/* 2. One Centered Review Card: max-width: 760px, padding 18px 28px 80px */}
      <div className="flex-1 overflow-y-auto px-[28px] pt-[18px] pb-[80px]">
        {selected && (
          <div className="max-w-[760px] mx-auto flex flex-col gap-[16px]">
            {/* Meta Line */}
            <div className="flex items-center gap-[8px] font-mono text-[12px] text-t3">
              <span>{selected.id}</span>
              <span>·</span>
              <span>{new Date(selected.created_at).toLocaleTimeString()}</span>
              <span>·</span>
              <span>session {selected.session_id ? selected.session_id.slice(0, 8) : '—'}</span>
            </div>

            {/* Heading */}
            <div className="flex flex-col gap-[4px]">
              <h1 className="text-[20px] font-semibold text-tx leading-[28px] tracking-[-0.01em]">
                Approve <code className="font-mono text-at font-medium">{selected.tool}</code>?
              </h1>
              <p className="text-[13px] text-t2 leading-[20px]">
                Top answer probability was below automated allow threshold. Requires operator confirmation.
              </p>
            </div>

            {/* Block: Proposed Action */}
            <div className="border border-ln rounded-[8px] bg-pn overflow-hidden">
              <div className="h-[36px] px-[14px] border-b border-ln flex items-center text-[12px] text-t3">
                Proposed action
              </div>
              <div className="p-[14px]">
                <pre className="bg-bg border border-ln rounded-[6px] p-[10px] font-mono text-[12px] text-t2 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  <strong className="text-tx font-medium">{selected.tool}</strong>(
                  {JSON.stringify(selected.args_redacted || {}, null, 2)}
                  )
                </pre>
              </div>
            </div>

            {/* Block: Signals */}
            <div className="border border-ln rounded-[8px] bg-pn overflow-hidden">
              <div className="h-[36px] px-[14px] border-b border-ln flex items-center text-[12px] text-t3">
                Signals
              </div>
              <div className="p-[14px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
                  {selected.heads && Object.entries(selected.heads).slice(0, 2).map(([headName, data]: [string, any]) => (
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
          </div>
        )}
      </div>

      {/* 3. Fixed Action Bar at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-pn border-t border-ln h-[48px] px-[28px] flex items-center z-20">
        <div className="max-w-[760px] w-full mx-auto flex items-center justify-between gap-[14px]">
          {/* Note Input */}
          <input 
            type="text" 
            placeholder="Reason or note (optional)" 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 h-[28px] bg-bg border border-l2 rounded-[6px] px-[10px] text-[12.5px] text-tx placeholder:text-t3 focus:border-ac transition-colors"
          />

          <div className="flex items-center gap-[8px] shrink-0">
            {/* Deny Button (Danger) */}
            <button 
              onClick={() => resolveMutation.mutate({ id: selected.approval_id, action: 'deny' })}
              disabled={resolveMutation.isPending}
              className="h-[28px] px-[10px] text-[12.5px] font-medium border border-bad/40 text-bad bg-transparent rounded-[6px] hover:bg-badb transition-colors flex items-center gap-[6px] disabled:opacity-50"
            >
              <span>Deny</span>
              <kbd className="px-[4px] py-[1px] bg-bg border border-l2 rounded font-mono text-[10px] text-bad">D</kbd>
            </button>

            {/* Approve Button (Primary) */}
            <button 
              onClick={() => resolveMutation.mutate({ id: selected.approval_id, action: 'approve' })}
              disabled={resolveMutation.isPending}
              className="h-[28px] px-[12px] text-[12.5px] font-medium bg-ac border border-ac text-white rounded-[6px] hover:brightness-110 transition-all flex items-center gap-[6px] disabled:opacity-50 shadow-xs"
            >
              <span>Approve</span>
              <kbd className="px-[4px] py-[1px] bg-black/20 border border-white/20 rounded font-mono text-[10px] text-white">A</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

