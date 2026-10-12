async function run() {
  console.log('Starting rigorous load test: 100 concurrent requests...');
  
  let sessionId;
  try {
    const sesRes = await fetch('http://localhost:8080/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: 'load_tester_9000',
        goal: 'Survive the rigorous load test'
      })
    });
    const sesData = await sesRes.json();
    if (!sesRes.ok) throw new Error(JSON.stringify(sesData));
    sessionId = sesData.session_id;
    console.log(`Created Session: ${sessionId}`);
  } catch(e) {
    console.error('Failed to create session:', e.message);
    return;
  }

  const start = Date.now();
  const promises = [];
  const TOTAL = 100;

  for (let i = 0; i < TOTAL; i++) {
    const payload = {
      session_id: sessionId,
      action: {
        tool: 'bash',
        arguments: { command: `echo "Load test ${i}" && export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE` }
      }
    };
    promises.push(
      fetch('http://localhost:8080/v1/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) return { success: false, err: JSON.stringify(data) };
        return { success: true, ms: data.latency_ms.total };
      })
      .catch(e => ({ success: false, err: e.message }))
    );
  }

  const results = await Promise.all(promises);
  const totalMs = Date.now() - start;

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  const latencies = successes.map(r => r.ms).sort((a,b) => a - b);

  console.log('\n--- Load Test Results ---');
  console.log(`Total Requests: ${TOTAL}`);
  console.log(`Successful: ${successes.length}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Total Time: ${totalMs}ms`);
  console.log(`Throughput: ${(TOTAL / (totalMs / 1000)).toFixed(2)} req/sec`);
  
  if (latencies.length > 0) {
    console.log('\n--- Latency Percentiles ---');
    console.log(`Min: ${latencies[0]}ms`);
    console.log(`p50: ${latencies[Math.floor(latencies.length * 0.5)]}ms`);
    console.log(`p95: ${latencies[Math.floor(latencies.length * 0.95)]}ms`);
    console.log(`Max: ${latencies[latencies.length - 1]}ms`);
  }

  if (failures.length > 0) {
    console.log('\n--- Sample Error ---');
    console.log(failures[0].err);
  }

  console.log('\n--- Testing Cursor Pagination ---');
  try {
    const p1 = await fetch('http://localhost:8080/v1/decisions?limit=50', { headers: { 'Authorization': 'Bearer dev-key-123' }});
    const p1Data = await p1.json();
    console.log(`Page 1: Returned ${p1Data.decisions.length} decisions. Cursor: ${p1Data.cursor}`);
    if (p1Data.cursor) {
      const p2 = await fetch(`http://localhost:8080/v1/decisions?limit=50&cursor=${encodeURIComponent(p1Data.cursor)}`, { headers: { 'Authorization': 'Bearer dev-key-123' }});
      const p2Data = await p2.json();
      console.log(`Page 2: Returned ${p2Data.decisions.length} decisions. Next Cursor: ${p2Data.cursor}`);
    }
  } catch(e) {
    console.error('Pagination failed:', e.message);
  }
}

run();
