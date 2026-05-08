# Custom Chat UI - Hướng dẫn cài đặt

Hướng dẫn cấu hình OpenClaw Gateway để kết nối WebSocket từ custom UI (toc-uiux-prototype).

---

## 1. Yêu cầu hệ thống

- **Node.js >= 22.14.0** (OpenClaw yêu cầu)
- **OpenClaw** đã build (`pnpm build` trong openclaw-toc)
- **Custom UI** chạy trên port 4002 (Next.js)

```bash
# Chuyển Node version
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22
```

---

## 2. Cấu hình `~/.openclaw/openclaw.json`

### 2.1 Gateway auth token (BẮT BUỘC)

Thêm `gateway.auth.token` để client xác thực:

```json
{
  "gateway": {
    "auth": {
      "token": "devtoken"
    }
  }
}
```

**Tại sao**: Không có token thì client kết nối được nhưng `sharedAuthOk = false` → scopes bị xoá → mọi RPC call trả về "missing scope".

**File liên quan**: `src/gateway/role-policy.ts:14-16`

```
roleCanSkipDeviceIdentity(role, sharedAuthOk)
  = role === "operator" && sharedAuthOk
```

### 2.2 Tắt device auth cho POC (BẮT BUỘC cho browser)

```json
{
  "gateway": {
    "controlUi": {
      "dangerouslyDisableDeviceAuth": true
    }
  }
}
```

**Tại sao**: Browser client không có SubtleCrypto device identity (cần HTTPS). Flag này cho phép operator role giữ scopes khi dùng token auth mà không cần device keypair.

**File liên quan**: `src/gateway/server/ws-connection/connect-policy.ts:121-127`

```
if (isControlUi && controlUiAuthPolicy.allowBypass && role === "operator") {
  return { kind: "allow" };  // ← bỏ qua device identity check
}
```

**CHÚ Ý**: Chỉ dùng cho dev/POC. Production nên dùng HTTPS + device identity.

### 2.3 Allowed origins (BẮT BUỘC cho browser)

Thêm origin của custom UI vào whitelist:

```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": ["http://localhost:18789", "http://localhost:4002"]
    }
  }
}
```

**Tại sao**: Gateway kiểm tra `Origin` header của WebSocket request. Nếu origin không nằm trong danh sách → từ chối kết nối.

**File liên quan**: `src/gateway/origin-check.ts`

### 2.4 Cấu hình đầy đủ (mẫu)

```json
{
  "gateway": {
    "mode": "local",
    "bind": "lan",
    "auth": {
      "token": "devtoken"
    },
    "controlUi": {
      "dangerouslyDisableDeviceAuth": true,
      "allowedOrigins": [
        "http://localhost:18789",
        "http://127.0.0.1:18789",
        "http://localhost:4002"
      ]
    }
  }
}
```

---

## 3. Tham số kết nối của client (BẮT BUỘC)

WebSocket client PHẢI gửi đúng connect frame. Sai bất kỳ field nào thì bị từ chối.

### 3.1 Phiên bản giao thức

```
minProtocol: 3
maxProtocol: 3
```

**Tại sao**: Gateway đang ở protocol v3. Gửi v1 → lỗi "protocol mismatch".

**File liên quan**: `src/gateway/protocol/schema/protocol-schemas.ts:369`

### 3.2 Định danh client

```json
{
  "client": {
    "id": "openclaw-control-ui",
    "version": "0.1.0",
    "platform": "web",
    "mode": "webchat"
  }
}
```

**Các giá trị hợp lệ**:

| Field  | Giá trị chấp nhận                                                                                                                                                                   | File                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `id`   | `webchat-ui`, `openclaw-control-ui`, `webchat`, `cli`, `gateway-client`, `openclaw-macos`, `openclaw-ios`, `openclaw-android`, `node-host`, `test`, `fingerprint`, `openclaw-probe` | `src/gateway/protocol/client-info.ts:3-17`  |
| `mode` | `webchat`, `cli`, `ui`, `backend`, `node`, `probe`, `test`                                                                                                                          | `src/gateway/protocol/client-info.ts:25-33` |

**Tại sao dùng `openclaw-control-ui` + `webchat`**:

- `isControlUi = true` → `dangerouslyDisableDeviceAuth` có tác dụng
- `gateway-client` + `backend` không phải Control UI → flag bị bỏ qua
- `gateway-client` + `backend` chỉ bỏ qua scope clear khi **không có Origin header** (Node.js client OK, browser KHÔNG OK)

### 3.3 Role và scopes

```json
{
  "role": "operator",
  "scopes": ["operator.read", "operator.write"]
}
```

### 3.4 Connect frame đầy đủ

```json
{
  "type": "req",
  "id": "connect-1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "openclaw-control-ui",
      "version": "0.1.0",
      "platform": "web",
      "mode": "webchat"
    },
    "role": "operator",
    "auth": {
      "token": "devtoken"
    },
    "scopes": ["operator.read", "operator.write"]
  }
}
```

---

## 4. Hệ thống phân quyền (Scope)

Mỗi RPC method yêu cầu một scope cụ thể. Client phải có scope đó trong `auth.scopes` của hello-ok response.

### Bảng Scope → Methods

| Scope            | Các method chính                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `operator.read`  | `agents.list`, `sessions.list`, `chat.history`, `models.list`, `tools.catalog`, `config.get`, `health` |
| `operator.write` | `chat.send`, `chat.abort`, `sessions.create`, `sessions.send`, `agent`, `agent.wait`                   |
| `operator.admin` | `sessions.delete`, `sessions.patch`, `agents.create`, `agents.update`, `config.set`, `chat.inject`     |

**File đầy đủ**: `src/gateway/method-scopes.ts:42-177`

**Logic phân quyền** (dòng 238-256):

- `operator.admin` vượt qua tất cả kiểm tra
- `operator.write` cũng bao gồm các method của `operator.read`
- Method không được phân loại → yêu cầu `operator.admin`

### Luồng xử lý scope

```
Client gửi scopes: ["operator.read", "operator.write"]
    |
    v
Gateway xác minh:
  1. Token khớp? → sharedAuthOk = true
  2. Có device identity? HOẶC dangerouslyDisableDeviceAuth = true?
  3. Nếu OK → giữ nguyên scopes
  4. Nếu KHÔNG → clearUnboundScopes() → scopes = []
    |
    v
hello-ok response: auth.scopes = ["operator.read", "operator.write"]
    |
    v
Mỗi RPC call: authorizeOperatorScopesForMethod(method, scopes)
  - "agents.list" → cần "operator.read" → OK
  - "chat.send" → cần "operator.write" → OK
  - "sessions.delete" → cần "operator.admin" → FAIL
```

---

## 5. Khởi động Gateway

```bash
cd openclaw-toc

# Cách 1: Chạy trực tiếp (foreground)
OPENCLAW_SKIP_BUILD=1 node dist/entry.js gateway

# Cách 2: Qua pnpm
pnpm openclaw gateway

# Kiểm tra
curl http://127.0.0.1:18789/healthz
# → {"ok":true,"status":"live"}
```

**Port mặc định**: `18789` (cấu hình: `gateway.port` hoặc biến môi trường `OPENCLAW_GATEWAY_PORT`)

**QUAN TRỌNG**: Sau khi thay đổi `openclaw.json`, PHẢI khởi động lại gateway:

```bash
pkill -f "openclaw-gateway"
pkill -f "openclaw$"
OPENCLAW_SKIP_BUILD=1 node dist/entry.js gateway
```

---

## 6. Cấu hình `.env` của Custom UI

```
NEXT_PUBLIC_OPENCLAW_WS_URL=ws://localhost:18789
NEXT_PUBLIC_OPENCLAW_TOKEN=devtoken
```

Token phải khớp với `gateway.auth.token` trong `openclaw.json`.

---

## 7. Kiểm tra kết nối

### Kiểm tra từ Node.js

```bash
cd toc-uiux-prototype
node tests/gateway-agents-list.test.mjs
```

Kết quả mong đợi: 14/14 passed.

### Kiểm tra từ browser

Mở `http://localhost:4002`, kiểm tra console:

```
[openclaw-gw] connected { type: "hello-ok", ..., auth: { scopes: ["operator.read", "operator.write"] } }
```

Nếu `auth.scopes: []` → xem lại Mục 2.

---

## 8. Xử lý lỗi thường gặp

| Lỗi                                     | Nguyên nhân                             | Cách sửa                                      |
| --------------------------------------- | --------------------------------------- | --------------------------------------------- |
| `protocol mismatch`                     | `minProtocol/maxProtocol` sai           | Đặt giá trị `3`                               |
| `invalid connect params: at /client/id` | Client id không hợp lệ                  | Dùng `openclaw-control-ui`                    |
| `origin not allowed`                    | Origin chưa có trong whitelist          | Thêm vào `allowedOrigins`                     |
| `control ui requires device identity`   | `dangerouslyDisableDeviceAuth` chưa bật | Thêm flag vào cấu hình                        |
| `missing scope: operator.read`          | `auth.scopes = []`                      | Kiểm tra token + dangerouslyDisableDeviceAuth |
| `connect ECONNREFUSED`                  | Gateway chưa chạy                       | Khởi động gateway                             |
| `Maximum update depth exceeded`         | React vòng lặp vô hạn                   | Bọc function trong `useCallback`              |

---

## 9. Các file đã thay đổi trong toc-uiux-prototype

| File                                                | Vai trò                                         |
| --------------------------------------------------- | ----------------------------------------------- |
| `.env`                                              | URL và token của Gateway                        |
| `lib/openclaw-gateway.js`                           | Lớp WebSocket client                            |
| `hooks/useOpenClawGateway.js`                       | React hook bọc kết nối gateway                  |
| `hooks/useDashboardState.js`                        | Thêm `syncGatewayAgents()`                      |
| `contexts/OpenClawGatewayContext.js`                | React context cho Gateway                       |
| `components/layout/DashboardShell.js`               | `GatewayAgentsBridge` đồng bộ agents + sessions |
| `components/dashboard/chat/ChatInputPlaceholder.js` | Gửi/nhận tin nhắn qua gateway                   |
| `tests/gateway-agents-list.test.mjs`                | Integration test 14 trường hợp                  |

---

## 10. Bảng tham chiếu cấu hình

| Đường dẫn cấu hình                               | Mô tả                      | Mặc định    |
| ------------------------------------------------ | -------------------------- | ----------- |
| `gateway.port`                                   | Cổng Gateway               | `18789`     |
| `gateway.bind`                                   | Địa chỉ bind               | `localhost` |
| `gateway.auth.token`                             | Token xác thực chung       | (không có)  |
| `gateway.auth.password`                          | Mật khẩu chung             | (không có)  |
| `gateway.controlUi.dangerouslyDisableDeviceAuth` | Bỏ qua device identity     | `false`     |
| `gateway.controlUi.allowedOrigins`               | Danh sách origin được phép | `[]`        |
| `gateway.controlUi.allowInsecureAuth`            | Cho phép HTTP localhost    | `false`     |
