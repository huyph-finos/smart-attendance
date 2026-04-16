import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DailySummaryService {
  private readonly logger = new Logger(DailySummaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs at 1:00 AM daily (Asia/Ho_Chi_Minh) to aggregate yesterday's
   * attendance into DailySummary rows — one per active branch.
   * This enables the fast path in DashboardService.getTrends().
   */
  @Cron('0 1 * * *', { name: 'daily-summary', timeZone: 'Asia/Ho_Chi_Minh' })
  async generateYesterdaySummary() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const dateStr = yesterday.toISOString().split('T')[0];
    this.logger.log(`Generating DailySummary for ${dateStr}`);

    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    // Batch queries: attendance stats + employee counts + overtime/hours + anomalies
    const [attendanceGroups, employeeCounts, hoursAgg, anomalyCounts, leaveCountGroups] =
      await Promise.all([
        this.prisma.attendance.groupBy({
          by: ['branchId', 'status'],
          where: { date: yesterday },
          _count: { id: true },
        }),
        this.prisma.user.groupBy({
          by: ['branchId'],
          where: { isActive: true },
          _count: { id: true },
        }),
        this.prisma.attendance.groupBy({
          by: ['branchId'],
          where: { date: yesterday, totalHours: { not: null } },
          _avg: { totalHours: true },
          _sum: { overtimeHours: true },
        }),
        this.prisma.anomaly.groupBy({
          by: ['attendanceId'],
          where: { attendance: { date: yesterday } },
          _count: { id: true },
        }),
        this.prisma.leave.groupBy({
          by: ['userId'],
          where: {
            isApproved: true,
            startDate: { lte: yesterday },
            endDate: { gte: yesterday },
          },
          _count: { id: true },
        }),
      ]);

    // Build lookup maps
    const empMap = new Map(employeeCounts.map((e) => [e.branchId, e._count.id]));

    const attendMap = new Map<string, Record<string, number>>();
    for (const g of attendanceGroups) {
      if (!g.branchId) continue;
      if (!attendMap.has(g.branchId)) attendMap.set(g.branchId, {});
      attendMap.get(g.branchId)![g.status] = g._count.id;
    }

    const hoursMap = new Map(
      hoursAgg.map((h) => [h.branchId, { avg: h._avg.totalHours, overtime: h._sum.overtimeHours }]),
    );

    // Upsert one DailySummary row per branch
    const results = await Promise.allSettled(
      branches.map((branch) => {
        const statusMap = attendMap.get(branch.id) ?? {};
        const presentCount = (statusMap['ON_TIME'] ?? 0) + (statusMap['LATE'] ?? 0);
        const lateCount = statusMap['LATE'] ?? 0;
        const totalEmployees = empMap.get(branch.id) ?? 0;
        const absentCount = Math.max(0, totalEmployees - presentCount);
        const hours = hoursMap.get(branch.id);

        return this.prisma.dailySummary.upsert({
          where: { branchId_date: { branchId: branch.id, date: yesterday } },
          create: {
            branchId: branch.id,
            date: yesterday,
            totalEmployees,
            presentCount,
            lateCount,
            absentCount,
            onLeaveCount: 0,
            avgHoursWorked: hours?.avg ?? null,
            totalOvertimeHrs: hours?.overtime ?? null,
          },
          update: {
            totalEmployees,
            presentCount,
            lateCount,
            absentCount,
            avgHoursWorked: hours?.avg ?? null,
            totalOvertimeHrs: hours?.overtime ?? null,
          },
        });
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    this.logger.log(
      `DailySummary generated for ${branches.length} branches (${failed} failed) — ${dateStr}`,
    );
  }
}
