# BÁO CÁO DỰ ÁN — Smart Attendance

**So sánh kết quả thực tế với đề bài `de-bai-smart-attendance-v2.docx`**

**🎬 Demo video**: https://share.descript.com/view/YBNb9N5QhM8

| Hạng mục | Trạng thái |
|---|---|
| Thời gian | 5 ngày (10 session) |
| Quy mô mục tiêu | 100 chi nhánh × 5.000 nhân viên |
| Repo | monorepo pnpm + Turborepo (3 packages: shared, backend, frontend) |
| Deploy | `docker-compose up` 1 lệnh, multi-stage build |

---

## 1. Đối chiếu theo tiêu chí đánh giá

| Tiêu chí | Tỷ trọng | Tự đánh giá | Ghi chú |
|---|---|---|---|
| Tính năng & UX | 25% | Đạt đầy đủ + vượt | 7/7 tính năng bắt buộc + PWA + offline + mood + AI |
| Kiến trúc & Scale | 20% | Đạt | Schema đa nhánh, Redis cache, DailySummary cron, 5-layer anti-fraud |
| Git Flow & Docker | 15% | Đạt | 6 feature branches, Conventional Commits, docker-compose 1-click |
| AI IDE Workflow & PROMPT_LOG | 15% | Đạt | CLAUDE.md 170 dòng + PROMPT_LOG.md 387 dòng, 10 session |
| Sáng tạo & khác biệt | 25% | Điểm mạnh | 5 AI Agents với Function Calling, Mood Check-in, WiFi Simulator, Agentic loop |

---

## 2. Đối chiếu tính năng bắt buộc

### 2.1 Check-in / Check-out
| Yêu cầu đề bài | Thực tế đã làm | File tham chiếu |
|---|---|---|
| Xác định vị trí qua WiFi SSID/BSSID | ✅ WiFi BSSID là **gate bắt buộc** — block ngay nếu không khớp | [anti-fraud.service.ts:122-148](packages/backend/src/modules/attendance/anti-fraud.service.ts#L122-L148) |
| Xác định vị trí qua GPS geofencing | ✅ Haversine distance, bán kính cấu hình per-branch, optional | [anti-fraud.service.ts:154-201](packages/backend/src/modules/attendance/anti-fraud.service.ts#L154-L201) |
| Chống gian lận (fake GPS, VPN) | ✅ **5 lớp chấm điểm 0–100**: WiFi + GPS + Device + Speed + IP Subnet | [anti-fraud.service.ts](packages/backend/src/modules/attendance/anti-fraud.service.ts) |
| Atomic check-in (chống duplicate) | ✅ Prisma `$transaction`, race-condition-safe | [attendance.service.ts:109](packages/backend/src/modules/attendance/attendance.service.ts#L109) |

### 2.2 Quản lý chi nhánh
| Yêu cầu | Thực tế | Tham chiếu |
|---|---|---|
| CRUD chi nhánh | ✅ Full CRUD với pagination, filter, search | [branches module](packages/backend/src/modules/branches/) |
| Cấu hình WiFi hợp lệ | ✅ Model `BranchWifi` (n–1 với Branch), multi-floor | [schema.prisma](packages/backend/prisma/schema.prisma) |
| Cấu hình GPS hợp lệ | ✅ `latitude`, `longitude`, `radius` per-branch | schema.prisma model `Branch` |
| IP Subnet | ✅ **Bonus**: `allowedIpRanges: String[]` (CIDR) | model Branch |
| Gán nhân viên vào chi nhánh | ✅ `User.branchId`, admin có thể assign | users module |

### 2.3 Lịch sử & Báo cáo
| Yêu cầu | Thực tế | Tham chiếu |
|---|---|---|
| Xem theo ngày/tuần/tháng | ✅ `/reports/daily`, `/reports/weekly`, `/reports/monthly` | reports module |
| Trạng thái đúng giờ/trễ/vắng | ✅ Enum `AttendanceStatus`: ON_TIME, LATE, ABSENT, EARLY_LEAVE… | shared enums |
| Tổng giờ làm | ✅ `totalHours` tự tính khi check-out | attendance.service |
| Overtime | ✅ `overtimeHours` tính từ shift chuẩn | time util + schema |
| Export báo cáo | ✅ CSV export | reports controller |

### 2.4 Dashboard
| Yêu cầu | Thực tế | Tham chiếu |
|---|---|---|
| Thống kê tổng hợp | ✅ Overview: total employees, checked-in today, late, absent | dashboard module |
| Lọc theo chi nhánh/phòng ban | ✅ Filter theo `branchId`, `departmentId` | dashboard controller |
| Heatmap | ✅ **Bonus**: heatmap 24h×7d per-branch, cache Redis 30s TTL | getBranchHeatmap |
| Xuất báo cáo | ✅ CSV từ reports | reports module |

### 2.5 Phân quyền
| Yêu cầu | Thực tế | Tham chiếu |
|---|---|---|
| Admin (toàn hệ thống) | ✅ Role `ADMIN` — full access + branch selector khi check-in | RolesGuard |
| Manager (chi nhánh) | ✅ Role `MANAGER` — scope theo `BranchManager` table | scope decorators |
| Nhân viên (cá nhân) | ✅ Role `EMPLOYEE` — chỉ thấy data bản thân | RolesGuard + guards |

---

## 3. Kiến trúc & Khả năng mở rộng

### 3.1 Database Schema (20 models/enums — [schema.prisma](packages/backend/prisma/schema.prisma))
- **Multi-branch**: `Branch`, `BranchWifi`, `BranchManager`, `Department` → hỗ trợ 100+ nhánh
- **Attendance hot path**: compound indexes `[branchId, date]`, `[userId, date]`, unique `[userId, date]`
- **DailySummary table**: pre-aggregate nightly cron → query O(100) thay vì O(5000)
- **Audit tables**: `UserDevice`, `Anomaly`, `AiConversation`, `Notification`
- **Shift system**: `Shift` + `ShiftAssignment` cho ca kíp linh hoạt

### 3.2 API Pagination + Filter
- Chuẩn response: `{ data: T[], meta: { total, page, limit, totalPages } }`
- Prefix `/api/v1`, Swagger docs tại `/api/docs`
- `TransformInterceptor` wrap success thành `{ success, data }` (FE consume qua `res.data.data`)

### 3.3 Caching Strategy (Redis 7)
| Target | TTL | Lý do |
|---|---|---|
| JWT user profile | 15m | Giảm DB hit mỗi request |
| Dashboard overview | 60s | Hot path khi Admin load UI |
| Dashboard heatmap | 30s | Compute nặng (groupBy 24h×7d) |
| Branch configs | 5m | Ít thay đổi |
| Today's attendance (per user) | — | Invalidate on check-in/out |

### 3.4 Performance Optimizations
- **N+1 fix** với `groupBy`: dashboard heatmap 200→3 queries (↓98.5%), reports daily 500→6 queries (↓98.8%)
- **helmet + compression**: gzip ~60–80% bandwidth
- **Parallelized anomaly inserts** qua `Promise.all`
- **Device lastUsedAt fire-and-forget**: non-blocking
- **JWT refresh token race fix**: queued requests reject đúng khi refresh fail

### 3.5 Horizontal Scaling (đã thiết kế sẵn)
- Backend stateless (JWT + Redis sessions) → N replicas sau load balancer
- Prisma + PgBouncer connection pooling
- Attendance table có thể partition theo tháng khi data tăng

---

## 4. Git Flow & Docker

### 4.1 Git Flow (6 feature branches + develop + main)
```
main ← develop ← feature/foundation
                ← feature/day2-core
                ← feature/day3-polish
                ← feature/day4-ai-integration
                ← feature/day5-release
```
- 22 commits trên main, toàn bộ **Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`
- Mỗi day-milestone = 1 feature branch

### 4.2 Docker
- [docker-compose.yml](docker-compose.yml): 5 services (postgres, redis, migrate, backend, frontend) + healthchecks + networks
- **Multi-stage Dockerfile**: builder → runtime (giảm image size)
- [.env.example](.env.example) đầy đủ, secret không commit
- `migrate` service chạy Prisma migrate + seed trước khi backend start
- JWT secrets **required** — compose báo lỗi nếu thiếu (fail-fast)

### 4.3 CI/CD — [.github/workflows](/Users/finos/smart-attendance/.github/workflows)
Pipeline chạy trên mỗi push/PR:
1. `pnpm install --frozen-lockfile`
2. Build `shared` → generate Prisma client → lint → test → build
3. `pnpm audit` security check (không `continue-on-error`)

---

## 5. AI IDE Workflow & Prompt Log

### 5.1 Context Files
- [CLAUDE.md](CLAUDE.md) (170 dòng) — tech stack, conventions, API contract, anti-fraud layers, security hardening log
- [packages/frontend/AGENTS.md](packages/frontend/AGENTS.md) — cảnh báo Next.js 16 breaking changes

### 5.2 PROMPT_LOG.md (387 dòng, 10 session)
Mỗi session ghi: Prompt → AI Generated → Review & sửa. Highlight:
- Session 1: Plan 5 ngày + chọn stack qua interactive Q&A
- Session 7: "Comprehensive frontend-backend logic audit" → fix 35 bugs / 18 files
- Session 8: Architecture review → security hardening (race conditions, XSS, JWT refresh race)
- Session 10: CI/CD fix build order (shared → prisma generate → lint)

### 5.3 Review Process
100% code AI sinh ra đều review. Bằng chứng: các commit `fix:` sau mỗi `feat:` (35 bugs ở Session 7, security hardening ở Session 8).

---

## 6. Tính năng sáng tạo & khác biệt (25%)

### 6.1 Agentic AI với Function Calling (điểm nhấn)
5 chuyên gia AI, mỗi agent có toolset riêng:

| Agent | Mục đích | Tools |
|---|---|---|
| HR Chatbot | Q&A nhân viên, tra cứu chính sách | query_attendance, query_leaves, get_user_info |
| Anomaly Detector | Phát hiện bất thường từ fraud score | query_anomalies, get_attendance_stats |
| Report Generator | Sinh báo cáo tự nhiên ngôn ngữ | query_reports, aggregate_data |
| Shift Optimizer | Gợi ý xếp ca | query_shifts, get_branch_info |
| Predictive Analytics | Dự báo xu hướng | get_attendance_stats, query_dailysummary |

- **Agentic loop**: Gemini API + `@google/generative-ai`, model `gemini-2.5-flash-lite`
- Tools **thực thi Prisma queries thật**, không mock
- Loop tiếp tục khi Gemini trả `functionCall` parts → đa bước tool use
- Safety: `parseAndValidateDate`, `JSON.parse` try-catch, role-scoped tools

### 6.2 Anti-Fraud 5 lớp (vượt yêu cầu "chống fake GPS, VPN")
| Lớp | Max | Kỹ thuật |
|---|---|---|
| WiFi BSSID gate | 30 | Hard block nếu không khớp |
| GPS Geofence | 40 | Haversine + radius per-branch |
| Device Fingerprint | 50 | Mock location detect + trust level |
| Speed Anomaly | 40 | Tốc độ di chuyển giữa check-in (flag nếu >500km/h) |
| IP Subnet | 20 | CIDR match với `allowedIpRanges` của chi nhánh |

Thresholds: 0–20 CLEAN · 21–50 SUSPICIOUS · 51–80 HIGH_RISK · >80 BLOCKED.

### 6.3 PWA + Offline-first
- `manifest.json`, service worker [sw.js](packages/frontend/public/sw.js)
- Hook `use-offline-queue.ts`: queue check-in khi mất mạng, sync khi online lại
- Push notification với TTL 90 ngày (chống Redis memory leak)

### 6.4 Mood Check-in
5 tâm trạng (Great/Okay/Sad/Frustrated/Sick) lưu cùng attendance → dữ liệu nhân văn cho HR phân tích well-being.

### 6.5 WiFi Simulator (demo/testing)
Browser không có API đọc WiFi → **dropdown chọn WiFi của chi nhánh** để simulate. Admin thêm bước chọn chi nhánh. Phân biệt rõ với WiFi thật qua badge "Demo".

### 6.6 Realtime & Background
- **Socket.IO**: dashboard realtime, notify khi có HIGH_RISK check-in
- **@nestjs/schedule**: cron `0 1 * * *` tổng hợp `DailySummary` → fast path cho dashboard
- **Redis**: high-risk alert cache 1h TTL cho manager xem

### 6.7 Security Hardening (Session 8)
- Atomic check-in qua Prisma `$transaction`
- XSS-safe markdown: bỏ `dangerouslySetInnerHTML`, render React element
- Refresh token: generate mới TRƯỚC khi delete cũ (no logout on failure)
- JWT expiry check client-side (`isTokenExpired`, `getTokenTTL`)
- Strict TS: `noImplicitAny`, `strictBindCallApply`, `forceConsistentCasingInFileNames`
- `pnpm.overrides` pin `tar >= 7.5.11` (fix 6 HIGH CVEs)

---

## 7. Test Coverage

69 unit tests ở backend ([full breakdown trong README](README.md)):

| Module | Tests |
|---|---|
| Utils (geo, time) | 20 |
| Anti-fraud | 10 |
| Auth | 8 |
| Attendance | 13 |
| AI Tools | 8 |
| Others | 10 |

---

## 8. Dữ liệu seed (đáp ứng quy mô đề bài)

- **100 chi nhánh** — mã theo khu vực (HCM-Q1, HCM-Q2, HN-BD, DN-HC, v.v.)
- **5.000 nhân viên** — email pattern `emp.{branchCodeNoDash}.{n}@smartattendance.com`
- **500 manager** — mỗi nhánh 5 manager
- **Attendance 30 ngày** — sample data đủ cho dashboard trend, report, anomaly
- Seed an toàn: `deleteMany()` cascade thay vì `TRUNCATE` raw SQL

---

## 9. Hạn chế / Chưa hoàn thành

| Hạng mục | Tình trạng | Ghi chú |
|---|---|---|
| E2E test (Playwright) | Chưa có | Chỉ có unit test |
| Mobile native wrapper | Chưa | Chỉ PWA, `useWifi` là stub — production cần Capacitor/React Native |
| Partitioning attendance theo tháng | Thiết kế sẵn, chưa implement | Khi data > ~1M rows |
| Backend ESLint | Không có, dùng `tsc --noEmit` | Frontend có ESLint đầy đủ |
| Demo video | ✅ Đã có | https://share.descript.com/view/YBNb9N5QhM8 |

---

## 10. Tổng kết

| Điểm mạnh | Điểm cần cải thiện |
|---|---|
| Agentic AI đầy đủ với 5 agents + Function Calling thực thi Prisma thật | Chưa có E2E test |
| Anti-fraud 5 lớp vượt xa yêu cầu (đề bài chỉ yêu cầu chống fake GPS/VPN) | WiFi scanning chỉ simulator (do hạn chế browser) |
| Database schema 20 models hỗ trợ scale 100 nhánh × 5.000 employee | Backend chưa có ESLint (chỉ tsc) |
| 10 session Prompt Log chi tiết, mỗi session đều có Review + Fix | |
| Security hardening chuyên sâu (Session 8): race conditions, XSS, JWT, CVE pins | |
| Performance: N+1 giảm 98%+ qua groupBy, Redis cache multi-tier | |
| PWA + offline queue + Mood Check-in + Heatmap: sáng tạo nhân văn | |
| Docker 1-click, CI/CD strict (không `continue-on-error`), Git Flow chuẩn | |

**Kết luận**: Sản phẩm đáp ứng **100% tính năng bắt buộc** của đề bài, **vượt yêu cầu** ở các mặt Agentic AI, anti-fraud nhiều lớp, và hardening bảo mật. Phần sáng tạo (25% tỷ trọng) là điểm mạnh nhất: Agentic loop với Function Calling thực thi query thật, 5 chuyên gia AI khác nhau, Mood Check-in, WiFi Simulator cho demo. Git Flow + Docker + PROMPT_LOG chuẩn chỉnh, sẵn sàng cho đánh giá.
