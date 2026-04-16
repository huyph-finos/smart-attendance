import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { Prisma, AttendanceStatus, AnomalySeverity } from '@prisma/client';
import { paginatedResponse } from '../../common/dto/pagination.dto';
import {
  isLate,
  calculateWorkHours,
  calculateOvertime,
  formatDate,
} from '../../common/utils/time';
import { haversineDistance } from '../../common/utils/geo';
import { CheckInDto } from './dto/check-in.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { AntiFraudService, FraudCheckResult } from './anti-fraud.service';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly antiFraud: AntiFraudService,
  ) {}

  // ──────────────────────────────────────────────
  // Check-In
  // ──────────────────────────────────────────────

  async checkIn(userId: string, dto: CheckInDto, clientIp?: string) {
    // 1. Get user with branch info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.isActive) {
      throw new ForbiddenException('User account is inactive');
    }

    // If user has no branch (e.g. ADMIN), find the nearest branch by GPS
    let branch = user.branch;
    if (!branch) {
      if (dto.latitude != null && dto.longitude != null) {
        branch = await this.findNearestBranch(dto.latitude, dto.longitude);
      }
      if (!branch) {
        throw new ForbiddenException('No active branch found. Please ensure GPS is enabled or contact your manager to assign a branch.');
      }
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Run anti-fraud checks (before transaction to avoid holding DB lock)
    const fraudResult = await this.antiFraud.checkFraud(userId, branch.id, dto, clientIp);

    // 3. Block if fraud score too high
    if (!fraudResult.passed) {
      throw new ForbiddenException({
        message: 'Check-in blocked due to verification failure',
        fraudScore: fraudResult.score,
        checks: fraudResult.checks,
      });
    }

    // 4. Determine attendance status
    const checkInTime = new Date();
    const status: AttendanceStatus = isLate(
      checkInTime,
      branch.workStartTime,
      branch.lateThreshold,
    )
      ? AttendanceStatus.LATE
      : AttendanceStatus.ON_TIME;

    // Calculate distance from branch (only if GPS available)
    const distance = (dto.latitude != null && dto.longitude != null)
      ? haversineDistance(dto.latitude, dto.longitude, branch.latitude, branch.longitude)
      : null;

    // 5. Create attendance record atomically (prevents duplicate check-ins)
    const attendance = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({
        where: { userId_date: { userId, date: today } },
      });
      if (existing) {
        throw new ConflictException('Already checked in today');
      }

      return tx.attendance.create({
        data: {
          userId,
          branchId: branch.id,
          date: today,
          checkInTime,
          status,
          checkInLat: dto.latitude ?? null,
          checkInLng: dto.longitude ?? null,
          checkInWifiBssid: dto.wifiBssid ?? null,
          checkInDeviceId: dto.deviceFingerprint,
          checkInDistance: distance != null ? Math.round(distance) : null,
          fraudScore: fraudResult.score,
          isVerified: fraudResult.score <= 50,
          verificationNote: this.buildVerificationNote(fraudResult),
          mood: dto.mood ?? null,
        },
        include: {
          branch: { select: { name: true, code: true } },
        },
      });
    });

    // 6. Create anomaly records if fraud score warrants it
    if (fraudResult.score > 50) {
      const anomalies = this.antiFraud.getAnomaliesFromResult(fraudResult);
      await Promise.all(
        anomalies.map((anomaly) =>
          this.antiFraud.createAnomaly(
            attendance.id,
            anomaly.type,
            anomaly.severity,
            anomaly.description,
            anomaly.metadata,
          ),
        ),
      );
    }

    // 7. Cache today's attendance + invalidate dashboard cache
    await this.cacheAttendance(userId, attendance);
    this.invalidateDashboardCache(attendance.branchId);

    return {
      attendance,
      fraudCheck: {
        score: fraudResult.score,
        passed: fraudResult.passed,
        checks: fraudResult.checks,
      },
    };
  }

  // ──────────────────────────────────────────────
  // Check-Out
  // ──────────────────────────────────────────────

  async checkOut(userId: string, dto: CheckInDto, clientIp?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Find today's attendance (read outside transaction for fraud check)
    const attendanceCheck = await this.prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } },
      include: { branch: true },
    });

    if (!attendanceCheck) {
      throw new NotFoundException('No check-in found for today');
    }
    if (attendanceCheck.checkOutTime) {
      throw new ConflictException('Already checked out today');
    }

    // 2. Run anti-fraud (lighter check for checkout)
    const fraudResult = await this.antiFraud.checkFraud(
      userId,
      attendanceCheck.branchId,
      dto,
      clientIp,
    );

    // Only block check-out for very high fraud (be more lenient)
    if (fraudResult.score > 90) {
      throw new ForbiddenException({
        message: 'Check-out blocked due to verification failure',
        fraudScore: fraudResult.score,
        checks: fraudResult.checks,
      });
    }

    // 3. Calculate hours worked
    const checkOutTime = new Date();
    const totalHours = attendanceCheck.checkInTime
      ? calculateWorkHours(attendanceCheck.checkInTime, checkOutTime)
      : 0;
    const overtimeHours = calculateOvertime(totalHours);

    // 4. Update attendance record atomically (prevents double check-out)
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.attendance.findUnique({
        where: { id: attendanceCheck.id },
        select: { checkOutTime: true },
      });
      if (current?.checkOutTime) {
        throw new ConflictException('Already checked out today');
      }

      return tx.attendance.update({
        where: { id: attendanceCheck.id },
        data: {
          checkOutTime,
          checkOutLat: dto.latitude ?? null,
          checkOutLng: dto.longitude ?? null,
          checkOutWifiBssid: dto.wifiBssid ?? null,
          checkOutDeviceId: dto.deviceFingerprint,
          totalHours,
          overtimeHours,
          fraudScore: Math.round(
            ((attendanceCheck.fraudScore + fraudResult.score) / 2) * 100,
          ) / 100,
        },
        include: {
          branch: { select: { name: true, code: true } },
        },
      });
    });

    // 5. Create anomaly records if check-out fraud score is high
    if (fraudResult.score > 50) {
      const anomalies = this.antiFraud.getAnomaliesFromResult(fraudResult);
      await Promise.all(
        anomalies.map((anomaly) =>
          this.antiFraud.createAnomaly(
            updated.id,
            anomaly.type,
            anomaly.severity,
            anomaly.description,
            anomaly.metadata,
          ),
        ),
      );
    }

    // Update cache + invalidate dashboard
    await this.cacheAttendance(userId, updated);
    this.invalidateDashboardCache(updated.branchId);

    return {
      attendance: updated,
      fraudCheck: {
        score: fraudResult.score,
        passed: fraudResult.passed,
        checks: fraudResult.checks,
      },
    };
  }

  // ──────────────────────────────────────────────
  // Get Today's Attendance
  // ──────────────────────────────────────────────

  async getToday(userId: string) {
    // Try cache first
    const cached = await this.getCachedAttendance(userId);
    if (cached) {
      return cached;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await this.prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } },
      include: {
        branch: { select: { name: true, code: true } },
        anomalies: {
          select: {
            id: true,
            type: true,
            severity: true,
            description: true,
            isResolved: true,
          },
        },
      },
    });

    if (attendance) {
      await this.cacheAttendance(userId, attendance);
    }

    return attendance;
  }

  // ──────────────────────────────────────────────
  // Get Own History (paginated)
  // ──────────────────────────────────────────────

  async getHistory(userId: string, query: AttendanceQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'date';
    const sortOrder = query.sortOrder ?? 'desc';
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = { userId };

    this.applyDateFilters(where, query);

    if (query.branchId) {
      where.branchId = query.branchId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          branch: { select: { name: true, code: true } },
          anomalies: {
            select: {
              id: true,
              type: true,
              severity: true,
              isResolved: true,
            },
          },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  // ──────────────────────────────────────────────
  // Get User History (manager/admin viewing a specific user)
  // ──────────────────────────────────────────────

  async getUserHistory(
    targetUserId: string,
    query: AttendanceQueryDto,
    requestingUser: { id: string; role: string; branchId?: string },
  ) {
    // Verify the target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, branchId: true },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Managers can only view users in their branch
    if (
      requestingUser.role === 'MANAGER' &&
      targetUser.branchId !== requestingUser.branchId
    ) {
      throw new ForbiddenException(
        'Managers can only view attendance for users in their branch',
      );
    }

    return this.getHistory(targetUserId, query);
  }

  // ──────────────────────────────────────────────
  // Bulk Sync (offline queue)
  // ──────────────────────────────────────────────

  async bulkSync(
    userId: string,
    records: Array<{
      date: string;
      checkInTime: string;
      checkOutTime?: string;
      latitude: number;
      longitude: number;
      wifiBssid?: string;
      deviceFingerprint: string;
      mood?: string;
    }>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true },
    });

    if (!user || !user.branch) {
      throw new NotFoundException('User or branch not found');
    }

    const results: Array<{
      date: string;
      status: 'created' | 'skipped' | 'error';
      message?: string;
    }> = [];

    for (const record of records) {
      try {
        const date = new Date(record.date);
        date.setHours(0, 0, 0, 0);

        // Skip if attendance already exists for this date
        const existing = await this.prisma.attendance.findUnique({
          where: { userId_date: { userId, date } },
        });

        if (existing) {
          results.push({
            date: record.date,
            status: 'skipped',
            message: 'Attendance already exists for this date',
          });
          continue;
        }

        const checkInTime = new Date(record.checkInTime);
        const checkOutTime = record.checkOutTime
          ? new Date(record.checkOutTime)
          : null;

        const totalHours =
          checkOutTime ? calculateWorkHours(checkInTime, checkOutTime) : null;
        const overtimeHours =
          totalHours != null ? calculateOvertime(totalHours) : null;

        const status: AttendanceStatus = isLate(
          checkInTime,
          user.branch.workStartTime,
          user.branch.lateThreshold,
        )
          ? AttendanceStatus.LATE
          : AttendanceStatus.ON_TIME;

        const distance = haversineDistance(
          record.latitude,
          record.longitude,
          user.branch.latitude,
          user.branch.longitude,
        );

        await this.prisma.attendance.create({
          data: {
            userId,
            branchId: user.branch.id,
            date,
            checkInTime,
            checkOutTime,
            status,
            totalHours,
            overtimeHours,
            checkInLat: record.latitude,
            checkInLng: record.longitude,
            checkInWifiBssid: record.wifiBssid ?? null,
            checkInDeviceId: record.deviceFingerprint,
            checkInDistance: Math.round(distance),
            isOfflineSync: true,
            isVerified: false,
            verificationNote: 'Synced from offline queue - pending verification',
            mood: record.mood ?? null,
          },
        });

        results.push({ date: record.date, status: 'created' });
      } catch (error) {
        this.logger.error(
          `Bulk sync error for date ${record.date}`,
          error,
        );
        results.push({
          date: record.date,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      total: records.length,
      created: results.filter((r) => r.status === 'created').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      details: results,
    };
  }

  // ──────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────

  private applyDateFilters(
    where: Prisma.AttendanceWhereInput,
    query: AttendanceQueryDto,
  ): void {
    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        (where.date as Prisma.DateTimeFilter).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        (where.date as Prisma.DateTimeFilter).lte = end;
      }
    }
  }

  private buildVerificationNote(fraudResult: FraudCheckResult): string {
    const parts: string[] = [];
    const { checks } = fraudResult;

    if (checks.wifi.score > 0) parts.push(`WiFi: ${checks.wifi.detail}`);
    if (checks.gps.score > 0) parts.push(`GPS: ${checks.gps.detail}`);
    if (checks.device.score > 0) parts.push(`Device: ${checks.device.detail}`);
    if (checks.speed.score > 0) parts.push(`Speed: ${checks.speed.detail}`);
    if (checks.ipSubnet.score > 0) parts.push(`IP: ${checks.ipSubnet.detail}`);

    if (parts.length === 0) return 'All verification checks passed';
    return parts.join(' | ');
  }

  private async cacheAttendance(
    userId: string,
    attendance: Record<string, unknown>,
  ): Promise<void> {
    try {
      const key = `attendance:today:${userId}`;
      const today = new Date();
      // Set TTL to expire at end of day
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      const ttl = Math.max(
        1,
        Math.floor((endOfDay.getTime() - today.getTime()) / 1000),
      );
      await this.redis.setex(key, ttl, JSON.stringify(attendance));
    } catch (error) {
      this.logger.error('Failed to cache attendance', error);
    }
  }

  private async getCachedAttendance(
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const key = `attendance:today:${userId}`;
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.error('Failed to get cached attendance', error);
    }
    return null;
  }

  /**
   * Invalidate dashboard caches so real-time stats reflect new attendance.
   * Fire-and-forget — must not block the check-in/check-out response.
   */
  private invalidateDashboardCache(branchId: string): void {
    Promise.allSettled([
      this.redis.del(`dashboard:overview:${branchId}`),
      this.redis.del('dashboard:overview:all'),
      this.redis.del('dashboard:heatmap'),
    ]).catch((err) =>
      this.logger.warn(`Failed to invalidate dashboard cache: ${err.message}`),
    );
  }

  /**
   * Find the nearest active branch to the given GPS coordinates.
   * Used as fallback for users without a fixed branch (e.g. ADMIN).
   */
  private async findNearestBranch(lat: number, lng: number) {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
    });

    if (branches.length === 0) return null;

    let nearest = branches[0];
    let minDistance = haversineDistance(lat, lng, nearest.latitude, nearest.longitude);

    for (let i = 1; i < branches.length; i++) {
      const d = haversineDistance(lat, lng, branches[i].latitude, branches[i].longitude);
      if (d < minDistance) {
        minDistance = d;
        nearest = branches[i];
      }
    }

    return nearest;
  }
}
