#!/usr/bin/env node

import { spawn } from 'child_process';
import readline from 'readline';
import axios from 'axios';

// Rule: Prototype First & One Bow, Multiple Shots
// Instead of duplicating DB and policy logic, this lightweight stdio wrapper
// simply delegates to the running AgentGate Proxy API.

const AGENTGATE_URL = process.env.AGENTGATE_URL || 'http://127.0.0.1:8080';
const agentAuthHeaders = process.env.AG_AGENT_KEY
  ? { Authorization: `Bearer ${process.env.AG_AGENT_KEY}` }
  : {};
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: agentgate-mcp <upstream_command> [args...]");
  process.exit(1);
}

const upstreamCmd = args[0];
const upstreamArgs = args.slice(1);

let sessionId: string | null = null;
let sessionPromise: Promise<string> | null = null;

async function initSession(): Promise<string> {
  try {
    const res = await axios.post(`${AGENTGATE_URL}/v1/sessions`, {
      agent_id: 'mcp-client',
      goal: 'MCP Session'
    }, { headers: agentAuthHeaders });
    sessionId = res.data.session_id;
    console.error(`[AgentGate MCP] Started session: ${sessionId}`);
    return sessionId!;
  } catch (err: any) {
    console.error(`[AgentGate MCP] Failed to init session with AgentGate: ${err.message}`);
    throw err;
  }
}

// Spawn upstream
const upstream = spawn(upstreamCmd, upstreamArgs, {
  stdio: ['pipe', 'pipe', 'inherit'] // pipe stdin/out, pass stderr through
});

upstream.on('error', (err) => {
  console.error(`[AgentGate MCP] Failed to start upstream: ${err.message}`);
  process.exit(1);
});

upstream.on('exit', (code) => {
  console.error(`[AgentGate MCP] Upstream exited with code ${code}`);
  process.exit(code || 0);
});

// Relay upstream stdout -> our stdout
const upstreamRl = readline.createInterface({
  input: upstream.stdout,
  terminal: false
});

upstreamRl.on('line', (line) => {
  console.log(line);
});

// Relay our stdin -> upstream stdin, intercepting tools/call
const stdinRl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

async function handleToolCall(req: any) {
  if (!sessionId) {
    try {
      if (!sessionPromise) {
        sessionPromise = initSession();
      }
      sessionId = await sessionPromise;
    } catch (err: any) {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32603, message: `AgentGate session failed to initialize: ${err.message}` }
      }));
      return;
    }
  }

  if (!sessionId) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32603, message: 'AgentGate session not initialized' }
    }));
    return;
  }

  const toolName = req.params?.name;
  const toolArgs = req.params?.arguments;

  try {
    console.error(`[AgentGate MCP] Assessing tool call: ${toolName}`);
    const res = await axios.post(`${AGENTGATE_URL}/v1/assess`, {
      session_id: sessionId,
      action: {
        tool: toolName,
        arguments: toolArgs
      }
    });

    const { verdict, decision_id, reason_codes } = res.data;
    console.error(`[AgentGate MCP] Verdict for ${toolName}: ${verdict.toUpperCase()}`);

    if (verdict === 'allow' || verdict === 'allow_with_checkpoint') {
      // Forward to upstream
      upstream.stdin.write(JSON.stringify(req) + '\n');
    } else if (verdict === 'deny') {
      // Blocked by policy, return a tool result indicating failure
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [{
            type: 'text',
            text: `AgentGate blocked this action. Verdict: DENY. Reasons: ${reason_codes.join(', ')}`
          }],
          isError: true
        }
      }));
    } else if (verdict === 'ask') {
      // Pending human approval
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [{
            type: 'text',
            text: `AgentGate paused this action for human approval (Decision ID: ${decision_id}). Please wait or ask the user to approve it on the dashboard.`
          }],
          isError: true
        }
      }));
    } else {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [{
            type: 'text',
            text: `AgentGate returned unhandled verdict: ${verdict}`
          }],
          isError: true
        }
      }));
    }
  } catch (err: any) {
    console.error(`[AgentGate MCP] Error reaching AgentGate proxy:`, err.message);
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32603, message: `AgentGate internal error: ${err.message}` }
    }));
  }
}

stdinRl.on('line', async (line) => {
  if (!line.trim()) return;
  
  try {
    const req = JSON.parse(line);
    
    // Intercept tool calls
    if (req.method === 'tools/call') {
      await handleToolCall(req);
      return;
    }
    
    // Pass everything else through
    upstream.stdin.write(line + '\n');
  } catch (err) {
    // If not valid JSON, just pass it through and let upstream handle it
    upstream.stdin.write(line + '\n');
  }
});

sessionPromise = initSession().catch(() => '');
