import * as Dialog from '@radix-ui/react-dialog';
import { 
  X, Shield, Terminal, Layers, BookOpen, CheckSquare, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface HowItWorksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HowItWorksModal({ open, onOpenChange }: HowItWorksModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[760px] max-h-[90vh] bg-pn border border-ln rounded-[8px] z-50 flex flex-col shadow-2xl focus:outline-none overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-20 py-16 border-b border-ln bg-sl/30 shrink-0">
            <div className="flex items-center gap-10">
              <div className="w-28 h-28 rounded-[6px] border border-ac bg-ac/10 flex items-center justify-center text-ac">
                <Shield size={16} />
              </div>
              <div>
                <Dialog.Title className="text-[15px] font-semibold text-tx leading-tight">
                  How AgentGate Works
                </Dialog.Title>
                <p className="text-[12px] text-t3 mt-2 leading-tight">
                  The security checkpoint & authorization firewall for autonomous AI agents
                </p>
              </div>
            </div>
            <Dialog.Close className="text-t3 hover:text-tx focus:outline-none rounded-4 p-4 hover:bg-hv transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-20 space-y-20 text-[12.5px]">
            {/* 1. Core Mental Model: The 3-Step Lifecycle */}
            <div>
              <div className="text-[11px] font-mono text-at uppercase tracking-wider mb-8 font-semibold">
                Core Execution Lifecycle
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="p-12 rounded-[6px] border border-ln bg-bg space-y-6">
                  <div className="flex items-center gap-6 font-semibold text-tx text-[13px]">
                    <span className="w-20 h-20 rounded-full bg-sl flex items-center justify-center text-[10px] text-at font-mono">1</span>
                    <Terminal size={14} className="text-at" />
                    <span>Intercept</span>
                  </div>
                  <p className="text-t2 text-[12px] leading-relaxed">
                    When an AI agent attempts to run a tool (e.g. shell command, file read, or external API call), AgentGate pauses execution and intercepts the request.
                  </p>
                </div>

                <div className="p-12 rounded-[6px] border border-ln bg-bg space-y-6">
                  <div className="flex items-center gap-6 font-semibold text-tx text-[13px]">
                    <span className="w-20 h-20 rounded-full bg-sl flex items-center justify-center text-[10px] text-at font-mono">2</span>
                    <Layers size={14} className="text-wn" />
                    <span>AI Safety Score</span>
                  </div>
                  <p className="text-t2 text-[12px] leading-relaxed">
                    Our calibrated neural model evaluates risk in &lt;40ms across 4 safety heads: prompt injection, data exfiltration, reversibility, and goal drift.
                  </p>
                </div>

                <div className="p-12 rounded-[6px] border border-ln bg-bg space-y-6">
                  <div className="flex items-center gap-6 font-semibold text-tx text-[13px]">
                    <span className="w-20 h-20 rounded-full bg-sl flex items-center justify-center text-[10px] text-at font-mono">3</span>
                    <Shield size={14} className="text-ok" />
                    <span>Enforce Policy</span>
                  </div>
                  <p className="text-t2 text-[12px] leading-relaxed">
                    Your YAML policy rules convert probabilities into a final verdict: Allow (safe), Ask (human sign-off), or Deny (blocked).
                  </p>
                </div>
              </div>
            </div>

            {/* 2. The 3 Verdicts Explained */}
            <div>
              <div className="text-[11px] font-mono text-at uppercase tracking-wider mb-8 font-semibold">
                The 3 Checkpoint Verdicts
              </div>
              <div className="border border-ln rounded-[6px] bg-bg overflow-hidden divide-y divide-ln">
                <div className="p-12 flex items-start gap-12">
                  <span className="px-8 py-2 rounded-[3px] bg-ok/15 text-ok font-mono text-[11px] font-bold shrink-0 mt-2">
                    ALLOW
                  </span>
                  <div>
                    <div className="font-semibold text-tx">Automatic Execution (Green Light)</div>
                    <p className="text-t2 text-[12px] mt-2">
                      The tool is whitelisted or verified safe (e.g., reading a documentation file). The AI agent proceeds immediately without interruption.
                    </p>
                  </div>
                </div>

                <div className="p-12 flex items-start gap-12">
                  <span className="px-8 py-2 rounded-[3px] bg-wn/15 text-wn font-mono text-[11px] font-bold shrink-0 mt-2">
                    ASK
                  </span>
                  <div>
                    <div className="font-semibold text-tx">Human-in-the-Loop Review (Yellow Light)</div>
                    <p className="text-t2 text-[12px] mt-2">
                      The action is high-risk or the model detected uncertainty. The agent pauses, and the request is held in the <strong>Approvals Queue</strong> for you to approve or reject.
                    </p>
                  </div>
                </div>

                <div className="p-12 flex items-start gap-12">
                  <span className="px-8 py-2 rounded-[3px] bg-bad/15 text-bad font-mono text-[11px] font-bold shrink-0 mt-2">
                    DENY
                  </span>
                  <div>
                    <div className="font-semibold text-tx">Immediate Block (Red Light)</div>
                    <p className="text-t2 text-[12px] mt-2">
                      A prompt injection attack or policy violation was detected (e.g. an attacker tricking the agent into transmitting API keys). The action is rejected immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Dashboard Navigation Guide */}
            <div>
              <div className="text-[11px] font-mono text-at uppercase tracking-wider mb-8 font-semibold">
                Your Dashboard Navigation
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
                <div className="p-10 rounded-[6px] border border-ln bg-bg space-y-4">
                  <div className="flex items-center gap-6 font-semibold text-tx text-[12px]">
                    <Activity size={14} className="text-at" />
                    <span>Audit Log</span>
                  </div>
                  <p className="text-t3 text-[11.5px] leading-relaxed">
                    Live flight recorder showing every action requested by your agents with millisecond risk scores.
                  </p>
                </div>

                <div className="p-10 rounded-[6px] border border-ln bg-bg space-y-4">
                  <div className="flex items-center gap-6 font-semibold text-tx text-[12px]">
                    <CheckSquare size={14} className="text-wn" />
                    <span>Approvals</span>
                  </div>
                  <p className="text-t3 text-[11.5px] leading-relaxed">
                    Your inbox for paused actions. Review parameters and click Approve or Deny.
                  </p>
                </div>

                <div className="p-10 rounded-[6px] border border-ln bg-bg space-y-4">
                  <div className="flex items-center gap-6 font-semibold text-tx text-[12px]">
                    <Layers size={14} className="text-ok" />
                    <span>Policy Rules</span>
                  </div>
                  <p className="text-t3 text-[11.5px] leading-relaxed">
                    Customize thresholds, dry-run replay against historical data, and hot-reload rules live.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-20 py-12 border-t border-ln bg-sl/20 flex items-center justify-between shrink-0">
            <Link 
              to="/docs" 
              onClick={() => onOpenChange(false)}
              className="text-[12px] text-at hover:underline flex items-center gap-4"
            >
              <BookOpen size={13} />
              <span>Read Full Documentation</span>
            </Link>

            <button
              onClick={() => onOpenChange(false)}
              className="h-28 px-14 rounded-[4px] bg-ac text-white text-[12px] font-medium hover:brightness-110 transition-all shadow-xs"
            >
              Got it, let's go!
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
