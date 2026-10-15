export function VerdictBadge({ verdict }: { verdict: string }) {
  const v = verdict?.toLowerCase();
  
  if (v === 'allow') {
    return (
      <span 
        className="vd allow"
        role="status"
        aria-label="Verdict: Allow"
      >
        <i aria-hidden="true" />
        <span>Allow</span>
      </span>
    );
  }

  if (v === 'allow_with_checkpoint' || v === 'checkpoint') {
    return (
      <span 
        className="vd checkpoint text-tx"
        role="status"
        aria-label="Verdict: Allow with Checkpoint"
      >
        <i className="bg-t3" aria-hidden="true" />
        <span>Allow</span>
      </span>
    );
  }
  
  if (v === 'deny' || v === 'block') {
    return (
      <span 
        className="vd deny"
        role="status"
        aria-label="Verdict: Block"
      >
        <i aria-hidden="true" />
        <span>Block</span>
      </span>
    );
  }
  
  // 'ask' / 'review'
  return (
    <span 
      className="vd ask"
      role="status"
      aria-label="Verdict: Review"
    >
      <i aria-hidden="true" />
      <span>Review</span>
    </span>
  );
}
