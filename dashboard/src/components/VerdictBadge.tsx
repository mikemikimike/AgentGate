export function VerdictBadge({ verdict }: { verdict: string }) {
  const v = verdict?.toLowerCase();
  
  if (v === 'allow') {
    return (
      <span 
        className="inline-flex items-center gap-[6px] px-[8px] py-[2px] rounded-[4px] border border-ok/30 bg-ok/10 text-ok text-[11.5px] font-mono font-medium uppercase tracking-wider whitespace-nowrap shadow-2xs"
        role="status"
        aria-label="Verdict: Allow"
      >
        <span className="w-[6px] h-[6px] rounded-full bg-ok shadow-[0_0_6px_var(--ok)] shrink-0 animate-pulse motion-reduce:animate-none" />
        Allow
      </span>
    );
  }

  if (v === 'allow_with_checkpoint') {
    return (
      <span 
        className="inline-flex items-center gap-[6px] px-[8px] py-[2px] rounded-[4px] border border-chk/40 bg-chkb text-chk text-[11.5px] font-mono font-medium uppercase tracking-wider whitespace-nowrap shadow-2xs"
        role="status"
        aria-label="Verdict: Allow with Checkpoint"
      >
        <span className="w-[6px] h-[6px] rounded-[1px] bg-chk shadow-[0_0_6px_var(--chk)] shrink-0" />
        Allow + Checkpoint
      </span>
    );
  }
  
  if (v === 'deny') {
    return (
      <span 
        className="inline-flex items-center gap-[6px] px-[8px] py-[2px] rounded-[4px] border border-bad/30 bg-bad/10 text-bad text-[11.5px] font-mono font-medium uppercase tracking-wider whitespace-nowrap shadow-2xs"
        role="status"
        aria-label="Verdict: Deny"
      >
        <span className="w-[6px] h-[6px] rounded-full bg-bad shadow-[0_0_6px_var(--bad)] shrink-0" />
        Deny
      </span>
    );
  }
  
  return (
    <span 
      className="inline-flex items-center gap-[6px] px-[8px] py-[2px] rounded-[4px] border border-wn/35 bg-wn/10 text-wn text-[11.5px] font-mono font-medium uppercase tracking-wider whitespace-nowrap shadow-2xs"
      role="status"
      aria-label="Verdict: Ask"
    >
      <span className="w-[6px] h-[6px] rounded-full bg-wn shadow-[0_0_6px_var(--wn)] shrink-0 animate-ping duration-1000 motion-reduce:animate-none" />
      Ask
    </span>
  );
}

