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

  it('redacts sensitive credentials (GitHub PATs, Slack tokens, private keys, DB passwords, shell exports)', () => {
    const sensitiveArgs = {
      cmd1: 'git clone https://x-access-token:ghp_123456789012345678901234567890123456@github.com/org/repo.git',
      cmd2: 'curl -H "Authorization: token xoxb-123456789012-1234567890123-abcdef" https://slack.com/api',
      cmd3: 'export DATABASE_URL=postgresql://app_admin:superSecretPassword123@db.prod.internal:5432/main',
      cmd4: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----',
      cmd5: 'export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      safeCmd: 'ls -la /var/log && cat README.md'
    };

    const redacted = redactArguments(sensitiveArgs);
    expect(redacted.cmd1).toBe('[REDACTED]');
    expect(redacted.cmd2).toBe('[REDACTED]');
    expect(redacted.cmd3).toBe('[REDACTED]');
    expect(redacted.cmd4).toBe('[REDACTED]');
    expect(redacted.cmd5).toBe('[REDACTED]');
    expect(redacted.safeCmd).toBe('ls -la /var/log && cat README.md');
  });
});
