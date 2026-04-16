# Smart Attendance — AI Context File

## Project Overview
Hệ thống chấm công thông minh cho doanh nghiệp quy mô 100 chi nhánh, 5.000 nhân viên.
Xác định vị trí bằng WiFi SSID/BSSID và GPS geofencing. Tích hợp Agentic AI (Gemini API + Function Calling).

## Tech Stack
- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS 4, shadcn/ui, PWA
- **Backend**: NestJS 11 (TypeScript), Prisma ORM (PostgreSQL), Bull queue, Socket.IO
- **Database**: PostgreSQL 16 + Redis 7
- **Auth**: JWT (access 15m + refresh 7d) with Redis blacklist
- **AI**: Gemini API (`@google/generative-ai`, model `gemini-2.5-flash-lite`) with Function Calling — 5 specialized agents
- **Deploy**: Docker multi-stage builds, docker-compose

## Project Structure
```
smart-attendance/
├── packages/
│   ├── shared/        # Shared types, enums, utilities (geo, time)
│   ├── backend/       # NestJS API at localhost:3001
│   │   ├── prisma/    # Schema, migrations, seed
│   │   └── src/modules/  # auth, users, branches, attendance, reports, dashboard, ai, notifications
│   └── frontend/      # Next.js at localhost:3000
│       └── src/
│           ├── app/          # App Router pages
│           ├── components/   # UI + layout components
│           ├── hooks/        # GPS, WiFi, device fingerprint
│           ├── stores/       # Zustand stores
│           └── lib/          # API client, auth helpers
```

## Conventions
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- Git Flow: main ← develop ← feature/* | release/* | hotfix/*
- API responses: `{ success: boolean, data: T }` or `{ success: false, message: string }`
- Pagination: `{ data: T[], meta: { total, page, limit, totalPages } }`
- All API endpoints prefixed with `/api/v1`
- Role-based access: ADMIN (full) > MANAGER (own branch) > EMPLOYEE (own data)

## Key Modules
- **Anti-Fraud**: Multi-layer scoring (WiFi + GPS + Device + Speed + AI) — 0-100 score
- **AI Agents**: HR Chatbot, Anomaly Detector, Report Generator, Shift Optimizer, Predictive Analytics
- **AI Tool Use**: Tools execute real Prisma queries; agentic loop continues while Gemini returns functionCall parts

## Dev Commands
```bash
pnpm install          # Install all dependencies
pnpm dev              # Start all services (turbo)
docker-compose up     # Run with Docker

# Backend specific
cd packages/backend
npx prisma migrate dev   # Run migrations
npx prisma db seed       # Seed data (100 branches, 5000 employees, 30 days attendance)
npx prisma studio        # DB GUI

# Frontend specific
cd packages/frontend
pnpm dev                 # Next.js dev server
```

## Important: Frontend-Backend Contract
The backend `TransformInterceptor` wraps all success responses as `{ success: true, data: T }`.
- Axios response: `res.data` = `{ success, data }`, actual payload = `res.data.data`
- Paginated: `{ data: T[], meta: { total, page, limit, totalPages } }` (also wrapped)
- Check-in/check-out returns `{ attendance, fraudCheck: { score, passed, checks } }` — store only `attendance` in state
- Backend DTO field names use **camelCase** (e.g., `wifiSsid`, `wifiBssid`, `startDate`, `endDate`, `overtimeHours`)
- Leave model uses `isApproved: boolean | null` (null=pending), NOT a `status` string
- Anomaly `user` is nested under `attendance.user`, not directly on anomaly
- Branch `_count.employees` for employee count, NOT `employeeCount`
- Reports endpoints: `/reports/daily`, `/reports/weekly` (param: `weekOf`), `/reports/monthly` (params: `month` int + `year` int), `/reports/summary`
- AI chat response field is `response`, not `content`

## Accounts (after seed)
- Admin: admin@smartattendance.com / admin123
- Employee: emp.{branch-code}.{n}@smartattendance.com / employee123
- Manager: manager.{branch-code}.{n}@smartattendance.com / employee123

## Recent Bug Fix Log (2026-04-16)
Comprehensive frontend-backend logic audit — 35 bugs fixed across 18 files:
- **Check-in page**: WiFi field name mismatch, mood not sent, state shape mismatch after action, fraud score path wrong, no GPS validation
- **Auth**: Logout not sending refresh token (server never blacklists), 401 interceptor catching login errors, isRefreshing deadlock
- **Employee detail**: Wrong attendance API endpoint (`/attendance/history` → `/attendance/user/:id/history`), wrong date param names
- **Branches**: `employeeCount` → `_count.employees`, optional fields not clearable in edit
- **Leaves**: `status` field doesn't exist → use `isApproved`
- **Anomalies**: User nested under `attendance.user`, date from `attendance.date`
- **Attendance history**: `dateFrom/dateTo` → `startDate/endDate`, `overtime` → `overtimeHours`
- **Reports**: Wrong endpoints, wrong param names/formats, wrong column keys
- **AI insights**: `result.content` → `result.response`
- **AI rate limit (backend)**: Redis TTL lost on increment — permanent user lockout
- **Offline sync**: Wrong URL, no auth header, wrong body shape
- **XSS**: HTML escaping in AI markdown renderer (`dangerouslySetInnerHTML`)
