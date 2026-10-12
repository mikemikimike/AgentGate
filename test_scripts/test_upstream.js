#!/usr/bin/env node
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    if (req.method === 'initialize') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'test_upstream', version: '1.0' } } }));
    } else if (req.method === 'tools/list') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { tools: [ { name: 'execute_query', description: 'Run a SQL query', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } } ] } }));
    } else if (req.method === 'tools/call') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: 'Query executed successfully.' }], isError: false } }));
    }
  } catch (e) {}
});
