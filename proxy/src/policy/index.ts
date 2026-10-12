import { z } from 'zod';

export const ConditionSchema = z.object({
  all: z.array(z.any()).optional(),
  any: z.array(z.any()).optional(),
  head: z.string().optional(),
  option: z.string().optional(),
  gt: z.number().optional(),
  lt: z.number().optional()
});

export const RuleSchema = z.object({
  id: z.string(),
  when: ConditionSchema,
  action: z.enum(['allow', 'ask', 'deny']),
  reason: z.string()
});

export const ToolPolicySchema = z.object({
  trust: z.string().optional(),
  rules: z.array(RuleSchema).optional(),
  default: z.enum(['allow', 'ask', 'deny']).optional(),
  on_model_error: z.enum(['allow', 'ask', 'deny']).optional()
});

export const PolicySchema = z.object({
  version: z.number(),
  defaults: z.object({
    on_model_error: z.enum(['allow', 'ask', 'deny']).optional(),
    abstain: z.object({
      heads: z.array(z.string()),
      max_prob_below: z.number()
    }).optional()
  }).optional(),
  tools: z.record(z.string(), ToolPolicySchema)
});

export type Policy = z.infer<typeof PolicySchema>;

export function evaluateCondition(cond: any, heads: any): boolean {
  if (cond.all) {
    return cond.all.every((c: any) => evaluateCondition(c, heads));
  }
  if (cond.any) {
    return cond.any.some((c: any) => evaluateCondition(c, heads));
  }
  if (cond.head && cond.option) {
    if (!heads[cond.head] || !heads[cond.head].probabilities) {
      console.warn(`[WARNING] Missing head in model response: ${cond.head}`);
      return false;
    }
    const prob = heads[cond.head].probabilities[cond.option];
    if (prob === undefined) {
      console.warn(`[WARNING] Missing option '${cond.option}' for head '${cond.head}'`);
      return false;
    }
    
    if (cond.gt !== undefined && prob <= cond.gt) return false;
    if (cond.lt !== undefined && prob >= cond.lt) return false;
    return true;
  }
  return false;
}

export function strictestAction(actions: string[]): string {
  if (actions.includes('deny')) return 'deny';
  if (actions.includes('ask')) return 'ask';
  return 'allow';
}

export function evaluatePolicy(tool: string, heads: any, policy: Policy, actionTruncated: boolean = false): { verdict: string, reason_codes: string[] } {
  const toolConfig = policy.tools[tool] || policy.tools["*"] || {};
  const rules = toolConfig.rules || [];
  
  const matchedRules = rules.filter(r => evaluateCondition(r.when, heads));
  let actions = matchedRules.map(r => r.action);
  actions.push(toolConfig.default || "allow");
  
  const reasons = matchedRules.map(r => r.reason);
  
  if (actionTruncated) {
    actions.push("ask");
    reasons.push("action_truncated");
  }
  
  if (policy.defaults?.abstain) {
    const abstain = policy.defaults.abstain;
    let abstainTriggered = false;
    for (const headName of abstain.heads) {
      if (heads[headName] && heads[headName].probabilities) {
        const probs = Object.values(heads[headName].probabilities) as number[];
        const maxProb = Math.max(...probs);
        if (maxProb < abstain.max_prob_below) {
          abstainTriggered = true;
          break;
        }
      }
    }
    if (abstainTriggered) {
      actions.push("ask");
      reasons.push("abstain_low_confidence");
    }
  }
  
  const verdict = strictestAction(actions);
  return { verdict, reason_codes: reasons };
}
