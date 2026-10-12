import { describe, it, expect } from 'vitest';
import { evaluatePolicy, evaluateCondition, strictestAction } from '../src/policy';

describe('Policy Engine', () => {
  it('strictestAction returns strictest', () => {
    expect(strictestAction(['allow', 'ask'])).toBe('ask');
    expect(strictestAction(['allow', 'deny'])).toBe('deny');
  });

  it('evaluates conditions correctly', () => {
    const heads = {
      untrusted_influence: { probabilities: { likely: 0.8 } }
    };
    
    expect(evaluateCondition({ head: 'untrusted_influence', option: 'likely', gt: 0.5 }, heads)).toBe(true);
    expect(evaluateCondition({ head: 'untrusted_influence', option: 'likely', gt: 0.9 }, heads)).toBe(false);
  });

  it('evaluates full policy with abstain', () => {
    const policy = {
      version: 1,
      defaults: {
        abstain: { heads: ['h1'], max_prob_below: 0.5 }
      },
      tools: {
        "test": {
          rules: [
            { id: "1", when: { head: "h2", option: "yes", gt: 0.8 }, action: "deny", reason: "h2_high" }
          ]
        }
      }
    };
    
    const heads = {
      h1: { probabilities: { a: 0.4, b: 0.4 } }, // max is 0.4 < 0.5
      h2: { probabilities: { yes: 0.2 } }
    };
    
    // Abstain should trigger 'ask'
    // h2 rule should not trigger
    const res = evaluatePolicy("test", heads, policy as any);
    expect(res.verdict).toBe('ask');
    expect(res.reason_codes).toContain('abstain_low_confidence');
    
    const heads2 = {
      h1: { probabilities: { a: 0.8 } }, // max 0.8 > 0.5
      h2: { probabilities: { yes: 0.9 } }
    };
    
    // h2 rule triggers 'deny'
    const res2 = evaluatePolicy("test", heads2, policy as any);
    expect(res2.verdict).toBe('deny');
    expect(res2.reason_codes).toContain('h2_high');
  });
});
