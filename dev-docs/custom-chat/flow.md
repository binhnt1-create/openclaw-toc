# OpenClaw Chat Flow Architecture

## Flow tong the (User -> AI -> Response)

```
+---------------------------------------------------------------------+
|                        USER INPUT                                   |
|  +----------+   +----------+   +--------------+   +------------+   |
|  |  Web UI   |   |   CLI    |   |  Channels    |   |  Gateway   |   |
|  | (app-chat)|   | (program)|   | (Slack/Disc) |   |  (RPC)     |   |
|  +-----+-----+   +----+-----+   +------+-------+   +-----+------+   |
+--------|--------------|-----------------|-----------------|---------+
         |              |                 |                 |
         v              v                 v                 v
+---------------------------------------------------------------------+
|                   GATEWAY SERVER (RPC)                               |
|  src/gateway/server-methods/chat.ts                                 |
|  +------------------+  +------------------+  +-------------------+  |
|  | chat.send         |  | chat.abort        |  | chat.history      |  |
|  +--------+----------+  +------------------+  +-------------------+  |
+-----------|---------------------------------------------------------+
            |
            v
+---------------------------------------------------------------------+
|               MESSAGE PREPROCESSING                                  |
|  +----------------+  +-----------------+  +----------------------+  |
|  | chat-sanitize   |  | chat-attachments |  | session-utils        |  |
|  | (strip/clean)   |  | (media validate) |  | (session resolve)    |  |
|  +--------+--------+  +--------+--------+  +----------+-----------+  |
+-----------|--------------------|---------------------|--------------+
            |                    |                     |
            v                    v                     v
+---------------------------------------------------------------------+
|               DISPATCH & REPLY ROUTING                               |
|  src/auto-reply/dispatch.ts -> dispatchInboundMessage()             |
|  src/auto-reply/reply/route-reply.ts                                |
|  +--------------------------------------------------------------+   |
|  |  ReplyDispatcher: typing indicators, buffered sends           |   |
|  +----------------------------+---------------------------------+   |
+-------------------------------|-------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|              AGENT RUNNER (Core AI Loop)                             |
|  src/auto-reply/reply/agent-runner.ts                               |
|  +--------------------------------------------------------------+   |
|  | 1. Resolve model & auth profile                               |   |
|  | 2. Build tool set (pi-bundle-tools.ts)                        |   |
|  | 3. Build system prompt + thinking config                      |   |
|  | 4. runAgentTurnWithFallback()                                 |   |
|  +----------------------------+---------------------------------+   |
+-------------------------------|-------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|           EMBEDDED PI RUNNER (Inference Engine)                      |
|  src/agents/pi-embedded-runner/run.ts                               |
|                                                                     |
|  +----------+  +---------------+  +--------------+                  |
|  | Transcript|  | Model/Auth    |  | System Prompt |                 |
|  | Building  |  | Resolution    |  | + Thinking    |                 |
|  +-----+----+  +------+--------+  +------+-------+                  |
|        |              |                   |                          |
|        v              v                   v                          |
|  +--------------------------------------------------------------+   |
|  |         PROVIDER SDK CALL (Anthropic/OpenAI/etc.)             |   |
|  |         -> Stream response back                               |   |
|  +----------------------------+---------------------------------+   |
+-------------------------------|-------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|           STREAM SUBSCRIPTION & EVENT HANDLING                       |
|  src/agents/pi-embedded-subscribe.ts                                |
|                                                                     |
|  +------------------------------------------------------------+     |
|  |  Event State Machine:                                       |     |
|  |                                                             |     |
|  |  +-------------+   +--------------+   +--------------+     |     |
|  |  |  THINKING    |-->|  TEXT DELTA   |-->|  TOOL CALL   |     |     |
|  |  |  (reasoning) |   |  (assistant)  |   |  (function)  |     |     |
|  |  +-------------+   +--------------+   +------+-------+     |     |
|  |        |                    |                 |             |     |
|  |        v                    v                 v             |     |
|  |  onThinkingStart/   onTextDelta()      Tool Execution      |     |
|  |  onThinkingEnd()    onTextEnd()        Pipeline            |     |
|  +--------------------------------------------+---------------+     |
+-----------------------------------------------|---------------------+
                                                |
                 +------------------------------+
                 |                              |
                 v                              v
+----------------------------+  +----------------------------------+
|     TOOL EXECUTION         |  |     RESPONSE DELIVERY            |
|                            |  |                                  |
|  +----------------------+  |  |  +--------------------------+    |
|  | before_tool_call     |  |  |  | block-reply-pipeline.ts  |    |
|  | (plugin hook)        |  |  |  | (streaming chunks)       |    |
|  +----------------------+  |  |  +--------------------------+    |
|  | Execute Tool:        |  |  |  | reply-payloads.ts        |    |
|  | - bash-tools.exec    |  |  |  | (format + media)         |    |
|  | - canvas-*           |  |  |  +--------------------------+    |
|  | - web-search/fetch   |  |  |  | deliver-runtime.ts       |    |
|  | - message-tool       |  |  |  | (async delivery)         |    |
|  | - plugin tools       |  |  |  +--------------------------+    |
|  +----------------------+  |  |                                  |
|  | after_tool_call      |  |  |  -> Web UI (WebSocket stream)   |
|  | (plugin hook)        |  |  |  -> CLI (stdout)                |
|  +----------+-----------+  |  |  -> Channel (Slack/Discord/etc.) |
|             |              |  +----------------------------------+
|    Result -> back to LLM   |
|    (multi-turn loop)       |
+----------------------------+
```

---

## Plugin & Tool System

```
+---------------------------------------------------------------------+
|                    PLUGIN LIFECYCLE                                  |
|                                                                     |
|  Discovery                    Loading                               |
|  src/plugins/discovery.ts     src/plugins/loader.ts                 |
|  +--------------------+      +------------------------+             |
|  | extensions/         |      | resolveRuntimePlugin   |             |
|  | ~/.openclaw/plugins |----->| Registry()             |             |
|  | OPENCLAW_PLUGIN_DIRS|      | - Jiti dynamic import  |             |
|  +--------------------+      | - Manifest validation  |             |
|                               +-----------+------------+             |
|                                           |                         |
|                                           v                         |
|  Registry                                                           |
|  src/plugins/registry.ts                                            |
|  +----------------------------------------------------------+      |
|  |  registerTool()    -> ToolEntry[]     (tool factories)    |      |
|  |  registerHook()    -> HookEntry[]     (lifecycle hooks)   |      |
|  |  registerProvider()-> ProviderEntry[] (AI backends)       |      |
|  |  registerGateway() -> GatewayHandler[](RPC methods)       |      |
|  |  registerChannel() -> ChannelPlugin[] (Slack/Discord/..)  |      |
|  +----------------------------------------------------------+      |
+---------------------------------------------------------------------+

+---------------------------------------------------------------------+
|                    TOOL RESOLUTION                                   |
|  src/agents/pi-bundle-tools.ts                                      |
|                                                                     |
|  Built-in Tools          Plugin Tools            Policy Filter      |
|  +-------------+       +--------------+       +-------------+       |
|  | bash         |       | Plugin SDK   |       | DENY_LIST   |       |
|  | canvas       |   +   | tool factory |  --> | ALLOW_LIST  |       |
|  | web-search   |       | invocation   |       | per-provider |       |
|  | web-fetch    |       |              |       | filtering    |       |
|  | message      |       +--------------+       +-------------+       |
|  | image        |                                                    |
|  +-------------+       Final: AnyAgentTool[] -> sent to LLM        |
+---------------------------------------------------------------------+
```

---

## AI Thinking (Extended Reasoning)

```
+-------------------------------------------------------------+
|                   THINKING FLOW                              |
|                                                              |
|  Config: src/auto-reply/thinking.ts                          |
|  thinking_level: "off" | "on" | "stream" | "extended"        |
|                                                              |
|  +--------------+                                            |
|  | System Prompt |--- thinking directive injected --+        |
|  +--------------+                                   |        |
|                                                     v        |
|  +------------------------------------------------------+   |
|  |  LLM Response Stream                                  |   |
|  |                                                       |   |
|  |  +---------------------+                              |   |
|  |  | onThinkingStart()   | <- reasoning block opens      |   |
|  |  | openReasoningStream |                              |   |
|  |  +---------------------+                              |   |
|  |  | thinking content... | <- internal reasoning         |   |
|  |  | (streamed to UI)    |   (hidden from channels)     |   |
|  |  +---------------------+                              |   |
|  |  | onThinkingEnd()     | <- reasoning block closes     |   |
|  |  +---------------------+                              |   |
|  |           |                                           |   |
|  |           v                                           |   |
|  |  +---------------------+                              |   |
|  |  | onTextDelta()       | <- visible assistant text     |   |
|  |  | (normal response)   |   (sent to user/channel)     |   |
|  |  +---------------------+                              |   |
|  +------------------------------------------------------+   |
|                                                              |
|  Display:                                                    |
|  - Web UI: thinking blocks shown separately (collapsible)    |
|  - Channels: suppressed (shouldSuppressReasoningPayload())   |
|  - Session: preserved in transcript for replay signatures    |
+-------------------------------------------------------------+
```

---

## Plugin Hook Points trong Chat Flow

```
User Message
    |
    v
[before_agent_start]     <- setup context, modify session state
    |
    v
Agent Execution Loop <-----------------------------------+
    |                                                    |
    +-- LLM Inference                                    |
    |       |                                            |
    |       v                                            |
    |   [thinking blocks] -> streamed to UI              |
    |   [text response]   -> accumulated                 |
    |   [tool calls]      -+                             |
    |                      |                             |
    |                      v                             |
    |         [before_tool_call] <- validate/modify      |
    |                      |                             |
    |                      v                             |
    |              Tool Execution                         |
    |                      |                             |
    |                      v                             |
    |         [after_tool_call]  <- observe/log          |
    |                      |                             |
    |              Tool Result ----------------------------+
    |              (back to LLM for next turn)
    |
    v
[before_agent_reply]     <- modify reply payload
    |
    v
[before_dispatch]        <- before channel delivery
    |
    v
Message Delivered -> User
    |
    v
[after_compaction]       <- after session history compaction
```

---

## Cac file quan trong

| Layer | File | Vai tro |
|-------|------|---------|
| **Entry** | `ui/src/ui/app-chat.ts` | Web UI chat state + queue |
| **Gateway** | `src/gateway/server-methods/chat.ts` | RPC handlers `chat.send/abort/history` |
| **Dispatch** | `src/auto-reply/dispatch.ts` | Route inbound -> reply handler |
| **Agent** | `src/auto-reply/reply/agent-runner.ts` | Orchestrate model + tools + auth |
| **Inference** | `src/agents/pi-embedded-runner/run.ts` | Core inference engine |
| **Stream** | `src/agents/pi-embedded-subscribe.ts` | Stream event state machine |
| **Thinking** | `src/agents/pi-embedded-runner/thinking.ts` | Extended reasoning handling |
| **Tools** | `src/agents/pi-bundle-tools.ts` | Aggregate built-in + plugin tools |
| **Tool exec** | `src/agents/pi-embedded-subscribe.handlers.tools.ts` | Execute tool calls + hooks |
| **Plugins** | `src/plugins/registry.ts` | Plugin registry (tools/hooks/providers) |
| **Plugin SDK** | `src/plugin-sdk/plugin-entry.ts` | Public API for plugin authors |
| **Providers** | `extensions/anthropic/register.runtime.ts` | Example: Anthropic provider plugin |
| **Session** | `src/agents/pi-embedded-runner/compact.ts` | Session history compaction |
| **Delivery** | `src/infra/outbound/deliver-runtime.ts` | Async message delivery |

---

## Chi tiet tung layer

### 1. User Input (Entry Points)

- **Web UI**: `ui/src/ui/app-chat.ts` quan ly chat state (messages, stream, queue, runId). User go tin -> `sendChatMessage()` trong `ui/src/ui/controllers/chat.ts`.
- **CLI**: `src/cli/program/register.message.ts` dang ky message command, route vao core.
- **Channels**: Plugin channels (Slack, Discord, Telegram...) nhan message tu platform, chuyen vao gateway.
- **Gateway RPC**: `src/gateway/server-methods/chat.ts` xu ly `chat.send`, `chat.abort`, `chat.history`.

### 2. Message Preprocessing

- `src/gateway/chat-sanitize.ts`: Strip envelope markers, clean content.
- `src/gateway/chat-attachments.ts`: Validate file/media attachments.
- `src/sessions/input-provenance.ts`: Track message origin (CLI, web, channel).
- `src/sessions/session-chat-type.ts`: Resolve chat type (direct, group, channel).

### 3. Dispatch & Reply Routing

- `src/auto-reply/dispatch.ts` -> `dispatchInboundMessage()`: Tao `ReplyDispatcher`, route message den reply handler.
- `src/auto-reply/reply/reply-dispatcher.ts`: Buffer sends, manage typing indicators.
- `src/auto-reply/reply/route-reply.ts`: Route reply ve dung channel goc.

### 4. Agent Runner (Core AI Loop)

- `src/auto-reply/reply/agent-runner.ts`: Orchestrator chinh.
  1. Resolve model va auth profile
  2. Build tool set tu `pi-bundle-tools.ts` (built-in + plugin tools)
  3. Build system prompt + thinking config
  4. Goi `runAgentTurnWithFallback()` tu `agent-runner-execution.ts`
- `src/auto-reply/reply/get-reply-run.ts`: Build execution context (model, thinking level, tools).

### 5. Embedded Pi Runner (Inference Engine)

- `src/agents/pi-embedded-runner/run.ts`: Core inference function.
  - Load transcript tu `SessionManager.appendMessage()`
  - Resolve model/provider qua `src/agents/pi-embedded-runner/model.ts`
  - Auth injection qua `src/agents/model-auth.ts`
  - Construct system prompt voi thinking/tool directives
  - Goi provider SDK (Anthropic, OpenAI, etc.) va nhan stream response

### 6. Stream Subscription & Event Handling

- `src/agents/pi-embedded-subscribe.ts`: State machine xu ly stream events.
- `src/agents/pi-embedded-subscribe.handlers.messages.ts`:
  - `onTextDelta()`: Accumulate streamed text chunks
  - `onTextEnd()`: Finalize text block, extract directives
  - `onThinkingStart/End()`: Manage thinking/reasoning blocks
- `src/agents/pi-embedded-subscribe.handlers.tools.ts`:
  - Extract tool calls tu LLM response
  - Dispatch den tool executor (bash, canvas, web-search, etc.)
  - Fire `before_tool_call` va `after_tool_call` plugin hooks
  - Collect result, handle media/artifacts, truncate if needed

### 7. Tool Execution

- **Tool aggregation**: `src/agents/pi-bundle-tools.ts` gom built-in tools + plugin tools.
- **Tool policy**: `src/agents/pi-tools.message-provider-policy.ts` filter tools theo provider (DENY_LIST, ALLOW_LIST).
- **Built-in tools**: `src/agents/tools/` - bash, canvas, web-search, web-fetch, message, image.
- **Plugin tools**: Registered qua `OpenClawPluginToolFactory` trong plugin manifest -> resolve luc runtime qua `src/plugins/tools.ts`.
- **Execution flow**:
  1. LLM chon tool + arguments
  2. Validate tool name, schema, repair args neu malformed
  3. `before_tool_call` hook (plugin can block/modify)
  4. Execute tool trong sandbox context
  5. `after_tool_call` hook
  6. Result -> format -> gui lai LLM cho turn tiep theo (multi-turn loop)

### 8. AI Thinking (Extended Reasoning)

- **Config**: `src/auto-reply/thinking.ts` - `normalizeThinkLevel()` validate thinking level.
- **Levels**: `"off"` | `"on"` | `"stream"` | `"extended"`
- **Flow**:
  1. Thinking directive duoc inject vao system prompt
  2. LLM quyet dinh dung thinking dua tren complexity
  3. Stream handler tach thinking blocks khoi text blocks
  4. `onThinkingStart()` -> `openReasoningStream()` -> thinking content -> `onThinkingEnd()`
  5. Thinking streamed to Web UI (collapsible), suppressed for channels
  6. Preserved in session transcript for replay signatures
- **Key files**: `src/agents/pi-embedded-runner/thinking.ts`, `src/agents/pi-embedded-subscribe.handlers.messages.ts`

### 9. Plugin System

- **Discovery** (`src/plugins/discovery.ts`): Scan `extensions/`, `~/.openclaw/plugins/`, `OPENCLAW_PLUGIN_DIRS`.
- **Manifest** (`src/plugins/manifest.ts`): `openclaw.plugin.json` dinh nghia id, providers, modelSupport, configSchema, activation triggers.
- **Loader** (`src/plugins/loader.ts`): `resolveRuntimePluginRegistry()` - Jiti dynamic import, validate, cache.
- **Registry** (`src/plugins/registry.ts`): `createPluginRegistry()` dang ky tools, hooks, providers, channels, gateway methods.
- **SDK** (`src/plugin-sdk/plugin-entry.ts`): Public API cho plugin authors - 70+ type exports.
- **Provider types**: Text inference, Speech (TTS), Realtime voice/transcription, Media understanding, Image/Video/Music generation, Web fetch/search.

### 10. Session Persistence & Compaction

- **Transcript**: `src/config/sessions.ts` - load/save `.openclaw/sessions/*.jsonl`.
- **Compaction**: `src/agents/pi-embedded-runner/compact.ts` - compress old messages khi overflow/timeout.
  - Replace old turn pairs voi summary
  - Preserve token budget cho long conversations
  - Fire `after_compaction` plugin hook

### 11. Error Handling & Fallback

- **Model failover**: `src/agents/pi-embedded-runner/run/assistant-failover.ts` - rotate auth profiles, try different models.
- **Error classification**: `src/agents/failover-error.ts` - auth, billing, rate limit, overflow.
- **Tool errors**: Caught in `pi-embedded-subscribe.handlers.tools.ts`, included in transcript cho LLM handle/retry.
- **Gateway**: `src/gateway/chat-abort.ts` - abort tracking, timeouts.
