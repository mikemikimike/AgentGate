import crypto from 'crypto';
import { pool } from '../db';

export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function deterministicStringify(obj: any, seen: WeakSet<object> = new WeakSet()): string {
  if (Array.isArray(obj)) {
    if (seen.has(obj)) return '"[CIRCULAR]"';
    seen.add(obj);
    return `[${obj.map(item => deterministicStringify(item, seen)).join(',')}]`;
  } else if (typeof obj === 'object' && obj !== null) {
    if (seen.has(obj)) return '"[CIRCULAR]"';
    seen.add(obj);
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map(k => `"${k}":${deterministicStringify(obj[k], seen)}`);
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(obj);
}

export function redactArguments(args: any, seen: WeakSet<object> = new WeakSet()): any {
  if (typeof args !== 'object' || args === null) return args;
  if (seen.has(args)) return '[CIRCULAR]';
  seen.add(args);
  
  const sensitiveKeys = ['password', 'token', 'key', 'auth', 'secret', 'credential', 'cert'];

  if (Array.isArray(args)) {
    return args.map(item => redactArguments(item, seen));
  }
  
  const redacted = { ...args };
  
  for (const key in redacted) {
    if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactArguments(redacted[key], seen);
    } else if (typeof redacted[key] === 'string') {
      const val = redacted[key];
      const lowerKey = key.toLowerCase();
      
      const isSensitiveKey = sensitiveKeys.some(sk => lowerKey.includes(sk));
      // Basic heuristic patterns for AWS/GCP/Bearer
      const isSensitivePattern = /(bearer\s+[a-zA-Z0-9-._~+/]+=*)|(AKIA[0-9A-Z]{16})|(AIza[0-9A-Za-z-_]{35})/i.test(val);
      
      if (isSensitiveKey || isSensitivePattern) {
        redacted[key] = '[REDACTED]';
      } else if (val.length > 1000) {
        redacted[key] = val.substring(0, 1000) + '...[TRUNCATED]';
      }
    }
  }
  return redacted;
}

export async function writeDecisionRecord(data: {
  id: string, session_id: string, tool: string, args: any,
  prompt_tokens: number, heads: any, verdict: string, reason_codes: string[],
  policy_version: number, model_version: string,
  model_ms: number, total_ms: number, error?: string
}) {
  const argsRedacted = redactArguments(data.args);
  const argsSha256 = hashString(deterministicStringify(data.args));
  
  if (data.policy_version) {
    await pool.query(`
      INSERT INTO policies (version, yaml, active, created_by)
      VALUES ($1, $2, false, 'auto')
      ON CONFLICT (version) DO NOTHING
    `, [data.policy_version, `version: ${data.policy_version}`]);
  }

  if (data.model_version) {
    await pool.query(`
      INSERT INTO models (version, path, sha256, active) 
      VALUES ($1, $1, 'auto', false) 
      ON CONFLICT (version) DO NOTHING
    `, [data.model_version]);
  }

  await pool.query(`
    INSERT INTO decisions (
      id, session_id, tool, args_redacted, args_sha256, prompt_tokens,
      heads, verdict, reason_codes, policy_version, model_version,
      model_ms, total_ms, error
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
  `, [
    data.id, data.session_id, data.tool, JSON.stringify(argsRedacted), argsSha256,
    data.prompt_tokens, JSON.stringify(data.heads), data.verdict, data.reason_codes,
    data.policy_version, data.model_version, data.model_ms, data.total_ms, data.error || null
  ]);
}
