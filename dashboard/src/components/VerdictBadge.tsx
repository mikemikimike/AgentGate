export function VerdictBadge({ verdict }: { verdict: string }) {
  const v = verdict?.toLowerCase();
  
  if (v === 'allow') {
    return (
      <span className="inline-flex items-center gap-[6px] text-ok text-[12.5px] font-medium whitespace-nowrap">
        <span className="w-[7px] h-[7px] rounded-full bg-ok shrink-0" />
        Allow
      </span>
    );
  }
  
  if (v === 'deny') {
    return (
      <span className="inline-flex items-center gap-[6px] text-bad text-[12.5px] font-medium whitespace-nowrap">
        <span className="w-[7px] h-[7px] rounded-full bg-bad shrink-0" />
        Deny
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-[6px] text-wn text-[12.5px] font-medium whitespace-nowrap">
      <span className="w-[7px] h-[7px] rounded-full bg-wn shrink-0" />
      Ask
    </span>
  );
}

