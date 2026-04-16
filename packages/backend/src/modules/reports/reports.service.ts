import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ReportQueryDto } from './dto/report-query.dto';
import * as ExcelJS from 'exceljs';

export interface BranchDailyStats {
  branchName: string;
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  avgCheckIn: string | null;
  avgHours: number | null;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // Daily Report
  // ──────────────────────────────────────────────

  async getDaily(date: string, branchId?: string) {
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    const branchWhere: Prisma.BranchWhereInput = { isActive: true };
    if (branchId) {
      branchWhere.id = branchId;
    }

    const branches = await this.prisma.branch.findMany({
      where: branchWhere,
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    const branchStats: BranchDailyStats[] = [];

    for (const branch of branches) {
      const totalEmployees = await this.prisma.user.count({
        where: { branchId: branch.id, isActive: true },
      });

      const attendanceGroups = await this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          branchId: branch.id,
          date: reportDate,
        },
        _count: { id: true },
      });

      const onLeaveCount = await this.prisma.leave.count({
        where: {
          user: { branchId: branch.id },
          isApproved: true,
          startDate: { lte: reportDate },
          endDate: { gte: reportDate },
        },
      });

      const avgAgg = await this.prisma.attendance.aggregate({
        where: {
          branchId: branch.id,
          date: reportDate,
          totalHours: { not: null },
        },
        _avg: { totalHours: true },
      });

      const statusMap: Record<string, number> = {};
      for (const group of attendanceGroups) {
        statusMap[group.status] = group._count.id;
      }

      const present = (statusMap['ON_TIME'] ?? 0) + (statusMap['LATE'] ?? 0);
      const late = statusMap['LATE'] ?? 0;
      const totalCheckedIn = present;
      const absent = totalEmployees - totalCheckedIn - onLeaveCount;

      // Compute average check-in time
      const checkInRecords = await this.prisma.attendance.findMany({
        where: {
          branchId: branch.id,
          date: reportDate,
          checkInTime: { not: null },
        },
        select: { checkInTime: true },
      });

      let avgCheckIn: string | null = null;
      if (checkInRecords.length > 0) {
        const totalMinutes = checkInRecords.reduce((sum, r) => {
          const t = r.checkInTime!;
          return sum + t.getHours() * 60 + t.getMinutes();
        }, 0);
        const avgMinutes = Math.round(totalMinutes / checkInRecords.length);
        const hours = Math.floor(avgMinutes / 60);
        const mins = avgMinutes % 60;
        avgCheckIn = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }

      branchStats.push({
        branchName: branch.name,
        totalEmployees,
        present,
        late,
        absent: Math.max(0, absent),
        onLeave: onLeaveCount,
        avgCheckIn,
        avgHours: avgAgg._avg.totalHours
          ? Math.round(avgAgg._avg.totalHours * 100) / 100
          : null,
      });
    }

    return { date, branches: branchStats };
  }

  // ──────────────────────────────────────────────
  // Weekly Report
  // ──────────────────────────────────────────────

  async getWeekly(weekOf: string, branchId?: string) {
    const monday = new Date(weekOf);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const branchWhere: Prisma.BranchWhereInput = { isActive: true };
    if (branchId) {
      branchWhere.id = branchId;
    }

    const branches = await this.prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true, code: true },
    });

    const weeklyStats: any[] = [];

    for (const branch of branches) {
      const totalEmployees = await this.prisma.user.count({
        where: { branchId: branch.id, isActive: true },
      });

      const attendanceGroups = await this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          branchId: branch.id,
          date: { gte: monday, lte: sunday },
        },
        _count: { id: true },
      });

      const onLeaveCount = await this.prisma.leave.count({
        where: {
          user: { branchId: branch.id },
          isApproved: true,
          startDate: { lte: sunday },
          endDate: { gte: monday },
        },
      });

      const avgAgg = await this.prisma.attendance.aggregate({
        where: {
          branchId: branch.id,
          date: { gte: monday, lte: sunday },
          totalHours: { not: null },
        },
        _avg: { totalHours: true },
      });

      const statusMap: Record<string, number> = {};
      for (const group of attendanceGroups) {
        statusMap[group.status] = group._count.id;
      }

      const present = (statusMap['ON_TIME'] ?? 0) + (statusMap['LATE'] ?? 0);
      const late = statusMap['LATE'] ?? 0;

      // For weekly, workdays = totalEmployees * 5 (Mon-Fri) as baseline
      const workdays = totalEmployees * 5;
      const absent = workdays - present - onLeaveCount;

      weeklyStats.push({
        branchName: branch.name,
        totalEmployees,
        workdays,
        present,
        late,
        absent: Math.max(0, absent),
        onLeave: onLeaveCount,
        avgHours: avgAgg._avg.totalHours
          ? Math.round(avgAgg._avg.totalHours * 100) / 100
          : null,
      });
    }

    return {
      weekOf,
      weekEnd: sunday.toISOString().split('T')[0],
      branches: weeklyStats,
    };
  }

  // ──────────────────────────────────────────────
  // Monthly Report
  // ──────────────────────────────────────────────

  async getMonthly(month: number, year: number, branchId?: string) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    const branchWhere: Prisma.BranchWhereInput = { isActive: true };
    if (branchId) {
      branchWhere.id = branchId;
    }

    const branches = await this.prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true, code: true },
    });

    const monthlyStats: any[] = [];

    for (const branch of branches) {
      const totalEmployees = await this.prisma.user.count({
        where: { branchId: branch.id, isActive: true },
      });

      const attendanceGroups = await this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          branchId: branch.id,
          date: { gte: startDate, lte: endDate },
        },
        _count: { id: true },
      });

      const onLeaveCount = await this.prisma.leave.count({
        where: {
          user: { branchId: branch.id },
          isApproved: true,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      });

      const avgAgg = await this.prisma.attendance.aggregate({
        where: {
          branchId: branch.id,
          date: { gte: startDate, lte: endDate },
          totalHours: { not: null },
        },
        _avg: { totalHours: true },
      });

      const statusMap: Record<string, number> = {};
      for (const group of attendanceGroups) {
        statusMap[group.status] = group._count.id;
      }

      const present = (statusMap['ON_TIME'] ?? 0) + (statusMap['LATE'] ?? 0);
      const late = statusMap['LATE'] ?? 0;

      // Count working days in the month (Mon-Fri)
      let workingDays = 0;
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) workingDays++;
        cursor.setDate(cursor.getDate() + 1);
      }

      const totalWorkSlots = totalEmployees * workingDays;
      const absent = totalWorkSlots - present - onLeaveCount;

      monthlyStats.push({
        branchName: branch.name,
        totalEmployees,
        workingDays,
        present,
        late,
        absent: Math.max(0, absent),
        onLeave: onLeaveCount,
        avgHours: avgAgg._avg.totalHours
          ? Math.round(avgAgg._avg.totalHours * 100) / 100
          : null,
      });
    }

    return { month, year, branches: monthlyStats };
  }

  // ──────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────

  async getSummary(branchId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const branchFilter: Prisma.AttendanceWhereInput = {};
    const userFilter: Prisma.UserWhereInput = { isActive: true };
    if (branchId) {
      branchFilter.branchId = branchId;
      userFilter.branchId = branchId;
    }

    const [
      totalEmployees,
      totalBranches,
      todayAttendance,
      todayLate,
      todayOnLeave,
      avgHoursAgg,
    ] = await Promise.all([
      this.prisma.user.count({ where: userFilter }),
      this.prisma.branch.count({ where: { isActive: true, ...(branchId ? { id: branchId } : {}) } }),
      this.prisma.attendance.count({
        where: { ...branchFilter, date: today },
      }),
      this.prisma.attendance.count({
        where: { ...branchFilter, date: today, status: 'LATE' },
      }),
      this.prisma.leave.count({
        where: {
          ...(branchId ? { user: { branchId } } : {}),
          isApproved: true,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      }),
      this.prisma.attendance.aggregate({
        where: {
          ...branchFilter,
          date: today,
          totalHours: { not: null },
        },
        _avg: { totalHours: true },
      }),
    ]);

    const todayPresent = todayAttendance;
    const todayAbsent = Math.max(0, totalEmployees - todayPresent - todayOnLeave);
    const attendanceRate =
      totalEmployees > 0
        ? Math.round((todayPresent / totalEmployees) * 10000) / 100
        : 0;

    return {
      totalEmployees,
      totalBranches,
      todayPresent,
      todayLate,
      todayAbsent,
      todayOnLeave,
      attendanceRate,
      avgHoursToday: avgHoursAgg._avg.totalHours
        ? Math.round(avgHoursAgg._avg.totalHours * 100) / 100
        : null,
    };
  }

  // ──────────────────────────────────────────────
  // Export Report (Excel)
  // ──────────────────────────────────────────────

  async exportReport(query: ReportQueryDto): Promise<Buffer> {
    // Determine which report to export
    let reportData: Record<string, unknown>;
    let sheetName: string;

    if (query.date) {
      reportData = await this.getDaily(query.date, query.branchId);
      sheetName = `Daily Report ${query.date}`;
    } else if (query.weekOf) {
      reportData = await this.getWeekly(query.weekOf, query.branchId) as unknown as Record<string, unknown>;
      sheetName = `Weekly Report ${query.weekOf}`;
    } else if (query.month && query.year) {
      reportData = await this.getMonthly(query.month, query.year, query.branchId) as unknown as Record<string, unknown>;
      sheetName = `Monthly Report ${query.year}-${String(query.month).padStart(2, '0')}`;
    } else {
      reportData = await this.getSummary(query.branchId) as unknown as Record<string, unknown>;
      sheetName = 'Summary Report';
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Attendance';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetName);

    const branches = (reportData as { branches?: BranchDailyStats[] }).branches;
    if (branches && Array.isArray(branches)) {
      // Branch-based reports (daily, weekly, monthly)
      sheet.columns = [
        { header: 'Branch', key: 'branchName', width: 25 },
        { header: 'Total Employees', key: 'totalEmployees', width: 18 },
        { header: 'Present', key: 'present', width: 12 },
        { header: 'Late', key: 'late', width: 12 },
        { header: 'Absent', key: 'absent', width: 12 },
        { header: 'On Leave', key: 'onLeave', width: 12 },
        { header: 'Avg Hours', key: 'avgHours', width: 12 },
      ];

      // Style the header row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

      for (const branch of branches) {
        sheet.addRow(branch);
      }
    } else {
      // Summary report
      sheet.columns = [
        { header: 'Metric', key: 'metric', width: 25 },
        { header: 'Value', key: 'value', width: 20 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };

      const entries = Object.entries(reportData);
      for (const [key, value] of entries) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
        sheet.addRow({ metric: label, value });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
