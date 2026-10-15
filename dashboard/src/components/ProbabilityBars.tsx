export function ProbabilityBars({ 
  options, 
  probabilities, 
  chosen 
}: { 
  options: string[]; 
  probabilities: Record<string, number>; 
  chosen: string; 
}) {
  const orderList = ['none', 'possible', 'likely', 'aligned', 'tangential', 'misaligned', 'reversible', 'costly', 'irreversible', 'no', 'yes'];
  const sortedOptions = [...options].sort((a, b) => {
    const iA = orderList.indexOf(a);
    const iB = orderList.indexOf(b);
    if (iA !== -1 && iB !== -1) return iA - iB;
    return a.localeCompare(b);
  });

  return (
    <div className="flex flex-col gap-[10px] w-full mt-[12px] font-mono">
      {sortedOptions.map(opt => {
        const prob = probabilities[opt] || 0;
        const isChosen = opt === chosen;
        const activeSegments = Math.round(prob * 20); // 20 discrete segments
        const percentage = Math.round(prob * 100);

        return (
          <div key={opt} className="flex items-center gap-[10px] text-[12px]">
            {/* Option label */}
            <div className={`w-[85px] text-right truncate font-mono text-[11.5px] ${isChosen ? 'font-semibold text-tx' : 'text-t3'}`}>
              {opt}
            </div>

            {/* Segmented 20-cell LED calibration track */}
            <div className="flex-1 flex gap-[2px] h-[8px] p-[1px] bg-rs rounded-[2px] border border-ln">
              {Array.from({ length: 20 }).map((_, idx) => {
                const isActive = idx < activeSegments;
                let activeColor = 'bg-t2';
                if (isChosen) {
                  activeColor = prob > 0.75 
                    ? 'bg-ok shadow-[0_0_4px_var(--ok)]' 
                    : prob > 0.45 
                    ? 'bg-wn shadow-[0_0_4px_var(--wn)]' 
                    : 'bg-bad shadow-[0_0_4px_var(--bad)]';
                }
                return (
                  <span 
                    key={idx} 
                    className={`flex-1 rounded-[1px] transition-all duration-150 ${isActive ? activeColor : 'bg-sl/40'}`}
                  />
                );
              })}
            </div>

            {/* Readout */}
            <div className={`w-[45px] text-right text-[11px] font-mono tabular-nums ${isChosen ? 'font-semibold text-tx' : 'text-t3'}`}>
              {percentage}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
