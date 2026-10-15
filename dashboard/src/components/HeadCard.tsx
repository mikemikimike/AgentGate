const HEAD_TITLES: Record<string, string> = {
  untrusted_influence: 'Untrusted Influence',
  external_send: 'External Send',
  reversibility: 'Blast Radius / Reversibility',
  goal_alignment: 'Session Goal Alignment'
};

export function HeadCard({ 
  headName, 
  answer, 
  probabilities 
}: { 
  headName: string; 
  answer: string; 
  probabilities?: Record<string, number>;
}) {
  const title = HEAD_TITLES[headName] || headName.replace(/_/g, ' ');
  const prob = (probabilities && probabilities[answer] !== undefined) ? probabilities[answer] : 0.85;
  const percentage = Math.round(prob * 100);
  const activeSegments = Math.round(prob * 20);

  const isHighRisk = (headName === 'untrusted_influence' && answer === 'likely') ||
                     (headName === 'external_send' && answer === 'yes') ||
                     (headName === 'reversibility' && answer === 'irreversible') ||
                     (headName === 'goal_alignment' && answer === 'misaligned');

  const isMediumRisk = (headName === 'untrusted_influence' && answer === 'possible') ||
                       (headName === 'reversibility' && answer === 'costly') ||
                       (headName === 'goal_alignment' && answer === 'tangential');

  const badgeColor = isHighRisk 
    ? 'text-bad bg-bad/10 border-bad/40 shadow-[0_0_8px_var(--badb)]' 
    : isMediumRisk 
    ? 'text-wn bg-wn/10 border-wn/40 shadow-[0_0_8px_var(--wnb)]' 
    : 'text-ok bg-ok/10 border-ok/40 shadow-[0_0_8px_var(--okb)]';

  const segmentActiveColor = isHighRisk 
    ? 'bg-bad shadow-[0_0_4px_var(--bad)]' 
    : isMediumRisk 
    ? 'bg-wn shadow-[0_0_4px_var(--wn)]' 
    : 'bg-ok shadow-[0_0_4px_var(--ok)]';

  return (
    <div className="border border-ln bg-pn/90 rounded-[6px] p-[12px] flex flex-col gap-[10px] shadow-sm relative overflow-hidden backdrop-blur-xs">
      {/* Top row: Expressive Space Grotesk display title + technical head code */}
      <div className="flex items-center justify-between">
        <span className="font-display font-semibold text-[13px] text-tx tracking-tight">{title}</span>
        <span className="font-mono text-[10px] text-t3 uppercase tracking-wider">{headName}</span>
      </div>

      {/* Metric row: Output token plate + confidence percentage */}
      <div className="flex items-center justify-between pt-[2px]">
        <span className={`px-[8px] py-[2px] rounded-[3px] text-[11px] font-mono font-semibold uppercase tracking-wider border ${badgeColor}`}>
          {answer}
        </span>
        <div className="flex items-baseline gap-[3px] font-mono">
          <span className="text-[14px] font-bold text-tx tabular-nums">{percentage}%</span>
          <span className="text-[10px] text-t3">conf</span>
        </div>
      </div>

      {/* 20-segment hardware-style calibration bar */}
      <div className="flex gap-[2px] h-[6px] p-[1px] bg-rs rounded-[2px] border border-ln/80 mt-[2px]">
        {Array.from({ length: 20 }).map((_, idx) => (
          <span 
            key={idx} 
            className={`flex-1 rounded-[1px] transition-all duration-200 ${idx < activeSegments ? segmentActiveColor : 'bg-sl/30'}`}
          />
        ))}
      </div>
    </div>
  );
}
