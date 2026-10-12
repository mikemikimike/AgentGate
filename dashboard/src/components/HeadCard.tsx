const HEAD_TITLES: Record<string, string> = {
  untrusted_influence: 'Untrusted Content Influence',
  external_send: 'External Data Transfer',
  reversibility: 'Blast Radius & Reversibility',
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

  const isHighRisk = (headName === 'untrusted_influence' && answer === 'likely') ||
                     (headName === 'external_send' && answer === 'yes') ||
                     (headName === 'reversibility' && answer === 'irreversible') ||
                     (headName === 'goal_alignment' && answer === 'misaligned');

  const isMediumRisk = (headName === 'untrusted_influence' && answer === 'possible') ||
                       (headName === 'reversibility' && answer === 'costly') ||
                       (headName === 'goal_alignment' && answer === 'tangential');

  const badgeColor = isHighRisk 
    ? 'text-bad bg-bad/10 border-bad/30' 
    : isMediumRisk 
    ? 'text-wn bg-wn/10 border-wn/30' 
    : 'text-ok bg-ok/10 border-ok/30';

  const barColor = isHighRisk ? 'bg-bad' : isMediumRisk ? 'bg-wn' : 'bg-ok/60';

  return (
    <div className="border border-ln bg-bg rounded-6 p-12 flex flex-col gap-8 shadow-xs">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-tx capitalize">{title}</span>
        <span className="font-mono text-[10.5px] text-t3">{headName}</span>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className={`px-6 py-2 rounded text-[11.5px] font-mono font-medium border ${badgeColor}`}>
          {answer}
        </span>
        <span className="font-mono text-[13px] font-semibold text-tx">
          {percentage}%
        </span>
      </div>

      <div className="w-full h-4 bg-sl rounded-full overflow-hidden relative mt-2">
        <div 
          className={`h-full transition-all duration-300 ${barColor}`} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  );
}
