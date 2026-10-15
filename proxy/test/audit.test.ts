import { describe, it, expect } from 'vitest';
import { deterministicStringify, redactArguments } from '../src/audit';

describe('Audit Serializer & Redactor', () => {
  it('handles circular references in deterministicStringify without stack overflow', () => {
    const cyclicObj: any = { a: 1, b: "hello" };
    cyclicObj.self = cyclicObj;

    expect(() => deterministicStringify(cyclicObj)).not.toThrow();
    const result = deterministicStringify(cyclicObj);
    expect(result).toContain('"[CIRCULAR]"');
  });

  it('handles circular references in redactArguments without stack overflow', () => {
    const cyclicArgs: any = { password: "supersecret", nested: {} };
    cyclicArgs.nested.parent = cyclicArgs;

    expect(() => redactArguments(cyclicArgs)).not.toThrow();
    const redacted = redactArguments(cyclicArgs);
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.nested.parent).toBe('[CIRCULAR]');
  });
});
