import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ──────────────────────────────────────────────
  // Overview (today's real-time stats)
  // ──────────────────────────────────────────────

  async getOverview(branchId?: string) {
    const cacheKey = `dashboard:overview:${branchId ?? 'all'}`;

    // Try cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.error('Failed to read dashboard cache', error);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userWhere: Prisma.UserWhereInput = { isActive: true };
    const attendanceWhere: Prisma.AttendanceWhereInput = { date: today };
    if (branchId) {
      userWhere.branchId = branchId;
      attendanceWhere.branchId = branchId;
    }

    const [
      totalEmployees,
      checkedIn,
      checkedOut,
      lateCount,
      onLeaveCount,
      avgCheckInAgg,
    ] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.attendance.count({
        where: { ...attendanceWhere, checkInTime: { not: null } },
      }),
      this.prisma.attendance.count({
        where: { ...attendanceWhere, checkOutTime: { not: null } },
      }),
      this.prisma.attendance.count({
        where: { ...attendanceWhere, status: 'LATE' },
      }),
      this.prisma.leave.count({
        where: {
          ...(branchId ? { user: { branchId } } : {}),
          isApproved: true,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      }),
      this.prisma.attendance.findMany({
        where: { ...attendanceWhere, checkInTime: { not: null } },
        select: { checkInTime: true },
      }),
    ]);

    const absent = Math.max(0, totalEmployees - checkedIn - onLeaveCount);

    // Calculate average check-in time
    let avgCheckInTime: string | null = null;
    if (avgCheckInAgg.length > 0) {
      const totalMinutes = avgCheckInAgg.reduce((sum, r) => {
        const t = r.checkInTime!;
        return sum + t.getHours() * 60 + t.getMinutes();
      }, 0);
      const avgMinutes = Math.round(totalMinutes / avgCheckInAgg.length);
      const hours = Math.floor(avgMinutes / 60);
      const mins = avgMinutes % 60;
      avgCheckInTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    const attendanceRate =
      totalEmployees > 0
        ? Math.round((checkedIn / totalEmployees) * 10000) / 100
        : 0;

    const result = {
      totalEmployees,
      checkedIn,
      checkedOut,
      late: lateCount,
      absent,
      onLeave: onLeaveCount,
      avgCheckInTime,
      attendanceRate,
    };

    // Cache for 60 seconds
    try {
      await this.redis.setex(cacheKey, 60, JSON.stringify(result));
    } catch (error) {
      this.logger.error('Failed to cache dashboard overview', error);
    }

    return result;
  }

  // ──────────────────────────────────────────────
  // Trends (last N days)
  // ──────────────────────────────────────────────

  async getTrends(branchId?: string, days = 30) {
    const cacheKey = `dashboard:trends:${branchId ?? 'all'}:${days}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.error('Failed to read trends cache', error);
    }

    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days + 1);

    // Try DailySummary table first
    const dailySummaryWhere: Prisma.DailySummaryWhereInput = {
      date: { gte: startDate, lte: endDate },
    };
    if (branchId) {
      dailySummaryWhere.branchId = branchId;
    }

    const summaries = await this.prisma.dailySummary.findMany({
      where: dailySummaryWhere,
      orderBy: { date: 'asc' },
    });

    let trends: Array<{
      date: string;
      present: number;
      late: number;
      absent: number;
      attendanceRate: number;
    }>;

    if (summaries.length > 0) {
      // Aggregate DailySummary rows per date (across branches if no branchId filter)
      const dateMap = new Map<string, { present: number; late: number; absent: number; total: number }>();

      for (const s of summaries) {
        const dateKey = s.date.toISOString().split('T')[0];
        const existing = dateMap.get(dateKey) || { present: 0, late: 0, absent: 0, total: 0 };
        existing.present += s.presentCount;
        existing.late += s.lateCount;
        existing.absent += s.absentCount;
        existing.total += s.totalEmployees;
        dateMap.set(dateKey, existing);
      }

      trends = Array.from(dateMap.entries()).map(([date, data]) => ({
        date,
        present: data.present,
        late: data.late,
        absent: data.absent,
        attendanceRate:
          data.total > 0
            ? Math.round((data.present / data.total) * 10000) / 100
            : 0,
      }));
    } else {
      // Fallback: batch query instead of N queries per day
      const attendanceWhere: Prisma.AttendanceWhereInput = {
        date: { gte: startDate, lte: endDate },
      };
      const userWhere: Prisma.UserWhereInput = { isActive: true };
      if (branchId) {
        attendanceWhere.branchId = branchId;
        userWhere.branchId = branchId;
      }

      const [totalEmployees, groups] = await Promise.all([
        this.prisma.user.count({ where: userWhere }),
        this.prisma.attendance.groupBy({
          by: ['date', 'status'],
          where: attendanceWhere,
          _count: { id: true },
        }),
      ]);

      // Build date → status → count map
      const dateStatusMap = new Map<string, Record<string, number>>();
      for (const g of groups) {
        const dateKey = g.date.toISOString().split('T')[0];
        if (!dateStatusMap.has(dateKey)) {
          dateStatusMap.set(dateKey, {});
        }
        dateStatusMap.get(dateKey)![g.status] = g._count.id;
      }

      trends = [];
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const dateKey = cursor.toISOString().split('T')[0];
        const statusMap = dateStatusMap.get(dateKey) ?? {};
        const present = (statusMap['ON_TIME'] ?? 0) + (statusMap['LATE'] ?? 0);
        const late = statusMap['LATE'] ?? 0;
        const absent = Math.max(0, totalEmployees - present);

        trends.push({
          date: dateKey,
          present,
          late,
          absent,
          attendanceRate:
            totalEmployees > 0
              ? Math.round((present / totalEmployees) * 10000) / 100
              : 0,
        });

        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Cache for 60 seconds
    try {
      await this.redis.setex(cacheKey, 60, JSON.stringify(trends));
    } catch (error) {
      this.logger.error('Failed to cache trends', error);
    }

    return trends;
  }

  // ──────────────────────────────────────────────
  // Branch Heatmap
  // ──────────────────────────────────────────────

  async getBranchHeatmap() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Batch queries instead of N+1 loop (was: 100 branches × 2 queries = 200 queries)
    const [branches, employeeCounts, checkedInCounts] = await Promise.all([
      this.prisma.branch.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          latitude: true,
          longitude: true,
        },
      }),
      this.prisma.user.groupBy({
        by: ['branchId'],
        where: { isActive: true },
        _count: { id: true },
      }),
      this.prisma.attendance.groupBy({
        by: ['branchId'],
        where: { date: today, checkInTime: { not: null } },
        _count: { id: true },
      }),
    ]);

    const employeeMap = new Map(
      employeeCounts.map((e) => [e.branchId, e._count.id]),
    );
    const checkedInMap = new Map(
      checkedInCounts.map((c) => [c.branchId, c._count.id]),
    );

    return branches.map((branch) => {
      const employeeCount = employeeMap.get(branch.id) ?? 0;
      const checkedInCount = checkedInMap.get(branch.id) ?? 0;
      const attendanceRate =
        employeeCount > 0
          ? Math.round((checkedInCount / employeeCount) * 10000) / 100
          : 0;

      return {
        branchId: branch.id,
        branchName: branch.name,
        code: branch.code,
        lat: branch.latitude,
        lng: branch.longitude,
        attendanceRate,
        employeeCount,
        checkedInCount,
      };
    });
  }

  // ──────────────────────────────────────────────
  // Live Feed
  // ──────────────────────────────────────────────

  async getLiveFeed(limit = 50) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get latest attendance records with both check-in and check-out events
    const attendances = await this.prisma.attendance.findMany({
      where: { date: today },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
        branch: {
          select: { name: true },
        },
      },
    });

    // Build a feed of events (each attendance can produce up to 2 events)
    const events: Array<{
      id: string;
      userName: string;
      branchName: string;
      action: 'check_in' | 'check_out';
      time: Date;
      status: string;
    }> = [];

    for (const a of attendances) {
      const userName = `${a.user.firstName} ${a.user.lastName}`;
      const branchName = a.branch.name;

      if (a.checkInTime) {
        events.push({
          id: `${a.id}-in`,
          userName,
          branchName,
          action: 'check_in',
          time: a.checkInTime,
          status: a.status,
        });
      }

      if (a.checkOutTime) {
        events.push({
          id: `${a.id}-out`,
          userName,
          branchName,
          action: 'check_out',
          time: a.checkOutTime,
          status: a.status,
        });
      }
    }

    // Sort by time descending and limit
    events.sort((a, b) => b.time.getTime() - a.time.getTime());

    return events.slice(0, limit);
  }
}
