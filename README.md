# Smart Attendance — Chấm Công Thông Minh

Hệ thống chấm công thông minh với AI, xác định vị trí bằng WiFi/GPS, chống gian lận đa tầng, và Agentic AI hỗ trợ HR.

**🎬 Demo video**: https://share.descript.com/view/YBNb9N5QhM8

## Quick Start

### Với Docker (khuyến nghị)
```bash
cp .env.example .env
# Điền GEMINI_API_KEY vào .env (cần cho AI features)
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
| AI | Gemini API (`gemini-2.5-flash-lite`) + Function Calling |
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

### Agentic AI System (Gemini API + Function Calling)
5 AI Agents chuyên biệt, mỗi agent có bộ tools riêng để query trực tiếp database:

| Agent | Chức năng | Tools |
|-------|-----------|-------|
| HR Chatbot | Hỏi đáp NL: "Ai đi trễ nhiều nhất tháng này?" | query_attendance, query_employees, aggregate_stats |
| Anomaly Detector | Phát hiện gian lận patterns | detect_patterns, query_attendance |
| Report Generator | Tạo báo cáo từ NL request | aggregate_stats, generate_chart |
| Shift Optimizer | Gợi ý xếp ca tối ưu | query_employees, detect_patterns |
| Predictive Analytics | Dự đoán vắng mặt, trends | aggregate_stats, detect_patterns |

**Architecture**: Agentic loop — Gemini gọi Function Calling → tools query real DB → results fed back → Gemini tiếp tục cho đến khi có câu trả lời cuối.

### Creative Features (25% điểm sáng tạo)
- **Mood Check-in**: Nhân viên chọn emoji mood khi check-in → color-coded, animated
- **Branch Leaderboard**: Top 10 chi nhánh xếp hạng theo attendance rate (gold/silver/bronze)
- **AI Insights Dashboard**: Auto-generate phân tích từ 3 agents (attendance summary, anomaly alerts, predictions)
- **Tool Use Visualization**: UI hiển thị từng tool call của AI với collapsible JSON (transparency)
- **Real-time Clock Widget**: Đồng hồ lớn trên check-in page, cập nhật mỗi giây
- **Smart Manager Banner**: Quick stats cho manager ("Hôm nay: X/Y NV đã chấm công")
- **Notification Bell**: Real-time polling mỗi 30s, popover dropdown, mark read
- **Conversation History**: Sidebar lưu lại lịch sử chat với AI agents
- **Offline PWA**: Service worker + offline queue cho check-in khi mất mạng

## Chiến Lược Scale (100 chi nhánh, 5.000 nhân viên)

### Database
- **DailySummary table**: Pre-computed aggregates → dashboard query O(100) thay vì O(5000)
- **Indexes**: `[branchId, date]`, `[userId, date]`, `[date, status]` cho hot queries
- **Unique constraints**: `[userId, date]` ngăn duplicate check-in

### Caching (Redis)
- Dashboard stats: TTL 60s
- Branch configs: TTL 5m (ít thay đổi)
- Today's attendance: Cached per user

### Scheduled Jobs (@nestjs/schedule)
- **DailySummary cron** (`0 1 * * *`): Nightly aggregation per branch → fast path cho dashboard trends
- Push notifications: non-blocking (fire-and-forget pattern)

### Security & Performance Middleware
- **helmet**: Security headers (CSP, X-Frame-Options, HSTS, etc.)
- **compression**: Gzip response compression (~60-80% bandwidth reduction)
- **JWT Redis caching**: User profile cached 15min → eliminates DB hit per request

### Anti-Fraud: 5-Layer Verification
| Layer | Max Score | Method |
|-------|-----------|--------|
| WiFi BSSID | 30 pts | Match against branch BranchWifi records |
| GPS Geofence | 40 pts | Haversine distance vs branch radius |
| Device Fingerprint | 50 pts | Mock location detection, device trust |
| Speed Anomaly | 40 pts | Impossible travel speed between check-ins |
| IP Subnet | 20 pts | Client IP vs branch `allowedIpRanges` CIDR |

### Horizontal Scaling
- Backend stateless (JWT auth, Redis sessions) → N replicas behind load balancer
- Connection pooling: Prisma với PgBouncer
- Database partitioning: `attendances` table by month (có thể implement khi cần)

## Testing

### Chạy tests
```bash
cd packages/backend
pnpm test          # Chạy tất cả tests
pnpm test:watch    # Watch mode
pnpm test:cov      # Coverage report
```

### Test Coverage (69 tests)
| Module | File | Tests | Mô tả |
|--------|------|-------|--------|
| Utils | `geo.spec.ts` | 8 | Haversine distance, geofencing, travel speed |
| Utils | `time.spec.ts` | 12 | parseTime, isLate, workHours, overtime, formatDate |
| Anti-Fraud | `anti-fraud.service.spec.ts` | 10 | 4 fraud layers, composite scoring, anomaly detection |
| Auth | `auth.service.spec.ts` | 8 | Login, refresh, logout, getMe |
| Attendance | `attendance.service.spec.ts` | 13 | Check-in/out, fraud blocking, caching |
| AI Tools | `tool-executor.spec.ts` | 8 | Tool execution, role scoping, query, stats |

### CI/CD (GitHub Actions)
Pipeline tự động chạy trên mỗi push/PR:
- **Lint**: ESLint backend + frontend
- **Test**: Unit tests với PostgreSQL + Redis services
- **Build**: Backend + Frontend production build
- **Security**: `pnpm audit` dependency check

## Security

### Rate Limiting
- Global: 100 requests/phút/IP
- Login: 5 requests/phút (chống brute force)
- AI Chat: 30 requests/giờ/user

### Health Check
```bash
curl http://localhost:3001/api/v1/health
# → { status: "healthy", services: { database: "up", redis: "up" }, uptime: 3600 }
```

## Performance Optimization

### N+1 Query Fix
Sử dụng `groupBy` thay vì loop per-branch:
| Endpoint | Trước | Sau | Giảm |
|----------|-------|-----|------|
| Dashboard heatmap | 200 queries | 3 queries | 98.5% |
| Dashboard trends | 60 queries | 2 queries | 96.7% |
| Reports daily | 500 queries | 6 queries | 98.8% |
| Reports weekly/monthly | 400 queries | 5 queries | 98.8% |

## Git Flow
```
main ← develop ← feature/* | release/* | hotfix/*
```
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`
- Mỗi feature = 1 branch + PR + review

## Environment Variables
Xem [.env.example](.env.example) để biết tất cả biến môi trường cần thiết.

> **Lưu ý bảo mật**: `JWT_SECRET` và `JWT_REFRESH_SECRET` **bắt buộc** phải set trong `.env`. Docker-compose sẽ báo lỗi nếu thiếu.

## License
Private — Đội Giải Pháp Số
