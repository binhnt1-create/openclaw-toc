# Custom Chat UI - Phan tich kha thi

## 1. Ket luan: KHA THI HOAN TOAN

OpenClaw expose day du Gateway RPC + WebSocket protocol cho phep build UI chat doc lap.
React app chi can ket noi WebSocket den OpenClaw Gateway, gui/nhan JSON frames.

```
+------------------+        WebSocket         +------------------+
|                  |  <--------------------->  |                  |
|  React Chat UI   |    JSON RPC Frames        |  OpenClaw        |
|  (Custom)        |    + Event Streams        |  Gateway Server  |
|                  |                           |                  |
+------------------+                           +------------------+
     |                                              |
     | HTTP (optional)                              | Internal
     |                                              |
     v                                              v
  Static assets                              Agent Runner
  (Vite dev server)                          Inference Engine
                                             Plugin System
                                             Tool Execution
```

---

## 2. Gateway Protocol - Giao thuc giao tiep

### Connection Flow

```
React App                          OpenClaw Gateway
   |                                     |
   |--- WebSocket connect -------------->|
   |--- connect frame (auth+client) ---->|
   |<-- hello-ok frame -----------------|
   |                                     |
   |--- RequestFrame {method, params} -->|
   |<-- ResponseFrame {ok, payload} ----|
   |<-- EventFrame {event, payload} ----|  (streaming)
   |                                     |
```

### Frame Types

```typescript
// Client -> Server
type RequestFrame = {
  type: "req";
  id: string;        // unique request ID
  method: string;     // e.g. "chat.send", "sessions.list"
  params: unknown;
};

// Server -> Client
type ResponseFrame = {
  type: "res";
  id: string;        // matches request ID
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; retryable?: boolean };
};

// Server -> Client (streaming/notifications)
type EventFrame = {
  type: "event";
  event: string;      // e.g. "chat.event", "sessions.changed"
  payload: unknown;
  seq: number;
};
```

---

## 3. Functions DA HO TRO (dung truc tiep)

### 3.1 Agent Management

| Method | Params | Mo ta |
|--------|--------|-------|
| `agents.list` | `{}` | List tat ca agents. Tra ve `{defaultId, agents[]}` |
| `agents.create` | `{name, workspace, model?, emoji?}` | Tao agent moi |
| `agents.update` | `{agentId, name?, model?, emoji?}` | Update agent config |
| `agents.delete` | `{agentId}` | Xoa agent |

### 3.2 Session Management

| Method | Params | Mo ta |
|--------|--------|-------|
| `sessions.list` | `{agentId?, limit?, search?, activeMinutes?}` | List sessions, filter theo agent |
| `sessions.create` | `{agentId?, label?, model?, message?}` | Tao session moi |
| `sessions.delete` | `{key, deleteTranscript?}` | Xoa session |
| `sessions.patch` | `{key, label?, model?, thinkingLevel?}` | Update session config |
| `sessions.resolve` | `{key?, sessionId?, label?}` | Resolve session by key/id |
| `sessions.preview` | `{keys, limit?}` | Preview nhieu sessions |
| `sessions.reset` | `{key}` | Reset session state |

### 3.3 Chat Operations

| Method | Params | Mo ta |
|--------|--------|-------|
| `chat.send` | `{sessionKey, message, thinking?, attachments?}` | Gui message, nhan stream ChatEvent |
| `chat.history` | `{sessionKey, limit?, maxChars?}` | Load lich su chat |
| `chat.abort` | `{sessionKey, runId?}` | Huy inference dang chay |
| `chat.inject` | `{sessionKey, message, label?}` | Inject synthetic message |

### 3.4 ChatEvent Stream (response tu chat.send)

```typescript
type ChatEvent = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: {
    role: "assistant";
    content: string;
    thinking?: string;
    toolCalls?: ToolCall[];
  };
  usage?: { inputTokens: number; outputTokens: number };
  stopReason?: string;
  errorMessage?: string;
};
```

### 3.5 Models & Config

| Method | Params | Mo ta |
|--------|--------|-------|
| `models.list` | `{}` | List available LLM models |
| `config.get` | `{path?}` | Get config |
| `config.set` | `{path, value}` | Set config value |
| `tools.catalog` | `{agentId?}` | List available tools |
| `health` | `{}` | Health check |

### 3.6 OpenAI-Compatible REST (bonus)

| Endpoint | Mo ta |
|----------|-------|
| `GET /v1/models` | List models (OpenAI format) |
| `POST /v1/chat/completions` | Chat completions (OpenAI format) |
| `GET /sessions/{key}/history` | Session history via REST |

---

## 4. Functions CHUA HO TRO - Cach dap ung

### 4.1 Agent App Control (dieu khien Agent App tu chat)

**Van de**: Chat response tra ve text/thinking/tool_calls. Chua co co che built-in de AI "dieu khien" UI cua Agent App.

**Giai phap**: Dung **custom tool + plugin hook + gateway method**

```
Chat Response (tool_call)
    |
    v
[Custom Tool: "agent_app.action"]
    |
    v
Plugin Hook: after_tool_call
    |
    v
Gateway Event -> React UI
    |
    v
Agent App UI reacts
```

**Register custom tool** trong plugin:
```typescript
api.registerTool((ctx) => ({
  name: "agent_app_action",
  description: "Control the Agent App UI",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["open_tab", "update_form", "trigger_workflow"] },
      payload: { type: "object" }
    }
  },
  execute: async (args) => {
    return { status: "dispatched", action: args.action };
  }
}));
```

**Register gateway method**:
```typescript
api.registerGatewayMethod(
  "agentapp.subscribe",
  async ({ params, respond }) => {
    respond(true, { subscribed: true });
  },
  { scope: "operator.write" }
);
```

**Register HTTP route** (REST alternative):
```typescript
api.registerHttpRoute({
  path: "/api/agent-app/state",
  auth: "gateway",
  handler: async (req, res) => {
    const state = await getAgentAppState();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(state));
    return true;
  }
});
```

### 4.2 Real-time UI Sync

Da ho tro qua EventFrame:
- `chat.event` - chat stream
- `sessions.changed` - session updates
- Custom events qua plugin hooks

### 4.3 Custom Input Actions

Da ho tro:
- `chat.send` nhan `attachments[]`
- `chat.inject` cho synthetic messages
- Slash commands xu ly client-side, map sang RPC

---

## 5. Session Key Format

```
agent:{agentId}:{mainKey}

Vi du:
  agent:main:main              -> Default agent, main session
  agent:medical-ai:consult-001 -> Medical agent, session consult-001
```

---

## 6. Authentication

```typescript
const connectParams = {
  minProtocol: 1,
  maxProtocol: 1,
  client: {
    id: "custom-chat-ui",
    version: "1.0.0",
    platform: "web",
    mode: "operator",
  },
  auth: {
    token: "your-gateway-token",
  },
  scopes: ["operator.read", "operator.write"],
};
```

---

## 7. Dieu khien Agent App tu Chat - Flow chi tiet

```
User: "Mo tab Patient Records va tim benh nhan ABC"
    |
    v
OpenClaw AI (inference)
    |
    +-- Text: "Dang mo tab Patient Records..."
    +-- Tool call: agent_app_action({ action: "open_tab", payload: { tab: "patient-records" } })
    +-- Tool call: agent_app_action({ action: "search", payload: { query: "ABC" } })
    |
    v
ChatEvent stream -> React UI
    |
    +-- Render text
    +-- Dispatch UI actions from tool_calls
    +-- Agent App reacts: open tab + execute search
```

| Feature | Kha thi | Ghi chu |
|---------|---------|---------|
| Mo/dong tab | YES | Tool call -> UI dispatch |
| Cap nhat form | YES | Tool call voi payload |
| Trigger workflow | YES | Tool call -> backend |
| Doc du lieu tu App | YES | Tool result tra ve AI |
| Navigation | YES | Tool call -> router |
| DB/API operations | YES | Tool exec trong plugin |
| Chart/visualization | YES | Tool result + UI render |

---
---

# PERFORMANCE & SPEED ANALYSIS

## 1. Latency Breakdown: Tu user gui message den first token

```
User click Send
    |
    | ~0ms     UI optimistic update (user message hien ngay)
    |
    v
WebSocket frame -> Gateway
    |
    | ~5-20ms  Network (localhost) / ~50-200ms (remote)
    |
    v
Gateway chat.send handler
    |
    | ~50-200ms   Model resolution + Auth profile loading
    | ~20-100ms   Context engine initialization
    | ~100-1000ms Preflight compaction (NEU session dai)
    |
    v
Provider API call (Anthropic/OpenAI)
    |
    | ~200-500ms  Network roundtrip + queue wait
    |
    v
First token arrives
    |
    | ~150ms throttle  Gateway delta broadcast throttle
    |
    v
UI renders first text chunk
```

### Tong thoi gian trung binh: **500ms - 2s** (first token)

| Stage | Latency | Ghi chu |
|-------|---------|---------|
| UI -> Gateway | 5-200ms | Localhost gan nhu instant |
| Model init | 50-200ms | Resolve model, load auth profile |
| Auth setup | 50-100ms | Multi-profile rotation |
| Context engine | 20-100ms | Re-resolved moi run |
| Preflight compaction | 0-1000ms | Chi khi session dai, prompt >65% context |
| Provider API call | 200-500ms | Phu thuoc provider va model |
| Delta throttle | 150ms | Co dinh, broadcast interval |
| **Total first token** | **~500ms - 2s** | Typical |

---

## 2. Streaming Performance

### Delta Throttle Mechanism
- Gateway throttle **150ms** giua cac broadcast (src/gateway/server-chat.ts:727)
- Moi 150ms, gateway gui accumulated text cho client
- Trade-off: giam WebSocket frame count nhung tang latency ~150ms

### Block Streaming (cho channel delivery)
```
MIN_CHARS_PER_BLOCK = 800
MAX_CHARS_PER_BLOCK = 1200
COALESCE_IDLE_MS = 1000
```
- Block streaming chi anh huong channel delivery (Slack, Discord)
- WebSocket chat UI nhan raw deltas, KHONG bi block streaming

### Thuc te voi Custom Chat UI
- Client nhan **delta event moi ~150ms**
- Moi delta chua **full accumulated text** (khong phai incremental diff)
- UI chi can replace chatStream = newText, khong can concat

---

## 3. Tool Execution Impact

### Tool Blocking
- Khi AI goi tool, **streaming bi pause** cho den khi tool hoan thanh
- Tool result duoc gui lai LLM, inference tiep tuc
- **Anh huong**: User thay stream "dung lai" trong luc tool chay

### Tool Event Tracking
- Tool events broadcast rieng qua `agent` event channel
- Client co the hien thi tool progress (tool name, status)
- TTL: 10 phut cho tool event recipients

### Latency theo tool type
| Tool | Typical latency | Ghi chu |
|------|----------------|---------|
| bash command | 100ms - 30s | Phu thuoc command |
| web-search | 500ms - 3s | Network dependent |
| web-fetch | 200ms - 5s | Page size dependent |
| canvas | 50-200ms | In-memory |
| custom plugin tool | Variable | Developer controls |

---

## 4. Long Conversation Performance

### Compaction (Tu dong)
- Trigger khi prompt tokens > **65% context window**
- Tu dong compress old messages thanh summary
- Max timeout compaction attempts: **2 lan**
- Max overflow compaction attempts: **3 lan**

### Impact len user
- Compaction mat **100-1000ms** (1 lan LLM summarize)
- Sau compaction, context nhe hon -> inference nhanh hon
- User khong thay mat context (summary giu key info)

### Tool Result Truncation
- Neu tool result qua lon -> tu dong truncate
- `resolveLiveToolResultMaxChars()` quyet dinh threshold
- Applied sau khi compaction van khong du

### Recommendations cho long conversations
- Session nen co **label** de de track
- Nen dung `sessions.compact` manual khi can
- Monitor `compactionCheckpointCount` de biet session "nang" co nao

---

## 5. WebSocket Connection Performance

### Heartbeat & Keepalive
- Default heartbeat: **30 phut** mot lan
- Lifecycle error grace: **15 giay** truoc khi terminal
- Idle timeout: **120 giay** (neu khong co token nao tu LLM)

### Connection Resilience
- Client-side reconnect logic (trong GatewayBrowserClient)
- Re-subscribe events sau reconnect
- Stale history response filtering (version-based)

### Frame Overhead
- Moi frame la 1 JSON object (nho)
- Khong co binary protocol (WebSocket text frames)
- Typical delta frame: ~200-500 bytes

---

## 6. Cac config de toi uu performance

```yaml
agents:
  defaults:
    llm:
      # Giam timeout neu muon fail nhanh
      idleTimeoutSeconds: 60     # Default: 120

    # Block streaming (chi cho channels, khong anh huong WebSocket UI)
    blockStreamingChunk:
      minChars: 400              # Default: 800
      maxChars: 800              # Default: 1200

    # Compaction
    compaction:
      timeoutSeconds: 30
```

### Performance tips cho Custom Chat UI

1. **Pre-load agents.list va sessions.list** khi app khoi dong
2. **Cache chat.history** client-side, chi reload khi sessions.changed event
3. **Optimistic UI update**: Hien user message ngay, khong doi gateway confirm
4. **Stream rendering**: Render delta text tung 150ms, dung requestAnimationFrame
5. **Tool progress UI**: Hien tool name + spinner khi tool dang chay
6. **Lazy session loading**: Chi load history khi user click vao session
7. **Abort cho phep**: Cho user abort bat cu luc nao voi chat.abort
8. **Reconnect strategy**: Exponential backoff khi WebSocket disconnect

---

## 7. Benchmark Expectations

### Typical response times (Claude Sonnet 4.6)
| Scenario | First token | Full response |
|----------|------------|---------------|
| Short question | 500ms-1s | 2-5s |
| Complex reasoning (thinking=extended) | 1-3s | 10-30s |
| Multi-tool task (2-3 tools) | 500ms-1s | 5-15s (tool blocking) |
| Long conversation (>50 turns) | 1-2s | 3-10s (after compaction) |

### Throughput
- WebSocket: **~100 frames/sec** capability (limited by 150ms throttle to ~6-7 deltas/sec)
- Session list: **<200ms** typical response
- Chat history: **<500ms** for 200 messages
- Agent list: **<100ms** typical

### Memory footprint
- Gateway: ~50-200MB per active conversation
- Session transcript: ~1-10MB per long session (before compaction)
- Compaction reduces to ~10-20% of original size
