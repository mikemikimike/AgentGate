# Client Integration Guide

AgentGate can be integrated into existing agent architectures via two distinct patterns:
1. **Transparent Sidecar (Model Context Protocol)**: Intercepts stdio messages between MCP clients and servers with zero agent code modifications.
2. **REST API**: Direct HTTP integration for custom frameworks (Python, Node.js, Go).

---

## Pattern 1: Model Context Protocol (MCP) Sidecar

If your agent runtime communicates with tools over MCP (e.g. Claude Desktop, Cursor, local agent daemons), AgentGate provides a lightweight stdio wrapper script (`proxy/dist/src/mcp.js`).

### Claude Desktop / Cursor Configuration

Add the wrapper as the command in your MCP configuration file:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": [
        "/path/to/AgentGate/proxy/dist/src/mcp.js",
        "npx", "-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@localhost:5432/production"
      ],
      "env": {
        "AGENTGATE_URL": "http://localhost:8080"
      }
    }
  }
}
```

The wrapper intercepts every `tools/call` message, submits it to `POST /v1/assess`, and only forwards the message to the actual MCP server if the verdict is `allow`.

---

## Pattern 2: Python / LangChain / CrewAI Integration

### Step 1: Session Initialization
When an agent task begins, register a session with the declared objective:

```python
import requests

GATEWAY_URL = "http://localhost:8080"

session_resp = requests.post(f"{GATEWAY_URL}/v1/sessions", json={
    "agent_id": "security-analyst-agent",
    "goal": "Scan logs and identify failed SSH login attempts"
})
session_id = session_resp.json()["session_id"]
```

### Step 2: Tool Pre-Execution Check
Before invoking any tool, request assessment:

```python
def execute_guarded_tool(session_id: str, tool_name: str, arguments: dict):
    res = requests.post(f"{GATEWAY_URL}/v1/assess", json={
        "session_id": session_id,
        "action": {
            "tool": tool_name,
            "arguments": arguments
        }
    }).json()

    verdict = res["verdict"]

    if verdict == "allow":
        return run_underlying_tool(tool_name, arguments)
    elif verdict == "deny":
        raise PermissionError(f"Rejected by AgentGate: {res.get('reason_codes')}")
    elif verdict == "ask":
        print(f"Action held for human operator review (Decision ID: {res['decision_id']})")
        # Poll or wait for human operator approval via /v1/decisions/:id
```

---

## Pattern 3: Node.js / TypeScript Integration

```typescript
import axios from 'axios';

const AGENTGATE_URL = process.env.AGENTGATE_URL || 'http://localhost:8080';

export async function assessToolCall(sessionId: string, tool: string, args: Record<string, any>) {
  const response = await axios.post(`${AGENTGATE_URL}/v1/assess`, {
    session_id: sessionId,
    action: {
      tool,
      arguments: args
    }
  });

  return response.data; // { verdict: 'allow' | 'deny' | 'ask', decision_id: string }
}
```
