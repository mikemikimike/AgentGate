export function ProbabilityBars({ options, probabilities, chosen }: { options: string[], probabilities: Record<string, number>, chosen: string }) {
  // Sort options to prevent random ordering
  // E.g. 'none' < 'possible' < 'likely', 'yes' < 'no'
  // A simple alphabetical sort might not always be perfectly semantic, but is deterministic
  // For 'none', 'possible', 'likely', we can hardcode the semantic order
  const orderList = ['none', 'possible', 'likely', 'aligned', 'tangential', 'misaligned', 'reversible', 'costly', 'irreversible', 'no', 'yes'];
  const sortedOptions = [...options].sort((a, b) => {
    const iA = orderList.indexOf(a);
    const iB = orderList.indexOf(b);
    if (iA !== -1 && iB !== -1) return iA - iB;
    return a.localeCompare(b);
  });

  return (
    <div className="flex flex-col gap-8 w-full mt-12">
      {sortedOptions.map(opt => {
        const prob = probabilities[opt] || 0;
        const isChosen = opt === chosen;
        const width = `${Math.round(prob * 100)}%`;
        return (
          <div key={opt} className="flex items-center gap-12 text-[13px]">
            <div className={`w-[80px] text-right truncate ${isChosen ? 'font-semibold text-text' : 'text-text-muted'}`}>
              {opt}
            </div>
            <div className="flex-1 h-[8px] bg-surface-2 rounded-pill overflow-hidden relative">
              <div 
                className={`absolute left-0 top-0 bottom-0 ${isChosen ? 'bg-info' : 'bg-border'}`} 
                style={{ width }} 
              />
            </div>
            <div className="w-[40px] font-mono tabular-nums text-text-muted text-right">
              {prob.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
