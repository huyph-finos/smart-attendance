# Smart Attendance — Chấm Công Thông Minh

Hệ thống chấm công thông minh với AI, xác định vị trí bằng WiFi/GPS, chống gian lận đa tầng, và Agentic AI hỗ trợ HR.

## Quick Start

### Với Docker (khuyến nghị)
```bash
cp .env.example .env
# Điền ANTHROPIC_API_KEY vào .env (cần cho AI features)
docker-compose up
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/v1
- Swagger docs: http://localhost:3001/api/docs

### Development
```bash
# Cài dependencies
pnpm install

# Khởi động PostgreSQL & Redis (docker)
docker-compose up postgres redis -d

# Chạy migration + seed
cd packages/backend
npx prisma migrate dev
npx prisma db seed

# Chạy dev server
cd ../..
pnpm dev
```

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartattendance.com | admin123 |
| Manager | manager.hcm-q1-1.0@smartattendance.com | employee123 |
| Employee | emp.hcm-q1-1.0@smartattendance.com | employee123 |

## Kiến Trúc

### Tech Stack
| Layer | Công nghệ |
|-------|-----------|
| Frontend | Next.js 16, React 19, TailwindCSS 4, shadcn/ui, PWA |
| Backend | NestJS 11, TypeScript, Prisma ORM |
| Database | PostgreSQL 16, Redis 7 |
| AI | Claude API (Anthropic SDK) + Tool Use pattern |
| Queue | BullMQ (background jobs) |
| Realtime | Socket.IO (WebSocket) |
| Deploy | Docker multi-stage, docker-compose |

### Monorepo Structure
```
packages/
├── shared/     # Types, enums, utilities
├── backend/    # NestJS API (port 3001)
└── frontend/   # Next.js PWA (port 3000)
```

### Database Schema (14 tables)
```
users ← branches ← branch_wifi
  ↓        ↓
departments  branch_managers
  
attendances ← anomalies
leaves, shifts ← shift_assignments
notifications, ai_conversations, daily_summaries
```

## Tính Năng

### Core Features
- **Check-in/Check-out**: WiFi SSID/BSSID + GPS geofencing + anti-fraud scoring
- **Quản lý chi nhánh**: CRUD 100 chi nhánh + cấu hình WiFi/GPS
- **Lịch sử & báo cáo**: Ngày/tuần/tháng, export Excel
- **Dashboard**: Thống kê real-time, biểu đồ trends, branch heatmap
- **Phân quyền**: Admin / Manager / Employee

### Anti-Fraud System (Multi-Layer Scoring 0-100)
| Layer | Kiểm tra | Điểm |
|-------|---------|------|
| 1. WiFi | BSSID/SSID whitelist matching | 0-30 |
| 2. GPS | Haversine geofencing | 0-40 |
| 3. Device | Fingerprint + mock detection | 0-50 |
| 4. Speed | Impossible travel detection | 0-40 |
| 5. AI | Pattern analysis (async) | Background |

**Score thresholds**: 0-20 CLEAN | 21-50 SUSPICIOUS | 51-80 HIGH RISK | 81+ BLOCKED

### Agentic AI System (Claude API + Tool Use)
5 AI Agents chuyên biệt, mỗi agent có bộ tools riêng để query trực tiếp database:

| Agent | Chức năng | Tools |
|-------|-----------|-------|
| HR Chatbot | Hỏi đáp NL: "Ai đi trễ nhiều nhất tháng này?" | query_attendance, query_employees, aggregate_stats |
| Anomaly Detector | Phát hiện gian lận patterns | detect_patterns, query_attendance |
| Report Generator | Tạo báo cáo từ NL request | aggregate_stats, generate_chart |
| Shift Optimizer | Gợi ý xếp ca tối ưu | query_employees, detect_patterns |
| Predictive Analytics | Dự đoán vắng mặt, trends | aggregate_stats, detect_patterns |

**Architecture**: Agentic loop — Claude gọi tools → tools query real DB → results fed back → Claude tiếp tục cho đến khi có câu trả lời cuối.

### Creative Features
- **Mood Check-in**: Nhân viên chọn emoji mood → AI phân tích team wellness
- **Tool Use Visualization**: UI hiển thị từng tool call của AI (transparency)
- **Real-time Dashboard**: WebSocket live feed check-in/check-out

## Chiến Lược Scale (100 chi nhánh, 5.000 nhân viên)

### Database
- **DailySummary table**: Pre-computed aggregates → dashboard query O(100) thay vì O(5000)
- **Indexes**: `[branchId, date]`, `[userId, date]`, `[date, status]` cho hot queries
- **Unique constraints**: `[userId, date]` ngăn duplicate check-in

### Caching (Redis)
- Dashboard stats: TTL 60s
- Branch configs: TTL 5m (ít thay đổi)
- Today's attendance: Cached per user

### Background Jobs (BullMQ)
- Report export (async, không block API)
- Anomaly scan (cron every 2h)
- DailySummary materialization (nightly)
- Push notifications (non-blocking)

### Horizontal Scaling
- Backend stateless (JWT auth, Redis sessions) → N replicas behind load balancer
- Connection pooling: Prisma với PgBouncer
- Database partitioning: `attendances` table by month (có thể implement khi cần)

## Git Flow
```
main ← develop ← feature/* | release/* | hotfix/*
```
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`
- Mỗi feature = 1 branch + PR + review

## Environment Variables
Xem [.env.example](.env.example) để biết tất cả biến môi trường cần thiết.

## License
Private — Đội Giải Pháp Số
