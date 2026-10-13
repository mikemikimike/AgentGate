import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import fs from 'fs';
import yaml from 'yaml';
import { pool } from '../db';
import { DecisionClient } from '../decision/client';
import { buildContext } from '../context';
import { evaluatePolicy, PolicySchema, resolveToolConfig } from '../policy';
import { writeDecisionRecord, redactArguments } from '../audit';
import axios from 'axios';

import { FastifySSEPlugin } from 'fastify-sse-v2';
import { EventEmitter } from 'events';
import { generateId } from '../utils/id';
import { z } from 'zod';

const streamEmitter = new EventEmitter();

const AssessRequestSchema = z.object({
  session_id: z.string(),
  action: z.object({
    tool: z.string(),
    arguments: z.any()
  }),
  history_override: z.array(z.any()).optional()
});

const SessionRequestSchema = z.object({
  agent_id: z.string(),
  goal: z.string()
});

const decisionUrl = process.env.AG_DECISION_URL || 'http://decision:9000';
const decisionDeadline = parseInt(process.env.AG_DECISION_DEADLINE_MS || '500');
const decisionClient = new DecisionClient({ url: decisionUrl, deadlineMs: decisionDeadline });
function resolvePolicyPath(): string {
  if (process.env.AG_POLICY_PATH && fs.existsSync(process.env.AG_POLICY_PATH)) {
    return process.env.AG_POLICY_PATH;
  }
  const candidates = [
    '/app/policy.yaml',
    'policy.yaml',
    './proxy/policy.yaml',
    '/config/policy.yaml'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'policy.yaml';
}

const policyPath = resolvePolicyPath();

let cachedPolicy: any = null;
let cachedPolicyYaml: string = '';
let lastPolicyFetch = 0;

async function getActivePolicy() {
  const now = Date.now();
  if (cachedPolicy && now - lastPolicyFetch < 5000) {
    return cachedPolicy;
  }

  try {
    const res = await pool.query('SELECT yaml FROM policies WHERE active = true ORDER BY version DESC LIMIT 1');
    if (res.rows.length > 0) {
      const parsed = PolicySchema.safeParse(yaml.parse(res.rows[0].yaml));
      if (parsed.success && parsed.data.tools && Object.keys(parsed.data.tools).length > 0) {
        cachedPolicyYaml = res.rows[0].yaml;
        cachedPolicy = parsed.data;
        lastPolicyFetch = now;
        return cachedPolicy;
      } else {
        console.warn('Active policy in DB is empty or invalid schema, falling back to disk policy.');
      }
    }
  } catch (e) {
    console.error('Failed to fetch active policy from DB:', e);
  }

  // Fallback to disk or default if DB is empty/failing
  if (!cachedPolicy) {
    try {
      if (fs.existsSync(policyPath)) {
        const file = fs.readFileSync(policyPath, 'utf8');
        cachedPolicyYaml = file;
        cachedPolicy = PolicySchema.parse(yaml.parse(file));
        // Auto-seed into DB so foreign key constraint is satisfied
        await pool.query(`
          INSERT INTO policies (version, yaml, active, created_by)
          VALUES ($1, $2, true, 'system-init')
          ON CONFLICT (version) DO UPDATE SET yaml = EXCLUDED.yaml, active = true
        `, [cachedPolicy.version, cachedPolicyYaml]).catch(err => console.error('Failed to auto-seed policy into DB:', err));
      } else {
        cachedPolicyYaml = 'version: 1\ntools:\n  "*":\n    default: ask\n';
        cachedPolicy = { version: 1, tools: { "*": { default: "ask" } } };
      }
      lastPolicyFetch = now;
    } catch (e) {
      console.error('Failed to load fallback policy:', e);
      cachedPolicyYaml = 'version: 1\ntools:\n  "*":\n    default: ask\n';
      return { version: 1, tools: { "*": { default: "ask" } } };
    }
  }

  return cachedPolicy;
}

let cachedModelConfig: any = null;
let lastModelFetch = 0;

async function getModelConfig() {
  const now = Date.now();
  if (cachedModelConfig && now - lastModelFetch < 5000) {
    return cachedModelConfig;
  }
  try {
    const res = await axios.get(`${decisionUrl}/model`);
    cachedModelConfig = res.data;
    lastModelFetch = now;
  } catch (e) {
    console.error('Failed to fetch model config:', e);
  }
  return cachedModelConfig;
}

export default async function routes(fastify: FastifyInstance) {
  fastify.register(FastifySSEPlugin);

  // Setup Postgres LISTEN for distributed SSE routing
  const setupPgListener = async () => {
    try {
      const client = await pool.connect();
      await client.query('LISTEN agentgate_events');
      client.on('notification', (msg) => {
        if (msg.payload) {
          try {
            const payload = JSON.parse(msg.payload);
            streamEmitter.emit(payload.type, payload.data);
          } catch (e) {
            console.error('Invalid PG notification payload:', e);
          }
        }
      });
      client.on('error', (err) => {
        console.error('PG listener error:', err);
        client.release();
        setTimeout(setupPgListener, 5000); // Reconnect
      });
    } catch (e) {
      console.error('Failed to setup PG listener:', e);
      setTimeout(setupPgListener, 5000);
    }
  };
  setupPgListener();

  fastify.post('/v1/sessions', async (request, reply) => {
    let payload;
    try {
      payload = SessionRequestSchema.parse(request.body);
    } catch (e: any) {
      return reply.status(400).send({ error: 'Invalid payload', details: e.errors });
    }
    const { agent_id, goal } = payload;
    const id = generateId('s');
    await pool.query('INSERT INTO sessions (id, agent_id, goal) VALUES ($1, $2, $3)', [id, agent_id, goal]);
    return { session_id: id };
  });

  fastify.post('/v1/assess', async (request, reply) => {
    const start_time = Date.now();
    let payload;
    try {
      payload = AssessRequestSchema.parse(request.body);
    } catch (e: any) {
      return reply.status(400).send({ error: 'Invalid payload', details: e.errors });
    }
    const { session_id, action, history_override } = payload;
    const id = generateId('d');

    const sessionRes = await pool.query('SELECT goal FROM sessions WHERE id = $1', [session_id]);
    if (sessionRes.rows.length === 0) {
      return reply.status(404).send({ error: { code: 'not_found', message: 'Session not found' } });
    }
    const goal = sessionRes.rows[0].goal;
    const history = history_override || []; // normally loaded from db

    const mConfig = await getModelConfig();
    const maxTokens = mConfig?.max_tokens || 512;
    const activePolicy = await getActivePolicy();

    const toolPolicy = resolveToolConfig(action.tool, activePolicy);
    const sendRawToModel = toolPolicy.send_raw_to_model === true;
    
    // For prompt generation, pass raw arguments if configured, otherwise redact
    const actionForPrompt = {
      tool: action.tool,
      arguments: sendRawToModel ? action.arguments : redactArguments(action.arguments)
    };

    const { prompt, actionTruncated, promptTokens } = buildContext(goal, actionForPrompt, 'trusted', history, { modelMaxTokens: maxTokens });

    const questions = ['untrusted_influence', 'goal_alignment', 'reversibility', 'external_send'];
    let answers = {};
    let model_version = 'unknown';
    let model_ms = 0;
    let modelError: string | undefined;

    try {
      const res = await decisionClient.decide(prompt, questions);
      answers = res.answers;
      model_version = res.model_version;
      model_ms = res.latency_ms;
    } catch (e: any) {
      modelError = e.message;
      model_ms = Date.now() - start_time;
    }

    let verdict = 'ask';
    let reason_codes: string[] = [];
    if (modelError) {
      const defaultErrorAction = toolPolicy.on_model_error || activePolicy.defaults?.on_model_error || 'ask';
      verdict = defaultErrorAction;
      reason_codes = ['model_error'];
    } else {
      const polRes = evaluatePolicy(action.tool, answers, activePolicy, actionTruncated);
      verdict = polRes.verdict;
      reason_codes = polRes.reason_codes;
    }

    const total_ms = Date.now() - start_time;

    await writeDecisionRecord({
      id, session_id, tool: action.tool, args: action.arguments,
      prompt_tokens: promptTokens, heads: answers, verdict, reason_codes,
      policy_version: activePolicy.version, model_version,
      model_ms, total_ms, error: modelError
    });
    
    if (verdict === 'ask') {
      const approval_id = generateId('a');
      await pool.query('INSERT INTO approvals (id, decision_id, status) VALUES ($1, $2, $3)', [approval_id, id, 'pending']);
    }

    // Emit live event via PG NOTIFY
    await pool.query('SELECT pg_notify($1, $2)', ['agentgate_events', JSON.stringify({ type: 'decision.created', data: { decision_id: id } })]);

    return {
      decision_id: id,
      verdict,
      reason_codes,
      heads: answers,
      policy_version: activePolicy.version,
      model_version,
      latency_ms: { model: model_ms, total: total_ms }
    };
  });

  // Dashboard Authentication Middleware
  const requireDashboardAuth = async (request: any, reply: any) => {
    const authHeader = request.headers.authorization;
    const queryToken = (request.query as any)?.token;
    const expectedKey = process.env.AG_DASHBOARD_KEY || 'dev-key-123';
    if (authHeader !== `Bearer ${expectedKey}` && queryToken !== expectedKey) {
      return reply.status(401).send({ error: 'Unauthorized: Invalid Dashboard API Key' });
    }
  };

  fastify.get('/v1/decisions/stream', { preHandler: requireDashboardAuth }, (request, reply) => {
    reply.sse((async function* () {
      let isClosed = false;
      const queue: any[] = [];
      const onDecisionCreated = (d: any) => queue.push({ type: 'decision.created', data: d });
      const onApprovalResolved = (d: any) => queue.push({ type: 'approval.resolved', data: d });
      streamEmitter.on('decision.created', onDecisionCreated);
      streamEmitter.on('approval.resolved', onApprovalResolved);

      request.raw.on('close', () => {
        isClosed = true;
        streamEmitter.off('decision.created', onDecisionCreated);
        streamEmitter.off('approval.resolved', onApprovalResolved);
      });

      // Send initial heartbeat
      yield { event: 'heartbeat', data: 'ok' };

      while (!isClosed) {
        if (queue.length > 0) {
          const item = queue.shift();
          yield { event: item.type, data: JSON.stringify(item.data) };
        } else {
          await new Promise(r => setTimeout(r, 500)); // sleep
        }
      }
    })());
  });

  fastify.get('/v1/decisions', { preHandler: requireDashboardAuth }, async (request, reply) => {
    const { limit = 100, cursor, status } = request.query as any;
    const l = Math.min(parseInt(limit), 100);
    
    let query = 'SELECT d.* FROM decisions d';
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (status) {
      // One bow, multiple shots: reuse this endpoint for the approvals queue
      query = `
        SELECT d.*, a.id as approval_id, a.status as approval_status 
        FROM decisions d 
        JOIN approvals a ON d.id = a.decision_id 
      `;
      conditions.push(`a.status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (cursor) {
      conditions.push(`d.created_at < $${params.length + 1}`);
      params.push(new Date(cursor).toISOString());
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1}`;
    params.push(l);
    
    const res = await pool.query(query, params);
    
    let nextCursor = null;
    if (res.rows.length === l) {
      nextCursor = res.rows[res.rows.length - 1].created_at;
    }
    
    return { decisions: res.rows, limit: l, cursor: nextCursor };
  });

  fastify.get('/v1/decisions/:id', { preHandler: requireDashboardAuth }, async (request, reply) => {
    const { id } = request.params as any;
    const res = await pool.query(`
      SELECT d.*, a.id as approval_id, a.status as approval_status 
      FROM decisions d 
      LEFT JOIN approvals a ON d.id = a.decision_id 
      WHERE d.id = $1
    `, [id]);
    
    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Decision not found' });
    }
    return res.rows[0];
  });

  fastify.get('/v1/policy', async (request, reply) => {
    const policy = await getActivePolicy();
    return {
      version: policy.version,
      yaml: cachedPolicyYaml,
      ...policy
    };
  });

  fastify.post('/v1/policy/replay', { preHandler: requireDashboardAuth }, async (request, reply) => {
    const { yaml: draftYaml } = request.body as any;
    let draftPolicy;
    try {
      draftPolicy = PolicySchema.parse(yaml.parse(draftYaml));
    } catch (e: any) {
      return reply.status(400).send({ error: 'Invalid policy YAML', details: e.errors || e.message });
    }

    const res = await pool.query('SELECT * FROM decisions ORDER BY created_at DESC LIMIT 100');
    const decisions = res.rows;

    const differences = [];
    for (const d of decisions) {
      const polRes = evaluatePolicy(d.tool, d.heads, draftPolicy, false); // Truncation tracking not stored in v1 db, assume false for dry run
      if (polRes.verdict !== d.verdict) {
        differences.push({
          decision_id: d.id,
          tool: d.tool,
          old_verdict: d.verdict,
          new_verdict: polRes.verdict,
          old_reason_codes: d.reason_codes,
          new_reason_codes: polRes.reason_codes,
          heads: d.heads
        });
      }
    }

    return { total_evaluated: decisions.length, differences };
  });

  fastify.post('/v1/policy', { preHandler: requireDashboardAuth }, async (request, reply) => {
    const { yaml: newYaml } = request.body as any;
    let newPolicy;
    try {
      newPolicy = PolicySchema.parse(yaml.parse(newYaml));
    } catch (e: any) {
      return reply.status(400).send({ error: 'Invalid policy YAML', details: e.errors || e.message });
    }

    const version = newPolicy.version;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE policies SET active = false WHERE active = true');
      await client.query(
        'INSERT INTO policies (version, yaml, active, created_by) VALUES ($1, $2, true, $3) ON CONFLICT (version) DO UPDATE SET yaml = EXCLUDED.yaml, active = true',
        [version, newYaml, 'dashboard']
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    cachedPolicy = newPolicy;
    cachedPolicyYaml = newYaml;
    lastPolicyFetch = Date.now();
    return { success: true, version };
  });

  fastify.post('/v1/approvals/:id', { preHandler: requireDashboardAuth }, async (request, reply) => {
    const { id } = request.params as any;
    const { action } = request.body as any;
    const finalVerdict = action === 'approve' ? 'allow' : 'deny';
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE approvals SET status = $1 WHERE id = $2', [action === 'approve' ? 'approved' : 'denied', id]);
      await client.query('UPDATE decisions SET verdict = $1 WHERE id = (SELECT decision_id FROM approvals WHERE id = $2)', [finalVerdict, id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
    await pool.query('SELECT pg_notify($1, $2)', ['agentgate_events', JSON.stringify({ type: 'approval.resolved', data: { approval_id: id } })]);
    
    return { success: true, verdict: finalVerdict };
  });

  fastify.get('/v1/model', async (request, reply) => {
    const mConfig = await getModelConfig();
    return mConfig || { error: "Decision server unreachable" };
  });
  
  fastify.get('/metrics', async (request, reply) => {
    // Stub Prometheus metrics text
    return `
# HELP agentgate_decisions_total Number of decisions made
# TYPE agentgate_decisions_total counter
agentgate_decisions_total{verdict="allow"} 0
agentgate_decisions_total{verdict="deny"} 0
agentgate_decisions_total{verdict="ask"} 0
    `.trim();
  });
}
