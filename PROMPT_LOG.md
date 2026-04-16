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

## Thống Kê AI Usage

| Metric | Value |
|--------|-------|
| Total prompts | ~15 major prompts |
| Source files generated | 130+ |
| Lines of code | ~35,000+ |
| AI code generation rate | ~95% |
| Manual fixes | ~5% (type issues, import paths, response parsing) |
| Time saved estimate | 4-5x so với manual coding |

## Key Learnings

1. **Context file (CLAUDE.md) cực kỳ quan trọng** — giúp AI hiểu conventions, tech stack, patterns
2. **Plan trước, implement sau** — Claude Code plan mode giúp align approach trước khi code
3. **AI rất mạnh ở scaffolding** — sinh ra 8 NestJS modules + 16 pages trong vài giờ
4. **Manual review vẫn cần** — API response format mismatch chỉ phát hiện khi test thực tế
5. **Agentic AI là highlight** — Claude API Tool Use pattern tạo ra AI chatbot thực sự query database
6. **Parallel agents** — Chạy nhiều sub-agents song song tăng tốc đáng kể
