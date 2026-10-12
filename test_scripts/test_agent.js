#!/usr/bin/env node
const { spawn } = require('child_process');

const proxy = spawn('node', ['dist/src/mcp.js', 'node', '../test_scripts/test_upstream.js'], { 
  cwd: './proxy',
  env: { ...process.env, AGENTGATE_URL: 'http://127.0.0.1:8080' } 
});

proxy.stdout.on('data', (data) => {
  console.log(`[Agent Received from Proxy]\n${data.toString()}`);
});

proxy.stderr.on('data', (data) => {
  console.error(`${data.toString()}`);
});

setTimeout(() => {
  const req = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'execute_query',
      arguments: { query: 'DROP TABLE users;' }
    }
  };
  console.log(`[Agent Sending to Proxy] ${JSON.stringify(req)}`);
  proxy.stdin.write(JSON.stringify(req) + '\n');
}, 3000); 

setTimeout(() => {
  proxy.kill();
  process.exit(0);
}, 6000);
