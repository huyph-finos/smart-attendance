# Smart Attendance — AI Context File

## Project Overview
Hệ thống chấm công thông minh cho doanh nghiệp quy mô 100 chi nhánh, 5.000 nhân viên.
Xác định vị trí bằng WiFi SSID/BSSID và GPS geofencing. Tích hợp Agentic AI (Claude API + Tool Use).

## Tech Stack
- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS 4, shadcn/ui, PWA
- **Backend**: NestJS 11 (TypeScript), Prisma ORM (PostgreSQL), Bull queue, Socket.IO
- **Database**: PostgreSQL 16 + Redis 7
- **Auth**: JWT (access 15m + refresh 7d) with Redis blacklist
- **AI**: Claude API (`@anthropic-ai/sdk`) with Tool Use pattern — 5 specialized agents
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
- **AI Tool Use**: Tools execute real Prisma queries; agentic loop continues until Claude's stop_reason !== 'tool_use'

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

## Accounts (after seed)
- Admin: admin@smartattendance.com / admin123
- Employee: emp.{branch-code}.{n}@smartattendance.com / employee123
- Manager: manager.{branch-code}.{n}@smartattendance.com / employee123
