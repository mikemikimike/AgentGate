import { describe, it, expect, vi } from 'vitest';
import { DecisionClient } from '../src/decision/client';
import axios from 'axios';

vi.mock('axios');

describe('Decision Client', () => {
  it('handles successful calls and circuit breaking', async () => {
    const client = new DecisionClient({ url: 'http://test', deadlineMs: 500 });
    
    // Mock success
    (axios.post as any).mockResolvedValue({ data: { answers: {}, model_version: '1', latency_ms: 10 } });
    const res = await client.decide("text", ["q1"]);
    expect(res.model_version).toBe('1');
    
    // Mock failure to trip circuit
    (axios.post as any).mockRejectedValue(new Error("Network Error"));
    
    for (let i = 0; i < 5; i++) {
      await expect(client.decide("t", ["q"])).rejects.toThrow();
    }
    
    // 6th call should fail immediately with Circuit breaker open
    await expect(client.decide("t", ["q"])).rejects.toThrow("Circuit breaker open");
  });
});
