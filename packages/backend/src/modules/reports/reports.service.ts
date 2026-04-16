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
    if (branchId) branchWhere.id = branchId;

    const attendanceWhere: Prisma.AttendanceWhereInput = { date: reportDate };
    if (branchId) attendanceWhere.branchId = branchId;

    // Batch all queries (was: N branches × 5 queries = 500 queries for 100 branches)
    const [branches, employeeCounts, attendanceGroups, leaveCounts, avgHoursAgg, checkInRecords] =
      await Promise.all([
        this.prisma.branch.findMany({
          where: branchWhere,
          select: { id: true, name: true, code: true },
        }),
        this.prisma.user.groupBy({
          by: ['branchId'],
          where: { isActive: true, ...(branchId ? { branchId } : {}) },
          _count: { id: true },
        }),
        this.prisma.attendance.groupBy({
          by: ['branchId', 'status'],
          where: attendanceWhere,
          _count: { id: true },
        }),
        this.prisma.leave.findMany({
          where: {
            ...(branchId ? { user: { branchId } } : {}),
            isApproved: true,
            startDate: { lte: reportDate },
            endDate: { gte: reportDate },
          },
          select: { user: { select: { branchId: true } } },
        }),
        this.prisma.attendance.groupBy({
          by: ['branchId'],
          where: { ...attendanceWhere, totalHours: { not: null } },
          _avg: { totalHours: true },
        }),
        this.prisma.attendance.findMany({
          where: { ...attendanceWhere, checkInTime: { not: null } },
          select: { branchId: true, checkInTime: true },
        }),
      ]);

    // Build lookup maps
    const employeeMap = new Map(employeeCounts.map((e) => [e.branchId, e._count.id]));

    const statusByBranch = new Map<string, Record<string, number>>();
    for (const g of attendanceGroups) {
      if (!statusByBranch.has(g.branchId)) statusByBranch.set(g.branchId, {});
      statusByBranch.get(g.branchId)![g.status] = g._count.id;
    }

    const leaveByBranch = new Map<string, number>();
    for (const l of leaveCounts) {
      const bid = l.user.branchId;
      if (bid) leaveByBranch.set(bid, (leaveByBranch.get(bid) ?? 0) + 1);
    }

    const avgHoursMap = new Map(avgHoursAgg.map((a) => [a.branchId, a._avg.totalHours]));

    const checkInByBranch = new Map<string, Date[]>();
    for (const r of checkInRecords) {
      if (!checkInByBranch.has(r.branchId)) checkInByBranch.set(r.branchId, []);
      checkInByBranch.get(r.branchId)!.push(r.checkInTime!);
    }

    const branchStats: BranchDailyStats[] = branches.map((branch) => {
      const totalEmployees = employeeMap.get(branch.id) ?? 0;
      const statusMap = statusByBranch.get(branch.id) ?? {};
      const present = (statusMap['ON_TIME'] ?? 0) + (statusMap['LATE'] ?? 0);
      const late = statusMap['LATE'] ?? 0;
      const onLeave = leaveByBranch.get(branch.id) ?? 0;
      const absent = Math.max(0, totalEmployees - present - onLeave);
      const avgHours = avgHoursMap.get(branch.id);

      let avgCheckIn: string | null = null;
      const times = checkInByBranch.get(branch.id);
      if (times && times.length > 0) {
        const totalMinutes = times.reduce((sum, t) => sum + t.getHours() * 60 + t.getMinutes(), 0);
        const avgMinutes = Math.round(totalMinutes / times.length);
        const hours = Math.floor(avgMinutes / 60);
        const mins = avgMinutes % 60;
        avgCheckIn = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }

      return {
        branchName: branch.name,
        totalEmployees,
        present,
        late,
        absent,
        onLeave,
        avgCheckIn,
        avgHours: avgHours ? Math.round(avgHours * 100) / 100 : null,
      };
    });

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
    if (branchId) branchWhere.id = branchId;

    const attendanceWhere: Prisma.AttendanceWhereInput = {
      date: { gte: monday, lte: sunday },
    };
    if (branchId) attendanceWhere.branchId = branchId;

    const [branches, employeeCounts, attendanceGroups, leaveCounts, avgHoursAgg] =
      await Promise.all([
        this.prisma.branch.findMany({
          where: branchWhere,
          select: { id: true, name: true, code: true },
        }),
        this.prisma.user.groupBy({
          by: ['branchId'],
          where: { isActive: true, ...(branchId ? { branchId } : {}) },
          _count: { id: true },
        }),
        this.prisma.attendance.groupBy({
          by: ['branchId', 'status'],
          where: attendanceWhere,
          _count: { id: true },
        }),
        this.prisma.leave.findMany({
          where: {
            ...(branchId ? { user: { branchId } } : {}),
            isApproved: true,
            startDate: { lte: sunday },
            endDate: { gte: monday },
          },
          select: { user: { select: { branchId: true } } },
        }),
        this.prisma.attendance.groupBy({
          by: ['branchId'],
          where: { ...attendanceWhere, totalHours: { not: null } },
          _avg: { totalHours: true },
        }),
      ]);

    const employeeMap = new Map(employeeCounts.map((e) => [e.branchId, e._count.id]));
    const statusByBranch = new Map<string, Record<string, number>>();
    for (const g of attendanceGroups) {
      if (!statusByBranch.has(g.branchId)) statusByBranch.set(g.branchId, {});
      statusByBranch.get(g.branchId)![g.status] = g._count.id;
    }
    const leaveByBranch = new Map<string, number>();
    for (const l of leaveCounts) {
      const bid = l.user.branchId;
      if (bid) leaveByBranch.set(bid, (leaveByBranch.get(bid) ?? 0) + 1);
    }
    const avgHoursMap = new Map(avgHoursAgg.map((a) => [a.branchId, a._avg.totalHours]));

    const weeklyStats = branches.map((branch) => {
      const totalEmployees = employeeMap.get(branch.id) ?? 0;
      const statusMap = statusByBranch.get(branch.id) ?? {};
      const present = (statusMap['ON_TIME'] ?? 0) + (statusMap['LATE'] ?? 0);
      const late = statusMap['LATE'] ?? 0;
      const onLeave = leaveByBranch.get(branch.id) ?? 0;
      const workdays = totalEmployees * 5;
      const absent = Math.max(0, workdays - present - onLeave);
      const avgHours = avgHoursMap.get(branch.id);

      return {
        branchName: branch.name,
        totalEmployees,
        workdays,
        present,
        late,
        absent,
        onLeave,
        avgHours: avgHours ? Math.round(avgHours * 100) / 100 : null,
      };
    });

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
    if (branchId) branchWhere.id = branchId;

    const attendanceWhere: Prisma.AttendanceWhereInput = {
      date: { gte: startDate, lte: endDate },
    };
    if (branchId) attendanceWhere.branchId = branchId;

    // Count working days in the month (Mon-Fri)
    let workingDays = 0;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) workingDays++;
      cursor.setDate(cursor.getDate() + 1);
    }

    const [branches, employeeCounts, attendanceGroups, leaveCounts, avgHoursAgg] =
      await Promise.all([
        this.prisma.branch.findMany({
          where: branchWhere,
          select: { id: true, name: true, code: true },
        }),
        this.prisma.user.groupBy({
          by: ['branchId'],
          where: { isActive: true, ...(branchId ? { branchId } : {}) },
          _count: { id: true },
        }),
        this.prisma.attendance.groupBy({
          by: ['branchId', 'status'],
          where: attendanceWhere,
          _count: { id: true },
        }),
        this.prisma.leave.findMany({
          where: {
            ...(branchId ? { user: { branchId } } : {}),
            isApproved: true,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { user: { select: { branchId: true } } },
        }),
        this.prisma.attendance.groupBy({
          by: ['branchId'],
          where: { ...attendanceWhere, totalHours: { not: null } },
          _avg: { totalHours: true },
        }),
      ]);

    const employeeMap = new Map(employeeCounts.map((e) => [e.branchId, e._count.id]));
    const statusByBranch = new Map<string, Record<string, number>>();
    for (const g of attendanceGroups) {
      if (!statusByBranch.has(g.branchId)) statusByBranch.set(g.branchId, {});
      statusByBranch.get(g.branchId)![g.status] = g._count.id;
    }
    const leaveByBranch = new Map<string, number>();
    for (const l of leaveCounts) {
      const bid = l.user.branchId;
      if (bid) leaveByBranch.set(bid, (leaveByBranch.get(bid) ?? 0) + 1);
    }
    const avgHoursMap = new Map(avgHoursAgg.map((a) => [a.branchId, a._avg.totalHours]));

    const monthlyStats = branches.map((branch) => {
      const totalEmployees = employeeMap.get(branch.id) ?? 0;
      const statusMap = statusByBranch.get(branch.id) ?? {};
      const present = (statusMap['ON_TIME'] ?? 0) + (statusMap['LATE'] ?? 0);
      const late = statusMap['LATE'] ?? 0;
      const onLeave = leaveByBranch.get(branch.id) ?? 0;
      const totalWorkSlots = totalEmployees * workingDays;
      const absent = Math.max(0, totalWorkSlots - present - onLeave);
      const avgHours = avgHoursMap.get(branch.id);

      return {
        branchName: branch.name,
        totalEmployees,
        workingDays,
        present,
        late,
        absent,
        onLeave,
        avgHours: avgHours ? Math.round(avgHours * 100) / 100 : null,
      };
    });

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
