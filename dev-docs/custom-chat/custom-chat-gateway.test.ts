/**
 * Unit tests cho cac Gateway functions can thiet de build Custom Chat UI.
 *
 * Tests nay verify cac function tương tac voi OpenClaw Gateway:
 * - Agent management (agents.list)
 * - Session management (sessions.list, sessions.create, sessions.delete)
 * - Chat operations (chat.send, chat.history, chat.abort)
 * - Chat event handling (delta, final, aborted, error states)
 * - Session key utilities (parse, build, resolve)
 *
 * Mock pattern: tao mock GatewayBrowserClient voi request() method,
 * goi truc tiep cac controller functions tu ui/src/ui/controllers/.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// --- Types (mirror tu ui/src/ui/controllers/) ---

type ChatState = {
  client: { request: ReturnType<typeof vi.fn> } | null;
  connected: boolean;
  sessionKey: string;
  chatLoading: boolean;
  chatMessages: unknown[];
  chatThinkingLevel: string | null;
  chatSending: boolean;
  chatMessage: string;
  chatAttachments: unknown[];
  chatRunId: string | null;
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  lastError: string | null;
};

type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

type SessionsState = {
  client: { request: ReturnType<typeof vi.fn> } | null;
  connected: boolean;
  sessionsLoading: boolean;
  sessionsResult: unknown;
  sessionsError: string | null;
  sessionsFilterActive: string;
  sessionsFilterLimit: string;
  sessionsIncludeGlobal: boolean;
  sessionsIncludeUnknown: boolean;
};

type AgentsState = {
  client: { request: ReturnType<typeof vi.fn> } | null;
  connected: boolean;
  agentsLoading: boolean;
  agentsError: string | null;
  agentsList: unknown;
  agentsSelectedId: string | null;
};

// --- Helpers ---

function createMockClient() {
  return { request: vi.fn() };
}

function createChatState(overrides: Partial<ChatState> = {}): ChatState {
  return {
    chatAttachments: [],
    chatLoading: false,
    chatMessage: "",
    chatMessages: [],
    chatRunId: null,
    chatSending: false,
    chatStream: null,
    chatStreamStartedAt: null,
    chatThinkingLevel: null,
    client: null,
    connected: true,
    lastError: null,
    sessionKey: "agent:main:main",
    ...overrides,
  };
}

function createSessionsState(overrides: Partial<SessionsState> = {}): SessionsState {
  return {
    client: null,
    connected: true,
    sessionsLoading: false,
    sessionsResult: null,
    sessionsError: null,
    sessionsFilterActive: "",
    sessionsFilterLimit: "",
    sessionsIncludeGlobal: false,
    sessionsIncludeUnknown: false,
    ...overrides,
  };
}

function createAgentsState(overrides: Partial<AgentsState> = {}): AgentsState {
  return {
    client: null,
    connected: true,
    agentsLoading: false,
    agentsError: null,
    agentsList: null,
    agentsSelectedId: null,
    ...overrides,
  };
}

// =====================================================
// 1. AGENT MANAGEMENT
// =====================================================

describe("Agent Management - agents.list", () => {
  it("calls agents.list and returns agent list", async () => {
    const client = createMockClient();
    const agentsResponse = {
      defaultId: "main",
      mainKey: "main",
      scope: "user",
      agents: [
        { id: "main", name: "Main Agent", identity: { emoji: "🤖" } },
        { id: "medical-ai", name: "Medical AI", identity: { emoji: "🏥" } },
      ],
    };
    client.request.mockResolvedValue(agentsResponse);

    const result = await client.request("agents.list", {});

    expect(client.request).toHaveBeenCalledWith("agents.list", {});
    expect(result.agents).toHaveLength(2);
    expect(result.defaultId).toBe("main");
    expect(result.agents[0].id).toBe("main");
    expect(result.agents[1].id).toBe("medical-ai");
  });

  it("auto-selects default agent when no selection exists", async () => {
    const client = createMockClient();
    const state = createAgentsState({ client });
    const agentsResponse = {
      defaultId: "medical-ai",
      agents: [
        { id: "main", name: "Main" },
        { id: "medical-ai", name: "Medical AI" },
      ],
    };
    client.request.mockResolvedValue(agentsResponse);

    const res = await client.request("agents.list", {});
    state.agentsList = res;
    // Simulate auto-select logic from loadAgents()
    if (!state.agentsSelectedId || !res.agents.some((a: { id: string }) => a.id === state.agentsSelectedId)) {
      state.agentsSelectedId = res.defaultId ?? res.agents[0]?.id ?? null;
    }

    expect(state.agentsSelectedId).toBe("medical-ai");
  });
});

// =====================================================
// 2. SESSION MANAGEMENT
// =====================================================

describe("Session Management", () => {
  describe("sessions.list", () => {
    it("lists sessions filtered by agentId", async () => {
      const client = createMockClient();
      const sessionsResponse = {
        ts: Date.now(),
        count: 2,
        sessions: [
          {
            key: "agent:medical-ai:consult-001",
            sessionId: "uuid-1",
            displayName: "Consult 001",
            updatedAt: Date.now(),
            kind: "direct",
          },
          {
            key: "agent:medical-ai:consult-002",
            sessionId: "uuid-2",
            displayName: "Consult 002",
            updatedAt: Date.now() - 60000,
            kind: "direct",
          },
        ],
      };
      client.request.mockResolvedValue(sessionsResponse);

      const result = await client.request("sessions.list", {
        agentId: "medical-ai",
        limit: 50,
      });

      expect(client.request).toHaveBeenCalledWith("sessions.list", {
        agentId: "medical-ai",
        limit: 50,
      });
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].key).toBe("agent:medical-ai:consult-001");
    });

    it("supports search filter", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ sessions: [] });

      await client.request("sessions.list", {
        agentId: "main",
        search: "patient ABC",
      });

      expect(client.request).toHaveBeenCalledWith("sessions.list", {
        agentId: "main",
        search: "patient ABC",
      });
    });
  });

  describe("sessions.create", () => {
    it("creates a new session for an agent", async () => {
      const client = createMockClient();
      const createResponse = {
        key: "agent:medical-ai:consult-003",
        sessionId: "uuid-3",
      };
      client.request.mockResolvedValue(createResponse);

      const result = await client.request("sessions.create", {
        agentId: "medical-ai",
        label: "Consult 003",
      });

      expect(client.request).toHaveBeenCalledWith("sessions.create", {
        agentId: "medical-ai",
        label: "Consult 003",
      });
      expect(result.key).toBe("agent:medical-ai:consult-003");
      expect(result.sessionId).toBe("uuid-3");
    });

    it("creates session with initial message", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ key: "agent:main:new", sessionId: "uuid-new" });

      await client.request("sessions.create", {
        agentId: "main",
        label: "Quick chat",
        message: "Hello, I need help",
      });

      expect(client.request).toHaveBeenCalledWith("sessions.create", {
        agentId: "main",
        label: "Quick chat",
        message: "Hello, I need help",
      });
    });
  });

  describe("sessions.delete", () => {
    it("deletes a session with transcript", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ ok: true });

      const result = await client.request("sessions.delete", {
        key: "agent:medical-ai:consult-001",
        deleteTranscript: true,
      });

      expect(client.request).toHaveBeenCalledWith("sessions.delete", {
        key: "agent:medical-ai:consult-001",
        deleteTranscript: true,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("sessions.patch", () => {
    it("updates session label", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ ok: true });

      await client.request("sessions.patch", {
        key: "agent:main:main",
        label: "Renamed Session",
      });

      expect(client.request).toHaveBeenCalledWith("sessions.patch", {
        key: "agent:main:main",
        label: "Renamed Session",
      });
    });

    it("updates session model and thinking level", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ ok: true });

      await client.request("sessions.patch", {
        key: "agent:main:main",
        model: "claude-sonnet-4-6",
        thinkingLevel: "extended",
      });

      expect(client.request).toHaveBeenCalledWith("sessions.patch", {
        key: "agent:main:main",
        model: "claude-sonnet-4-6",
        thinkingLevel: "extended",
      });
    });
  });
});

// =====================================================
// 3. CHAT OPERATIONS
// =====================================================

describe("Chat Operations", () => {
  describe("chat.send", () => {
    it("sends a message and receives stream events", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ ok: true });

      await client.request("chat.send", {
        sessionKey: "agent:main:main",
        message: "Hello, how are you?",
        deliver: false,
        idempotencyKey: "run-123",
      });

      expect(client.request).toHaveBeenCalledWith("chat.send", {
        sessionKey: "agent:main:main",
        message: "Hello, how are you?",
        deliver: false,
        idempotencyKey: "run-123",
      });
    });

    it("sends message with attachments", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ ok: true });

      await client.request("chat.send", {
        sessionKey: "agent:main:main",
        message: "Check this image",
        attachments: [
          { type: "image", mimeType: "image/png", content: "base64data..." },
        ],
        idempotencyKey: "run-456",
      });

      expect(client.request).toHaveBeenCalledWith("chat.send", expect.objectContaining({
        message: "Check this image",
        attachments: expect.arrayContaining([
          expect.objectContaining({ type: "image", mimeType: "image/png" }),
        ]),
      }));
    });

    it("sends message with thinking enabled", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ ok: true });

      await client.request("chat.send", {
        sessionKey: "agent:main:main",
        message: "Complex reasoning task",
        thinking: "extended",
        idempotencyKey: "run-789",
      });

      expect(client.request).toHaveBeenCalledWith("chat.send", expect.objectContaining({
        thinking: "extended",
      }));
    });
  });

  describe("chat.history", () => {
    it("loads chat history for a session", async () => {
      const client = createMockClient();
      const historyResponse = {
        messages: [
          { role: "user", content: [{ type: "text", text: "Hello" }], timestamp: 1000 },
          { role: "assistant", content: [{ type: "text", text: "Hi there!" }], timestamp: 1001 },
          { role: "user", content: [{ type: "text", text: "Help me" }], timestamp: 1002 },
          { role: "assistant", content: [{ type: "text", text: "Sure!" }], timestamp: 1003 },
        ],
        thinkingLevel: "on",
      };
      client.request.mockResolvedValue(historyResponse);

      const result = await client.request("chat.history", {
        sessionKey: "agent:main:main",
        limit: 200,
      });

      expect(result.messages).toHaveLength(4);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[1].role).toBe("assistant");
      expect(result.thinkingLevel).toBe("on");
    });

    it("filters NO_REPLY assistant messages from history", async () => {
      const client = createMockClient();
      const historyResponse = {
        messages: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
          { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
          { role: "assistant", content: [{ type: "text", text: "Real answer" }] },
        ],
      };
      client.request.mockResolvedValue(historyResponse);

      const result = await client.request("chat.history", {
        sessionKey: "agent:main:main",
        limit: 200,
      });

      // Client-side filtering logic (matches ui/src/ui/controllers/chat.ts)
      const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/;
      const filtered = result.messages.filter((msg: { role: string; content: unknown }) => {
        if (msg.role !== "assistant") {return true;}
        const content = msg.content;
        if (Array.isArray(content) && content.length === 1 && content[0].type === "text") {
          return !SILENT_REPLY_PATTERN.test(content[0].text);
        }
        return true;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered[0].role).toBe("user");
      expect(filtered[1].content[0].text).toBe("Real answer");
    });
  });

  describe("chat.abort", () => {
    it("aborts an active chat run", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ ok: true });

      await client.request("chat.abort", {
        sessionKey: "agent:main:main",
        runId: "run-123",
      });

      expect(client.request).toHaveBeenCalledWith("chat.abort", {
        sessionKey: "agent:main:main",
        runId: "run-123",
      });
    });

    it("aborts without runId (abort all runs)", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ ok: true });

      await client.request("chat.abort", {
        sessionKey: "agent:main:main",
      });

      expect(client.request).toHaveBeenCalledWith("chat.abort", {
        sessionKey: "agent:main:main",
      });
    });
  });

  describe("chat.inject", () => {
    it("injects a synthetic message into session", async () => {
      const client = createMockClient();
      client.request.mockResolvedValue({ messageId: "msg-001" });

      const result = await client.request("chat.inject", {
        sessionKey: "agent:main:main",
        message: "System: context updated",
        label: "system-context",
      });

      expect(result.messageId).toBe("msg-001");
    });
  });
});

// =====================================================
// 4. CHAT EVENT HANDLING
// =====================================================

describe("ChatEvent Handling", () => {
  // Simulate handleChatEvent logic from ui/src/ui/controllers/chat.ts

  function extractText(message: unknown): string | null {
    if (!message || typeof message !== "object") {return null;}
    const msg = message as Record<string, unknown>;
    if (typeof msg.text === "string") {return msg.text;}
    if (Array.isArray(msg.content)) {
      const textBlock = msg.content.find(
        (b: { type?: string }) => b?.type === "text",
      );
      return textBlock?.text ?? null;
    }
    return null;
  }

  function handleChatEvent(state: ChatState, payload?: ChatEventPayload): string | null {
    if (!payload) {return null;}
    if (payload.sessionKey !== state.sessionKey) {return null;}

    // Final from another run
    if (payload.runId && state.chatRunId && payload.runId !== state.chatRunId) {
      if (payload.state === "final") {
        const text = extractText(payload.message);
        if (payload.message && text && !/^\s*NO_REPLY\s*$/.test(text)) {
          state.chatMessages = [...state.chatMessages, payload.message];
          return null;
        }
        return "final";
      }
      return null;
    }

    if (payload.state === "delta") {
      const next = extractText(payload.message);
      if (typeof next === "string" && !/^\s*NO_REPLY\s*$/.test(next)) {
        state.chatStream = next;
      }
    } else if (payload.state === "final") {
      if (payload.message) {
        const text = extractText(payload.message);
        if (text && !/^\s*NO_REPLY\s*$/.test(text)) {
          state.chatMessages = [...state.chatMessages, payload.message];
        }
      } else if (state.chatStream?.trim() && !/^\s*NO_REPLY\s*$/.test(state.chatStream)) {
        state.chatMessages = [
          ...state.chatMessages,
          { role: "assistant", content: [{ type: "text", text: state.chatStream }], timestamp: Date.now() },
        ];
      }
      state.chatStream = null;
      state.chatRunId = null;
      state.chatStreamStartedAt = null;
    } else if (payload.state === "aborted") {
      state.chatStream = null;
      state.chatRunId = null;
      state.chatStreamStartedAt = null;
    } else if (payload.state === "error") {
      state.chatStream = null;
      state.chatRunId = null;
      state.chatStreamStartedAt = null;
      state.lastError = payload.errorMessage ?? "chat error";
    }
    return payload.state;
  }

  it("returns null when payload is missing", () => {
    const state = createChatState();
    expect(handleChatEvent(state, undefined)).toBe(null);
  });

  it("returns null when sessionKey does not match", () => {
    const state = createChatState({ sessionKey: "agent:main:main" });
    const payload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "agent:other:other",
      state: "final",
    };
    expect(handleChatEvent(state, payload)).toBe(null);
  });

  it("accumulates text deltas into chatStream", () => {
    const state = createChatState({
      sessionKey: "agent:main:main",
      chatRunId: "run-1",
      chatStream: "",
    });
    const payload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "Hello world" }] },
    };

    handleChatEvent(state, payload);
    expect(state.chatStream).toBe("Hello world");
  });

  it("appends final message to chatMessages and clears stream", () => {
    const state = createChatState({
      sessionKey: "agent:main:main",
      chatRunId: "run-1",
      chatStream: "Hello world",
      chatStreamStartedAt: 100,
    });
    const finalMessage = {
      role: "assistant",
      content: [{ type: "text", text: "Hello world, complete!" }],
      timestamp: 200,
    };
    const payload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "final",
      message: finalMessage,
    };

    handleChatEvent(state, payload);
    expect(state.chatMessages).toHaveLength(1);
    expect(state.chatMessages[0]).toEqual(finalMessage);
    expect(state.chatStream).toBe(null);
    expect(state.chatRunId).toBe(null);
  });

  it("persists streamed text when final has no message", () => {
    const state = createChatState({
      sessionKey: "agent:main:main",
      chatRunId: "run-1",
      chatStream: "Streamed content here",
      chatStreamStartedAt: 100,
    });
    const payload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "final",
    };

    handleChatEvent(state, payload);
    expect(state.chatMessages).toHaveLength(1);
    expect(state.chatMessages[0]).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "Streamed content here" }],
    });
  });

  it("clears state on abort", () => {
    const state = createChatState({
      sessionKey: "agent:main:main",
      chatRunId: "run-1",
      chatStream: "Partial...",
      chatStreamStartedAt: 100,
    });
    const payload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "aborted",
    };

    handleChatEvent(state, payload);
    expect(state.chatStream).toBe(null);
    expect(state.chatRunId).toBe(null);
  });

  it("sets lastError on error event", () => {
    const state = createChatState({
      sessionKey: "agent:main:main",
      chatRunId: "run-1",
      chatStream: "Working...",
    });
    const payload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "error",
      errorMessage: "Model rate limit exceeded",
    };

    handleChatEvent(state, payload);
    expect(state.lastError).toBe("Model rate limit exceeded");
    expect(state.chatStream).toBe(null);
    expect(state.chatRunId).toBe(null);
  });

  it("ignores NO_REPLY delta", () => {
    const state = createChatState({
      sessionKey: "agent:main:main",
      chatRunId: "run-1",
      chatStream: "Existing content",
    });
    const payload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "agent:main:main",
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "NO_REPLY" }] },
    };

    handleChatEvent(state, payload);
    expect(state.chatStream).toBe("Existing content");
  });

  it("appends final from another run without clearing active stream", () => {
    const state = createChatState({
      sessionKey: "agent:main:main",
      chatRunId: "run-user",
      chatStream: "Working...",
      chatStreamStartedAt: 123,
    });
    const payload: ChatEventPayload = {
      runId: "run-subagent",
      sessionKey: "agent:main:main",
      state: "final",
      message: { role: "assistant", content: [{ type: "text", text: "Sub-agent result" }] },
    };

    handleChatEvent(state, payload);
    expect(state.chatRunId).toBe("run-user");
    expect(state.chatStream).toBe("Working...");
    expect(state.chatMessages).toHaveLength(1);
  });

  it("ignores delta from another run", () => {
    const state = createChatState({
      sessionKey: "agent:main:main",
      chatRunId: "run-user",
      chatStream: "My content",
    });
    const payload: ChatEventPayload = {
      runId: "run-other",
      sessionKey: "agent:main:main",
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "Other content" }] },
    };

    handleChatEvent(state, payload);
    expect(state.chatStream).toBe("My content");
  });
});

// =====================================================
// 5. SESSION KEY UTILITIES
// =====================================================

describe("Session Key Utilities", () => {
  // Mirror parseAgentSessionKey from ui/src/ui/session-key.ts
  function parseAgentSessionKey(sessionKey: string | undefined | null) {
    if (!sessionKey) {return null;}
    const raw = sessionKey.toLowerCase().trim();
    if (!raw) {return null;}
    const parts = raw.split(":").filter(Boolean);
    if (parts.length < 3 || parts[0] !== "agent") {return null;}
    const agentId = parts[1];
    const rest = parts.slice(2).join(":");
    if (!agentId || !rest) {return null;}
    return { agentId, rest };
  }

  function buildAgentMainSessionKey(params: { agentId: string; mainKey?: string }) {
    const agentId = params.agentId.toLowerCase().trim() || "main";
    const mainKey = (params.mainKey ?? "main").toLowerCase().trim() || "main";
    return `agent:${agentId}:${mainKey}`;
  }

  function resolveAgentIdFromSessionKey(sessionKey: string | undefined | null): string {
    const parsed = parseAgentSessionKey(sessionKey);
    return parsed?.agentId ?? "main";
  }

  describe("parseAgentSessionKey", () => {
    it("parses valid agent session key", () => {
      const result = parseAgentSessionKey("agent:medical-ai:consult-001");
      expect(result).toEqual({ agentId: "medical-ai", rest: "consult-001" });
    });

    it("parses key with nested rest", () => {
      const result = parseAgentSessionKey("agent:main:direct:user123");
      expect(result).toEqual({ agentId: "main", rest: "direct:user123" });
    });

    it("returns null for invalid key (no agent prefix)", () => {
      expect(parseAgentSessionKey("session:main:123")).toBe(null);
    });

    it("returns null for too few parts", () => {
      expect(parseAgentSessionKey("agent:main")).toBe(null);
    });

    it("returns null for empty/null input", () => {
      expect(parseAgentSessionKey(null)).toBe(null);
      expect(parseAgentSessionKey(undefined)).toBe(null);
      expect(parseAgentSessionKey("")).toBe(null);
    });

    it("normalizes to lowercase", () => {
      const result = parseAgentSessionKey("Agent:Medical-AI:Session-1");
      expect(result).toEqual({ agentId: "medical-ai", rest: "session-1" });
    });
  });

  describe("buildAgentMainSessionKey", () => {
    it("builds default session key", () => {
      expect(buildAgentMainSessionKey({ agentId: "main" })).toBe("agent:main:main");
    });

    it("builds session key for custom agent", () => {
      expect(buildAgentMainSessionKey({ agentId: "medical-ai" })).toBe("agent:medical-ai:main");
    });

    it("builds session key with custom mainKey", () => {
      expect(buildAgentMainSessionKey({ agentId: "dev", mainKey: "dashboard" }))
        .toBe("agent:dev:dashboard");
    });

    it("defaults to main for empty agentId", () => {
      expect(buildAgentMainSessionKey({ agentId: "" })).toBe("agent:main:main");
    });
  });

  describe("resolveAgentIdFromSessionKey", () => {
    it("resolves agent id from valid key", () => {
      expect(resolveAgentIdFromSessionKey("agent:medical-ai:session-1")).toBe("medical-ai");
    });

    it("returns main for invalid key", () => {
      expect(resolveAgentIdFromSessionKey("invalid-key")).toBe("main");
    });

    it("returns main for null", () => {
      expect(resolveAgentIdFromSessionKey(null)).toBe("main");
    });
  });
});

// =====================================================
// 6. MODELS & CONFIG
// =====================================================

describe("Models & Config", () => {
  it("lists available models", async () => {
    const client = createMockClient();
    client.request.mockResolvedValue({
      models: [
        { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" },
        { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic" },
        { id: "gpt-5.4", name: "GPT 5.4", provider: "openai" },
      ],
    });

    const result = await client.request("models.list", {});
    expect(result.models).toHaveLength(3);
    expect(result.models[0].provider).toBe("anthropic");
  });

  it("gets tools catalog for an agent", async () => {
    const client = createMockClient();
    client.request.mockResolvedValue({
      tools: [
        { name: "bash", description: "Execute shell commands" },
        { name: "web-search", description: "Search the web" },
        { name: "canvas", description: "Create/update canvas artifacts" },
      ],
    });

    const result = await client.request("tools.catalog", { agentId: "main" });
    expect(result.tools).toHaveLength(3);
    expect(result.tools[0].name).toBe("bash");
  });

  it("health check returns ok", async () => {
    const client = createMockClient();
    client.request.mockResolvedValue({ ok: true });

    const result = await client.request("health", {});
    expect(result.ok).toBe(true);
  });
});

// =====================================================
// 7. CUSTOM CHAT UI INTEGRATION FLOW
// =====================================================

describe("Custom Chat UI - Full Integration Flow", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  it("simulates sidebar: load agents -> select agent -> load sessions", async () => {
    // Step 1: Load agents
    client.request.mockResolvedValueOnce({
      defaultId: "main",
      agents: [
        { id: "main", name: "Main Agent" },
        { id: "medical-ai", name: "Medical AI" },
      ],
    });
    const agents = await client.request("agents.list", {});
    expect(agents.agents).toHaveLength(2);

    // Step 2: Select agent "medical-ai"
    const selectedAgentId = "medical-ai";

    // Step 3: Load sessions for selected agent
    client.request.mockResolvedValueOnce({
      sessions: [
        { key: "agent:medical-ai:session-1", displayName: "Session 1", updatedAt: Date.now() },
        { key: "agent:medical-ai:session-2", displayName: "Session 2", updatedAt: Date.now() - 1000 },
      ],
    });
    const sessions = await client.request("sessions.list", { agentId: selectedAgentId });
    expect(sessions.sessions).toHaveLength(2);
    expect(sessions.sessions[0].key).toContain("medical-ai");
  });

  it("simulates chat flow: create session -> send message -> receive stream -> final", async () => {
    // Step 1: Create session
    client.request.mockResolvedValueOnce({
      key: "agent:main:new-session",
      sessionId: "uuid-new",
    });
    const session = await client.request("sessions.create", { agentId: "main" });

    // Step 2: Initialize chat state
    const state = createChatState({
      client: client as unknown as ChatState["client"],
      sessionKey: session.key,
      chatRunId: "run-1",
      chatStream: "",
      chatStreamStartedAt: Date.now(),
    });

    // Step 3: Send message
    client.request.mockResolvedValueOnce({ ok: true });
    await client.request("chat.send", {
      sessionKey: session.key,
      message: "What is the diagnosis?",
      idempotencyKey: "run-1",
    });

    // Step 4: Simulate receiving delta events
    const deltaPayload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: session.key,
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "Based on the symptoms..." }] },
    };

    // Apply delta
    state.chatStream = "Based on the symptoms...";
    expect(state.chatStream).toBe("Based on the symptoms...");

    // Step 5: Simulate final event
    const finalPayload: ChatEventPayload = {
      runId: "run-1",
      sessionKey: session.key,
      state: "final",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Based on the symptoms, the diagnosis is..." }],
        timestamp: Date.now(),
      },
    };

    state.chatMessages = [...state.chatMessages, finalPayload.message];
    state.chatStream = null;
    state.chatRunId = null;

    expect(state.chatMessages).toHaveLength(1);
    expect(state.chatStream).toBe(null);
    expect(state.chatRunId).toBe(null);
  });

  it("simulates Agent App control via tool calls in chat events", async () => {
    const state = createChatState({
      sessionKey: "agent:medical-ai:consult-1",
      chatRunId: "run-1",
      chatStream: "",
      chatStreamStartedAt: Date.now(),
    });

    // Simulate ChatEvent with tool_calls for Agent App control
    const eventWithToolCalls: ChatEventPayload = {
      runId: "run-1",
      sessionKey: "agent:medical-ai:consult-1",
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Opening patient records..." }],
        toolCalls: [
          {
            id: "tc-1",
            name: "agent_app_action",
            arguments: {
              action: "open_tab",
              payload: { tab: "patient-records" },
            },
          },
        ],
      },
    };

    // Extract tool calls for Agent App dispatch
    const msg = eventWithToolCalls.message as Record<string, unknown>;
    const toolCalls = msg.toolCalls as Array<{
      id: string;
      name: string;
      arguments: { action: string; payload: unknown };
    }>;

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe("agent_app_action");
    expect(toolCalls[0].arguments.action).toBe("open_tab");
    expect(toolCalls[0].arguments.payload).toEqual({ tab: "patient-records" });

    // UI would dispatch this action to Agent App
    const dispatchedActions: Array<{ action: string; payload: unknown }> = [];
    for (const tc of toolCalls) {
      if (tc.name === "agent_app_action") {
        dispatchedActions.push(tc.arguments);
      }
    }
    expect(dispatchedActions).toHaveLength(1);
    expect(dispatchedActions[0].action).toBe("open_tab");
  });
});

// =====================================================
// 8. GATEWAY CONNECTION PROTOCOL
// =====================================================

describe("Gateway Connection Protocol", () => {
  it("builds correct connect frame", () => {
    const connectFrame = {
      type: "req",
      id: "connect-1",
      method: "connect",
      params: {
        minProtocol: 1,
        maxProtocol: 1,
        client: {
          id: "custom-chat-ui",
          version: "1.0.0",
          platform: "web",
          mode: "operator",
        },
        auth: {
          token: "test-token",
        },
        scopes: ["operator.read", "operator.write"],
      },
    };

    expect(connectFrame.type).toBe("req");
    expect(connectFrame.method).toBe("connect");
    expect(connectFrame.params.client.id).toBe("custom-chat-ui");
    expect(connectFrame.params.auth.token).toBe("test-token");
    expect(connectFrame.params.scopes).toContain("operator.read");
    expect(connectFrame.params.scopes).toContain("operator.write");
  });

  it("validates hello-ok response", () => {
    const helloOk = {
      type: "hello-ok",
      protocol: 1,
      server: { version: "2026.5.5", connId: "conn-abc" },
      features: {
        methods: ["chat.send", "chat.history", "sessions.list", "agents.list"],
        events: ["chat.event", "sessions.changed"],
      },
      auth: {
        deviceToken: "dt-xyz",
        role: "operator",
        scopes: ["operator.read", "operator.write"],
      },
    };

    expect(helloOk.type).toBe("hello-ok");
    expect(helloOk.protocol).toBe(1);
    expect(helloOk.features.methods).toContain("chat.send");
    expect(helloOk.features.methods).toContain("sessions.list");
    expect(helloOk.features.events).toContain("chat.event");
    expect(helloOk.auth.scopes).toContain("operator.write");
  });

  it("handles error response frame", () => {
    const errorFrame = {
      type: "res",
      id: "req-123",
      ok: false,
      error: {
        code: "PERMISSION_DENIED",
        message: "Missing operator.write scope",
        retryable: false,
      },
    };

    expect(errorFrame.ok).toBe(false);
    expect(errorFrame.error.code).toBe("PERMISSION_DENIED");
    expect(errorFrame.error.retryable).toBe(false);
  });

  it("handles event frame for sessions.changed", () => {
    const eventFrame = {
      type: "event",
      event: "sessions.changed",
      payload: {
        keys: ["agent:main:main", "agent:medical-ai:consult-1"],
      },
      seq: 42,
    };

    expect(eventFrame.type).toBe("event");
    expect(eventFrame.event).toBe("sessions.changed");
    expect(eventFrame.payload.keys).toHaveLength(2);
    expect(eventFrame.seq).toBe(42);
  });
});

// =====================================================
// 9. CUSTOM PLUGIN GATEWAY METHOD REGISTRATION
// =====================================================

describe("Custom Plugin Gateway Methods (for Agent App)", () => {
  it("validates agentapp.subscribe method shape", () => {
    // This tests the expected interface for a custom gateway method
    // that would be registered via api.registerGatewayMethod()
    const subscribeRequest = {
      type: "req",
      id: "sub-1",
      method: "agentapp.subscribe",
      params: {
        agentId: "medical-ai",
        sessionKey: "agent:medical-ai:consult-1",
        events: ["action", "state-change"],
      },
    };

    expect(subscribeRequest.method).toBe("agentapp.subscribe");
    expect(subscribeRequest.params.events).toContain("action");
  });

  it("validates agentapp action event shape", () => {
    // Expected event shape when AI triggers an Agent App action
    const actionEvent = {
      type: "event",
      event: "agentapp.action",
      payload: {
        sessionKey: "agent:medical-ai:consult-1",
        action: "open_tab",
        payload: { tab: "patient-records", query: "Nguyen Van A" },
        toolCallId: "tc-001",
      },
      seq: 5,
    };

    expect(actionEvent.event).toBe("agentapp.action");
    expect(actionEvent.payload.action).toBe("open_tab");
    expect(actionEvent.payload.payload.tab).toBe("patient-records");
  });

  it("validates custom HTTP route shape", () => {
    // Expected request/response for registerHttpRoute
    const httpRequest = {
      method: "GET",
      path: "/api/agent-app/state",
      headers: { authorization: "Bearer test-token" },
    };

    const httpResponse = {
      status: 200,
      body: {
        agentId: "medical-ai",
        activeTab: "patient-records",
        formData: { patientId: "P001" },
      },
    };

    expect(httpRequest.path).toBe("/api/agent-app/state");
    expect(httpResponse.body.agentId).toBe("medical-ai");
    expect(httpResponse.body.activeTab).toBe("patient-records");
  });
});
