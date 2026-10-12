import axios from 'axios';

export interface DecisionClientOptions {
  url: string;
  deadlineMs: number;
}

export class DecisionClient {
  private url: string;
  private deadlineMs: number;
  private failures: number = 0;
  private circuitOpen: boolean = false;
  private lastFailureTime: number = 0;
  private CIRCUIT_TIMEOUT = 10000;
  private MAX_FAILURES = 5;

  constructor(options: DecisionClientOptions) {
    this.url = options.url;
    this.deadlineMs = options.deadlineMs;
  }

  async decide(text: string, questions: string[]): Promise<{answers: any, model_version: string, latency_ms: number}> {
    if (this.circuitOpen) {
      if (Date.now() - this.lastFailureTime > this.CIRCUIT_TIMEOUT) {
        // Half-open: let one through
        this.circuitOpen = false;
      } else {
        throw new Error("Circuit breaker open");
      }
    }

    try {
      const res = await axios.post(`${this.url}/decide`, { text, questions }, { timeout: this.deadlineMs });
      this.failures = 0; // reset
      return res.data;
    } catch (e: any) {
      this.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.MAX_FAILURES) {
        this.circuitOpen = true;
      }
      throw e;
    }
  }
}
