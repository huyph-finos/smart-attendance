# Smart Attendance — AI Context File

## Project Overview
Hệ thống chấm công thông minh cho doanh nghiệp quy mô 100 chi nhánh, 5.000 nhân viên.
Xác định vị trí bằng WiFi SSID/BSSID và GPS geofencing. Tích hợp Agentic AI (Gemini API + Function Calling).

## Tech Stack
- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS 4, shadcn/ui, PWA
- **Backend**: NestJS 11 (TypeScript), Prisma ORM (PostgreSQL), @nestjs/schedule (cron), Socket.IO
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
- **Anti-Fraud**: 5-layer scoring (WiFi + GPS + Device + Speed + IP Subnet) — 0-100 score
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

## CI/Build Order (important)
Fresh checkouts need these steps before `lint`/`build`/`test`:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @smart-attendance/shared build` — backend imports from shared's `dist/`
3. `pnpm --filter @smart-attendance/backend prisma:generate` — backend needs `@prisma/client` types
4. Then: `lint` (backend uses `tsc --noEmit`), `test`, or `build`

The backend `lint` script is `tsc --noEmit` (ESLint not installed). Frontend has ESLint.
The pnpm version is pinned by `packageManager: pnpm@10.28.1` in root `package.json` — do NOT add `version:` to `pnpm/action-setup` in CI (causes `ERR_PNPM_BAD_PM_VERSION`).

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
- Employee: emp.{branchCodeNoDash}.{n}@smartattendance.com / employee123
  - Branch code has dashes stripped: `HCM-Q1-1` → `hcmq11` → `emp.hcmq11.0@smartattendance.com`
- Manager: manager.{branchCodeNoDash}.{n}@smartattendance.com / employee123

## Anti-Fraud Layers

### WiFi Gate (mandatory)
WiFi BSSID must match branch WiFi configs **before** scoring begins. If no WiFi data or BSSID mismatch → **auto-block** (score=100, passed=false). This is the primary verification method.

### Scoring Layers (run after WiFi gate passes)
| Layer | Max Score | Description |
|-------|-----------|-------------|
| WiFi BSSID | 30 pts | Match BSSID against branch WiFi configs |
| GPS Geofence | 40 pts | Haversine distance vs branch radius (skipped if no GPS) |
| Device Fingerprint | 50 pts | Mock location, trusted device check |
| Speed Anomaly | 40 pts | Travel speed between check-ins (skipped if no GPS) |
| IP Subnet | 20 pts | Client IP vs branch `allowedIpRanges` CIDR |

- GPS is **optional** — `latitude`/`longitude` are nullable in DTO; GPS & Speed layers score 0 when absent
- Thresholds: 0-20 CLEAN, 21-50 SUSPICIOUS, 51-80 HIGH_RISK, >80 BLOCKED
- Check-in page has **WiFi Simulation** mode (dropdown to select branch WiFi for demo/testing)
- Admin users (no assigned branch) get a **branch selector** dropdown before WiFi simulation
- Branch model has `allowedIpRanges: String[]` for IP verification (seeded with localhost ranges)
- Frontend disables check-in button until valid WiFi is selected; shows warning message

## Security & Architecture Hardening (2026-04-17)
- **Atomic check-in/check-out**: Prisma `$transaction` prevents duplicate attendance from race conditions
- **XSS-safe markdown**: Replaced `dangerouslySetInnerHTML` with React element rendering (no HTML injection possible)
- **Refresh token safety**: Generate new tokens BEFORE deleting old — no logout on generation failure
- **AI tool validation**: `parseAndValidateDate()` validates all date inputs from Gemini function calls
- **AI JSON safety**: `JSON.parse` wrapped in try-catch in agentic loop — no crash on malformed tool output
- **Token refresh race fix**: Queued requests reject properly on refresh failure (no `Bearer null`)
- **JWT expiry check**: `isTokenExpired()` / `getTokenTTL()` decode JWT client-side for proactive refresh
- **Strict TypeScript**: Backend `noImplicitAny: true`, `strictBindCallApply: true`, `forceConsistentCasingInFileNames: true`
- **CI enforced**: Removed `continue-on-error` on lint, build, and security audit steps
- **Dependency fix**: `pnpm.overrides` pins `tar >= 7.5.11` (fixes 6 HIGH vulnerabilities)
- **Seed safety**: Replaced `$executeRawUnsafe('TRUNCATE...')` with safe `deleteMany()` cascade

## Performance Optimizations (2026-04-17)
- **helmet** + **compression** middleware in `main.ts`
- **JWT Redis caching**: user profile cached 15min, DB hit only on cache miss
- **DailySummary cron** (`@nestjs/schedule`): nightly aggregation for dashboard trends fast path
- **Dashboard cache invalidation**: check-in/check-out invalidates overview + heatmap cache
- **Heatmap caching**: 30s TTL on `getBranchHeatmap()`
- **Anomaly inserts parallelized**: `Promise.all` instead of sequential
- **Device lastUsedAt fire-and-forget**: non-blocking timestamp update
- **Push subscription TTL**: 90-day expiry prevents Redis memory leak

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
- **XSS**: HTML escaping in AI markdown renderer (`dangerouslySetInnerHTML`) — later replaced with React element rendering (Session 9)
