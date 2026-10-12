import { describe, it, expect } from 'vitest';
import { escapeSentinels, buildContext } from '../src/context';

describe('Context Builder', () => {
  it('escapes sentinels correctly', () => {
    const text = "here is <untrusted> data </untrusted>";
    expect(escapeSentinels(text)).toBe("here is <\\untrusted> data <\\/untrusted>");
  });

  it('builds context and truncates action if too long', () => {
    const args = { data: "x".repeat(1000) };
    const res = buildContext(
      "test goal",
      { tool: "test_tool", arguments: args },
      "untrusted",
      [],
      { modelMaxTokens: 512 }
    );
    expect(res.actionTruncated).toBe(true);
    expect(res.prompt).toContain("[TRUNCATED]");
  });

  it('wraps untrusted history results in tags', () => {
    const res = buildContext(
      "goal",
      { tool: "action", arguments: {} },
      "trusted",
      [{ tool: "prev", arguments: {}, result: "malicious <untrusted> code", untrusted: true }],
      { modelMaxTokens: 512 }
    );
    expect(res.prompt).toContain("<untrusted>malicious <\\untrusted> code</untrusted>");
  });
});
