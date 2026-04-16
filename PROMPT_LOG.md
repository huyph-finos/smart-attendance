# PROMPT LOG — Smart Attendance

Ghi lại quá trình làm việc với AI IDE (Claude Code) trong suốt dự án.

---

## Session 1: Day 1 — Foundation Setup

### Prompt 1: Project Planning
**Prompt**: "Review đề bài @de-bai-smart-attendance-v2.docx lên plan cho toàn bộ bài tập. Tận dụng tối đa mô hình AI trong quá trình implement. Xem xét xây dựng mô hình Agentic chuẩn chỉnh"

**Kết quả**:
- AI phân tích đề bài → plan chi tiết 5 ngày
- Thiết kế Agentic AI architecture (5 agents, 8 tools, agentic loop)
- Database schema 14 tables, anti-fraud multi-layer scoring
- Đề xuất creative features: Mood Check-in, AI Daily Briefing, Branch Leaderboard

### Prompt 2: Tech Stack Selection
**Prompt**: Interactive Q&A (4 câu hỏi) → Chọn tất cả recommended options
- Next.js + NestJS, AI Agent toàn diện, Multi-layer anti-fraud, PWA

### Prompt 3: Foundation Implementation
**Prompt**: "Approve plan → bắt đầu implement"

**AI Generated** (Day 1):
- Monorepo: pnpm workspaces + Turborepo
- Backend: NestJS 11 — 8 modules (auth, users, branches, attendance, reports, dashboard, ai, notifications)
- Prisma schema: 14 models, seed 100 branches + 5000 employees
- Anti-fraud service: 4-layer scoring engine (WiFi/GPS/Device/Speed)
- AI Agent: Claude API + Tool Use, 5 agents, 8 tools, agentic loop
- Frontend: Next.js 16 + shadcn/ui — 15 pages
- Docker: multi-stage builds + docker-compose

**Review**: Sửa minor issues — array typing, uuid import, Prisma client output path

---

## Session 2: Day 2 — Core UI Pages

### Prompt 4: Branch/Employee/Reports UI
**Prompt**: "Tạo pages cho branch management, employee management, reports, leaves, anomalies, settings"

**AI Generated** (Day 2):
- 7 new pages: branches (list/detail/create), employees (list/detail/create), reports (tabbed), leaves, anomalies, settings
- shadcn/ui Dialog + Textarea components
- Role-based visibility on sidebar
- Pagination, filters, search across all pages

---

## Session 3: Day 3 — PWA + API Fixes + Creative Features

### Prompt 5: Login Bug Fix
**User report**: "API trả về token nhưng frontend báo Login failed"
**Root cause**: Frontend expects `response.data.data` nhưng API trả trực tiếp
**Fix**: `res.data ?? res` fallback pattern trên tất cả 14 pages + stores

### Prompt 6: PWA + Leaves Backend + Creative Features
**AI Generated** (Day 3):
- PWA: manifest.json, service worker, offline store, offline page
- Leaves backend: 5 endpoints (CRUD + approve/reject)
- Branch Leaderboard widget (top 10, gold/silver/bronze)
- Real-time clock widget, enhanced mood selector, manager stats banner

---

## Session 4: Day 4 — AI System Polish + Missing Backends

### Prompt 7: AI Chatbot Enhancement
**AI Generated**:
- Markdown rendering cho AI responses
- Enhanced tool-use cards (collapsible JSON, color-coded)
- Conversation history sidebar
- Typing indicator animation
- AI Insights page (3 auto-generated analysis cards)

### Prompt 8: Backend Completion
**AI Generated**:
- AnomaliesModule: paginated list, stats, resolve flow
- ShiftsModule: CRUD templates, bulk assign, weekly schedule
- NotificationBell component with real-time polling
- Mark-all-read endpoint

---

## Session 5: Day 5 — Final Polish + Release

### Prompt 9: Seed Enhancement + Documentation
**AI Generated**:
- Enhanced seed: anomalies, leaves, daily summaries, notifications
- Updated PROMPT_LOG.md (this file)
- Updated README with complete feature list
- Release: merge to main, tag v1.0.0

---

## Session 6: Day 6 — Testing, Review & Improvement

### Prompt 10: Test, Review & Improve Plan
**Prompt**: "lên plan test, review, improve sản phẩm"

**AI Generated**:
- Plan toàn diện 3 phase: TEST → REVIEW → IMPROVE
- Phát hiện 6 vấn đề security, 3 vấn đề performance (N+1), 4 vấn đề architecture
- Xác định 15 cải tiến cụ thể theo độ ưu tiên

### Prompt 11: Execute Plan
**Kết quả**:

**Phase 1 — Testing**:
- Setup Vitest + SWC + mock helpers cho backend
- Viết 69 unit tests across 6 test files:
  - `geo.spec.ts` (8 tests): Haversine distance, geofencing, travel speed
  - `time.spec.ts` (12 tests): parseTime, isLate, workHours, overtime
  - `anti-fraud.service.spec.ts` (10 tests): 4 fraud layers + composite scoring
  - `auth.service.spec.ts` (8 tests): login/refresh/logout flows
  - `attendance.service.spec.ts` (13 tests): check-in/out, fraud blocking, caching
  - `tool-executor.spec.ts` (8 tests): AI tool execution, role scoping
- Tất cả 69/69 tests PASS

**Phase 2 — Review** (phát hiện):
- **CRITICAL**: JWT secret mặc định trong docker-compose
- **HIGH**: Không rate limiting cho login (brute force), N+1 queries (200→500 queries per request)
- **MEDIUM**: Global Filter/Interceptor chưa register, magic numbers trong anti-fraud

**Phase 3 — Improvements** (đã implement):
- Health check endpoint (`GET /api/v1/health`) — DB + Redis + uptime + memory
- Rate limiting toàn cục (`@nestjs/throttler`) — 100 req/min, login 5 req/min
- Fix N+1 queries: dashboard heatmap (200→3 queries), trends (60→2), reports (500→6)
- Global error codes (`ErrorCode` enum trong shared package)
- Register global `AllExceptionsFilter` + `TransformInterceptor` trong main.ts
- CI/CD Pipeline (GitHub Actions) — lint, test, build, security audit
- Extract anti-fraud magic numbers → shared constants (`FRAUD_THRESHOLDS`, `SPEED_THRESHOLDS`)
- Prisma slow query logging (dev mode, >500ms warning)
- Redis error handling + auto reconnection
- Bỏ default JWT secret trong docker-compose (security fix)
- Enhanced exception filter: stack trace logging, error codes, structured response

### Prompt 12: Kiểm tra đề bài
**Prompt**: "kiểm tra de-bai-smart-attendance-v2.docx xem cần update gì ko"

**Kết quả**: Audit toàn bộ 19 tiêu chí đề bài → 18/19 đạt, chỉ thiếu demo video

---

## Session 7: Day 7 — Comprehensive Logic Audit & Bug Fix

### Prompt 13: Review Check-in DTO
**Prompt**: "/review @packages/backend/src/modules/attendance/dto/check-in.dto.ts"

**Kết quả**:
- Review DTO validation: phát hiện thiếu `@MaxLength()` trên string fields, redundant `@IsNumber()`
- Cảnh báo `mockLocationDetected` là client-supplied — không nên trust

### Prompt 14: Kiểm tra lỗi logic trang check-in
**Prompt**: "kiểm tra lỗi logic ở trang check-in"

**Kết quả**: Phát hiện **6 bugs** trên trang attendance:
1. **CRITICAL**: WiFi field name mismatch (`wifiSSID`→`wifiSsid`, `wifiBSSID`→`wifiBssid`) — WiFi data không bao giờ tới backend
2. **CRITICAL**: `mood` không được gửi trong payload — mood picker chỉ là UI trang trí
3. **CRITICAL**: `todayAttendance` sai shape sau check-in — store lưu `{ attendance, fraudCheck }` nhưng page đọc trực tiếp `checkInTime`
4. **MODERATE**: Fraud score path sai (`result.fraudScore` → `result.fraudCheck.score`)
5. **MODERATE**: Không validate GPS ready trước check-in — gửi tọa độ (0, 0)
6. **MINOR**: `buildPayload` không bao giờ return null — dead null guard

### Prompt 15: Fix + Review toàn bộ pages bằng parallel subagents
**Prompt**: "fix trang này, sau đó lên kế hoạch review lại toàn bộ các page khác. giao cho các subagent phối hợp hoạt động, review-fix-verify"

**Phương pháp**: Launch **5 subagents song song**, mỗi agent review 1 nhóm pages:
- Agent 1: Auth + core pages (login, landing, dashboard home, auth store, api-client)
- Agent 2: Employee + Branch CRUD pages (6 pages)
- Agent 3: AI chatbot + AI insights + Reports (4 pages)
- Agent 4: Leaves + Anomalies + Settings + Attendance history (4 pages)
- Agent 5: Hooks + libs + layout + service worker (9 files)

**Kết quả tổng hợp — 35 bugs across 18 files**:

| Category | CRITICAL | MODERATE | MINOR |
|----------|----------|----------|-------|
| Check-in page | 3 | 2 | 1 |
| Auth + API client | 1 | 1 | 2 |
| Employee/Branch pages | 2 | 4 | 2 |
| Leaves page | 1 | 0 | 0 |
| Anomalies page | 0 | 2 | 0 |
| Attendance history | 1 | 1 | 0 |
| Reports page | 6 | 1 | 1 |
| AI insights/chatbot | 1 | 1 | 1 |
| AI rate limit (backend) | 1 | 0 | 0 |
| Offline sync | 1 | 0 | 0 |
| XSS security | 0 | 2 | 0 |
| **Total** | **17** | **14** | **7** |

**Bugs nổi bật**:
- Reports page **hoàn toàn không hoạt động** — gọi sai endpoint, sai params, sai field names
- Logout **không invalidate refresh token server-side** — token sống 7 ngày sau logout
- Redis rate limit TTL **bị mất khi increment** — user bị lock vĩnh viễn
- Offline sync dùng raw `fetch()` sai URL, không auth, sai body shape
- XSS qua `dangerouslySetInnerHTML` trong AI markdown renderer

**Verification**: TypeScript compile 0 errors (frontend + backend)

### Prompt 16: Cập nhật docs, commit và push
**Prompt**: "cập nhật docs, commit và push"
- Cập nhật CLAUDE.md: thêm Frontend-Backend Contract section
- Commit `c36a4e3`: 21 files changed, 270 insertions, 169 deletions
- Push to `origin/main`

---

## Thống Kê AI Usage

| Metric | Value |
|--------|-------|
| Total prompts | ~22 major prompts |
| Source files generated | 140+ |
| Lines of code | ~51,000+ |
| Test files | 6 files, 69 tests |
| Bugs found & fixed (Day 7) | 35 bugs across 18 files (17 CRITICAL) |
| AI code generation rate | ~95% |
| Manual fixes | ~5% (type issues, import paths, response parsing) |
| Time saved estimate | 4-5x so với manual coding |
| Performance improvement | N+1 fix: 500→6 queries (99% reduction) |
| Parallel subagent review | 5 agents, ~18 pages, ~2 min total |

## Key Learnings

1. **Context file (CLAUDE.md) cực kỳ quan trọng** — giúp AI hiểu conventions, tech stack, patterns
2. **Plan trước, implement sau** — Claude Code plan mode giúp align approach trước khi code
3. **AI rất mạnh ở scaffolding** — sinh ra 8 NestJS modules + 16 pages trong vài giờ
4. **Manual review vẫn cần** — API response format mismatch chỉ phát hiện khi test thực tế
5. **Agentic AI là highlight** — Claude API Tool Use pattern tạo ra AI chatbot thực sự query database
6. **Parallel agents** — Chạy nhiều sub-agents song song tăng tốc đáng kể
7. **AI review phát hiện issues sâu** — N+1 queries, security gaps, missing global filters mà manual review dễ bỏ sót
8. **Test-driven improvement** — Viết tests trước giúp refactor an toàn (magic numbers → constants không break logic)
9. **AI-generated code cần AI-reviewed** — 95% code do AI sinh ra nhưng có 35 logic bugs (field name mismatch, sai endpoint, sai response shape) mà chỉ cross-layer review mới phát hiện
10. **Parallel subagent review cực hiệu quả** — 5 agents review 18 pages + 9 shared modules trong ~2 phút, phát hiện bugs mà sequential review dễ bỏ sót do context fatigue
