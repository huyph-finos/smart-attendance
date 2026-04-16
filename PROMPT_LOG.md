# PROMPT LOG — Smart Attendance

Ghi lại quá trình làm việc với AI IDE (Claude Code) trong suốt dự án.

---

## Session 1: Foundation Setup (Day 1)

### Prompt 1: Project Planning
**Prompt**: "Review đề bài @de-bai-smart-attendance-v2.docx lên plan cho toàn bộ bài tập. Tận dụng tối đa mô hình AI trong quá trình implement. Xem xét xây dựng mô hình Agentic chuẩn chỉnh"

**Kết quả**:
- AI phân tích đề bài và đưa ra plan chi tiết 5 ngày
- Thiết kế kiến trúc Agentic AI với 5 specialized agents
- Thiết kế Database schema với 14 tables, optimized indexes
- Thiết kế Anti-fraud multi-layer scoring system
- Đề xuất creative features: Mood Check-in, AI Daily Briefing, Branch Leaderboard

### Prompt 2: Tech Stack Selection
**Prompt**: Interactive Q&A về tech stack, mức độ AI, anti-fraud level, platform

**Kết quả**: Chọn Next.js + NestJS, AI Agent toàn diện, Multi-layer anti-fraud, PWA

### Prompt 3: Implementation Start
**Prompt**: Approve plan → Start Day 1 Foundation

**Kết quả** (AI generated code):
1. **Monorepo setup**: pnpm workspaces + Turborepo config + shared package
2. **Backend scaffold**: 
   - Full Prisma schema (14 models, enums, indexes)
   - NestJS modules: Auth (JWT+refresh), Users, Branches, Attendance (anti-fraud), Reports, Dashboard, AI, Notifications
   - Anti-fraud service with 4-layer scoring engine
   - AI Agent orchestrator with Claude API Tool Use pattern
   - 8 tool definitions + executor for agentic loop
   - WebSocket notifications gateway
3. **Frontend scaffold**:
   - Next.js 16 App Router with auth layouts
   - Login page, Dashboard, Attendance check-in, History, AI Hub, AI Chatbot
   - Zustand stores, API client with token refresh
   - Custom hooks: geolocation, WiFi, device fingerprint
4. **Docker**: Multi-stage Dockerfiles + docker-compose
5. **Seed script**: 100 branches, ~5000 employees, 30 days attendance data

**Review notes**: 
- AI sinh ra ~95% code structure và logic
- Manual review: kiểm tra TypeScript compilation (0 errors), sửa minor type issues (array typing, uuid import)
- AI tự detect và fix lỗi khi được chạy tsc --noEmit

---

*Log sẽ được cập nhật thêm trong các session tiếp theo.*
