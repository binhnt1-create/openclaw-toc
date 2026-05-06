# Rebase Strategy — TOC POC vs Upstream Versions

Mục tiêu: đảm bảo các thay đổi POC (`tuandh/poc_custom_openclaw`) có thể áp dụng sạch lên từng release mới của openclaw gốc, phát hiện conflict sớm trước khi merge vào production.

Với mỗi version, tạo:

- File phân tích `dev-docs/rebase/$VERSION.md` — summary + risk assessment
- Branch `rebase-vs-$VERSION` từ POC branch để test thực tế

---

## One-time Setup

```bash
# Thêm upstream remote trỏ về repo openclaw gốc
git remote add upstream git@github.com:openclaw/openclaw.git

# Fetch tất cả tags từ upstream
git fetch upstream --tags
```

Kiểm tra remote:

```bash
git remote -v
# upstream  git@github.com:openclaw/openclaw.git (fetch)
# origin    git@github-firegroup:try-open-claw-io/openclaw-toc.git (push)
```

---

## Xác định POC commits cần carry

Các commit POC hiện tại trên branch `tuandh/poc_custom_openclaw` so với `origin/main`:

```
3c4d83e  chore: fast_commit
e90ba28  fix: rollback
f9c38af  fix: rollback change
7f38a82  feat(toc): POC skill mention layer for TOC chat UI
```

Lấy danh sách commit hash để tham khảo:

```bash
git log origin/main..tuandh/poc_custom_openclaw --reverse --oneline
```

---

## Per-Version Rebase Flow

### Bước 0 — Đọc release notes & tạo file phân tích

```bash
VERSION=v2026.5.4   # thay version tương ứng
gh release view $VERSION --repo openclaw/openclaw
```

Dán output vào AI với prompt:

```
So sánh release notes này với POC changelog (poc-toc-skill-mention.md).
Chỉ quan tâm các file POC touch: views/chat.ts, app-chat.ts, styles/chat.css.
Với mỗi thay đổi liên quan, đánh giá rủi ro conflict:
  🔴 CAO — upstream thay đổi đúng vùng POC inject
  🟡 TRUNG — upstream thay đổi file POC touch nhưng vùng khác
  🟢 THẤP — không ảnh hưởng trực tiếp
```

**Tạo file `dev-docs/rebase/$VERSION.md`** theo template (xem [Template](#template-file-phân-tích)).
Ghi đủ summary và risk table trước khi tiếp tục.

### Bước 1 — Tạo branch từ POC branch

```bash
# Tạo branch rebase từ POC (không phải từ upstream tag)
git checkout -b rebase-vs-$VERSION tuandh/poc_custom_openclaw
```

### Bước 2 — Rebase POC commits lên upstream tag

```bash
git fetch upstream --tags

# Rebase các commit POC (sau origin/main) lên trên upstream tag
git rebase --onto $VERSION origin/main
```

Nếu có conflict:

```bash
git status                  # xem file bị conflict
# fix conflict dựa trên risk assessment trong dev-docs/rebase/$VERSION.md
git add <files>
git rebase --continue
```

### Bước 3 — Verify

```bash
pnpm install     # nếu package.json thay đổi
pnpm check       # lint + typecheck
pnpm build       # nếu có thay đổi liên quan đến build output
```

### Bước 4 — Cập nhật file phân tích & push

Điền kết quả thực tế vào `dev-docs/rebase/$VERSION.md` (phần **Kết quả**), rồi:

```bash
git push origin rebase-vs-$VERSION
```

Cập nhật bảng Status bên dưới.

---

## Status

| Version     | File phân tích                             | Branch                  | Conflict | Ghi chú        |
| ----------- | ------------------------------------------ | ----------------------- | -------- | -------------- |
| v2026.5.4   | [rebase/v2026.5.4.md](rebase/v2026.5.4.md) | `rebase-vs-v2026.5.4`   | —        | Chưa thực hiện |
| v2026.5.3-1 | —                                          | `rebase-vs-v2026.5.3-1` | —        | Chưa thực hiện |
| v2026.5.3   | —                                          | `rebase-vs-v2026.5.3`   | —        | Chưa thực hiện |
| v2026.5.2   | —                                          | `rebase-vs-v2026.5.2`   | —        | Chưa thực hiện |
| v2026.4.29  | —                                          | `rebase-vs-v2026.4.29`  | —        | Chưa thực hiện |

---

## Template file phân tích

Mỗi file `dev-docs/rebase/$VERSION.md` theo cấu trúc:

```markdown
# Rebase Analysis — $VERSION

- Ngày release: YYYY-MM-DD
- Release URL: https://github.com/openclaw/openclaw/releases/tag/$VERSION

## Summary upstream changes

(Tóm tắt ngắn các thay đổi lớn của version này)

## Risk Assessment

| Thay đổi upstream | File | Injection point | Rủi ro   |
| ----------------- | ---- | --------------- | -------- |
| ...               | ...  | ...             | 🔴/🟡/🟢 |

## Điểm cần kiểm tra

(Mô tả cụ thể những chỗ phải xem sau rebase)

## Kết quả

- Branch: `rebase-vs-$VERSION`
- Ngày thực hiện: —
- Conflict xảy ra: Có / Không
- Files bị conflict: —
- Cách resolve: —
- pnpm check: ✅ / ❌
```

---

## Conflict Resolution Guide

### 9 injection points cần bảo toàn trong `chat.ts`

Xem chi tiết tại [poc-toc-skill-mention.md](poc-toc-skill-mention.md#modified-files).

```ts
// 1. Import block
import { handleMentionKeyDown, renderFuncButton, renderMentionMenu,
         renderSkillBadgeBar, sendWithSkills, tryRenderSkillMessage,
         updateMentionMenu } from "../chat/input-bar-extras.ts";

// 2. Message loop — trước renderMessageGroup
const skillMsg = tryRenderSkillMessage(item);
if (skillMsg !== nothing) return skillMsg;

// 3. handleKeyDown — dòng đầu tiên
if (handleMentionKeyDown(e, props, requestUpdate)) return;

// 4. handleKeyDown — Enter to send
sendWithSkills(props, inputHistory);

// 5. handleInput — sau updateSlashMenu
updateMentionMenu(target.value, requestUpdate);

// 6. Input bar template — trước renderSlashMenu
${renderMentionMenu(requestUpdate, props)} ${renderSlashMenu(requestUpdate, props)}
${renderAttachmentPreview(props)}

// 7. Input bar template — trên textarea
${renderSkillBadgeBar(requestUpdate)}

// 8. Toolbar-left — button đầu tiên
${renderFuncButton(requestUpdate, props)}

// 9. Send button @click
@click=${() => sendWithSkills(props, inputHistory)}
```

### File không bao giờ conflict (new files)

- `ui/src/ui/chat/input-bar-extras.ts`
- `ui/src/ui/chat/toc-slash-commands.ts`
- `ui/src/styles/chat/input-bar-extras.css`
- `dev-docs/`
