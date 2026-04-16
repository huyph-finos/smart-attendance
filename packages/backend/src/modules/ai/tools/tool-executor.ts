/**
 * Tool Executor - Executes tool calls against the database
 *
 * Each tool function receives validated input and the Prisma client,
 * executes the appropriate query, and returns a JSON-serializable result.
 * For MANAGER role, queries are automatically scoped to their branch.
 */

import { PrismaService } from '../../../prisma/prisma.service';

interface UserContext {
  userId: string;
  role: string;
  branchId?: string;
}

/**
 * Execute a named tool with the given input. Returns a JSON string result.
 * Throws on unknown tool names.
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, any>,
  prisma: PrismaService,
  userContext: UserContext,
): Promise<string> {
  // For managers, enforce branch scoping unless they explicitly query a different branch
  const effectiveBranchId =
    userContext.role === 'MANAGER' && !toolInput.branchId
      ? userContext.branchId
      : toolInput.branchId;

  switch (toolName) {
    case 'query_attendance':
      return JSON.stringify(
        await queryAttendance(toolInput, prisma, effectiveBranchId),
      );
    case 'query_employees':
      return JSON.stringify(
        await queryEmployees(toolInput, prisma, effectiveBranchId),
      );
    case 'aggregate_stats':
      return JSON.stringify(
        await aggregateStats(toolInput, prisma, effectiveBranchId),
      );
    case 'detect_patterns':
      return JSON.stringify(
        await detectPatterns(toolInput, prisma, effectiveBranchId),
      );
    case 'get_branch_info':
      return JSON.stringify(await getBranchInfo(toolInput, prisma));
    case 'calculate_overtime':
      return JSON.stringify(await calculateOvertime(toolInput, prisma));
    case 'get_leave_balance':
      return JSON.stringify(await getLeaveBalance(toolInput, prisma));
    case 'send_notification':
      return JSON.stringify(await sendNotification(toolInput, prisma));
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function queryAttendance(
  input: Record<string, any>,
  prisma: PrismaService,
  branchId?: string,
) {
  const limit = Math.min(input.limit ?? 50, 200);

  const where: Record<string, any> = {
    date: {
      gte: new Date(input.startDate),
      lte: new Date(input.endDate),
    },
  };
  if (branchId) where.branchId = branchId;
  if (input.userId) where.userId = input.userId;
  if (input.status) where.status = input.status;

  const records = await prisma.attendance.findMany({
    where,
    take: limit,
    orderBy: { date: 'desc' },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  return {
    count: records.length,
    records: records.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: `${r.user.firstName} ${r.user.lastName}`,
      userEmail: r.user.email,
      branch: r.branch.name,
      date: r.date.toISOString().split('T')[0],
      checkIn: r.checkInTime?.toISOString() ?? null,
      checkOut: r.checkOutTime?.toISOString() ?? null,
      status: r.status,
      totalHours: r.totalHours,
      overtimeHours: r.overtimeHours,
      fraudScore: r.fraudScore,
    })),
  };
}

async function queryEmployees(
  input: Record<string, any>,
  prisma: PrismaService,
  branchId?: string,
) {
  const limit = Math.min(input.limit ?? 50, 200);

  const where: Record<string, any> = { isActive: true };
  if (branchId) where.branchId = branchId;
  if (input.departmentId) where.departmentId = input.departmentId;
  if (input.role) where.role = input.role;
  if (input.search) {
    where.OR = [
      { firstName: { contains: input.search, mode: 'insensitive' } },
      { lastName: { contains: input.search, mode: 'insensitive' } },
      { email: { contains: input.search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      phone: true,
      branch: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  return { count: users.length, employees: users };
}

async function aggregateStats(
  input: Record<string, any>,
  prisma: PrismaService,
  branchId?: string,
) {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  const where: Record<string, any> = {
    date: { gte: startDate, lte: endDate },
  };
  if (branchId) where.branchId = branchId;

  if (input.metric === 'attendance_rate') {
    const total = await prisma.attendance.count({ where });
    const onTime = await prisma.attendance.count({
      where: { ...where, status: 'ON_TIME' },
    });
    const late = await prisma.attendance.count({
      where: { ...where, status: 'LATE' },
    });
    const absent = await prisma.attendance.count({
      where: { ...where, status: 'ABSENT' },
    });
    return {
      metric: 'attendance_rate',
      total,
      onTime,
      late,
      absent,
      rate: total > 0 ? ((onTime + late) / total) * 100 : 0,
    };
  }

  if (input.metric === 'late_count') {
    const lateRecords = await prisma.attendance.findMany({
      where: { ...where, status: 'LATE' },
      include: {
        user: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });
    return {
      metric: 'late_count',
      totalLate: lateRecords.length,
      records: lateRecords.map((r) => ({
        userName: `${r.user.firstName} ${r.user.lastName}`,
        branch: r.branch.name,
        date: r.date.toISOString().split('T')[0],
        checkIn: r.checkInTime?.toISOString() ?? null,
      })),
    };
  }

  if (input.metric === 'avg_hours') {
    const result = await prisma.attendance.aggregate({
      where: { ...where, totalHours: { not: null } },
      _avg: { totalHours: true },
      _min: { totalHours: true },
      _max: { totalHours: true },
      _count: true,
    });
    return {
      metric: 'avg_hours',
      avgHours: result._avg.totalHours ?? 0,
      minHours: result._min.totalHours ?? 0,
      maxHours: result._max.totalHours ?? 0,
      recordCount: result._count,
    };
  }

  if (input.metric === 'overtime') {
    const result = await prisma.attendance.aggregate({
      where: { ...where, overtimeHours: { gt: 0 } },
      _sum: { overtimeHours: true },
      _avg: { overtimeHours: true },
      _count: true,
    });
    return {
      metric: 'overtime',
      totalOvertimeHours: result._sum.overtimeHours ?? 0,
      avgOvertimeHours: result._avg.overtimeHours ?? 0,
      recordsWithOvertime: result._count,
    };
  }

  return { error: `Unknown metric: ${input.metric}` };
}

async function detectPatterns(
  input: Record<string, any>,
  prisma: PrismaService,
  branchId?: string,
) {
  const [startStr, endStr] = (input.dateRange as string).split('/');
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  const where: Record<string, any> = {
    date: { gte: startDate, lte: endDate },
  };
  if (branchId) where.branchId = branchId;
  if (input.userId) where.userId = input.userId;

  if (input.patternType === 'anomaly') {
    const anomalies = await prisma.anomaly.findMany({
      where: {
        attendance: where,
      },
      include: {
        attendance: {
          select: {
            userId: true,
            date: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      patternType: 'anomaly',
      totalAnomalies: anomalies.length,
      anomalies: anomalies.map((a) => ({
        type: a.type,
        severity: a.severity,
        description: a.description,
        userName: `${a.attendance.user.firstName} ${a.attendance.user.lastName}`,
        date: a.attendance.date.toISOString().split('T')[0],
        isResolved: a.isResolved,
      })),
    };
  }

  if (input.patternType === 'time') {
    const records = await prisma.attendance.findMany({
      where,
      select: {
        userId: true,
        checkInTime: true,
        checkOutTime: true,
        date: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: 'asc' },
      take: 200,
    });

    // Group by user and compute average check-in hour
    const byUser: Record<string, { name: string; checkIns: number[] }> = {};
    for (const r of records) {
      if (!r.checkInTime) continue;
      if (!byUser[r.userId]) {
        byUser[r.userId] = {
          name: `${r.user.firstName} ${r.user.lastName}`,
          checkIns: [],
        };
      }
      byUser[r.userId].checkIns.push(
        r.checkInTime.getHours() + r.checkInTime.getMinutes() / 60,
      );
    }

    const patterns = Object.entries(byUser).map(([uid, data]) => {
      const avg =
        data.checkIns.reduce((a, b) => a + b, 0) / data.checkIns.length;
      const variance =
        data.checkIns.reduce((a, b) => a + (b - avg) ** 2, 0) /
        data.checkIns.length;
      return {
        userId: uid,
        userName: data.name,
        avgCheckInHour: Math.round(avg * 100) / 100,
        varianceHours: Math.round(variance * 100) / 100,
        sampleSize: data.checkIns.length,
      };
    });

    return { patternType: 'time', patterns };
  }

  if (input.patternType === 'frequency') {
    const absences = await prisma.attendance.groupBy({
      by: ['userId'],
      where: { ...where, status: { in: ['ABSENT', 'LATE'] } },
      _count: true,
    });

    const userIds = absences.map((a) => a.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = Object.fromEntries(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );

    return {
      patternType: 'frequency',
      patterns: absences
        .map((a) => ({
          userId: a.userId,
          userName: userMap[a.userId] ?? 'Unknown',
          absenceLateCount: a._count,
        }))
        .sort((a, b) => b.absenceLateCount - a.absenceLateCount),
    };
  }

  if (input.patternType === 'location') {
    const suspicious = await prisma.attendance.findMany({
      where: { ...where, fraudScore: { gte: 0.5 } },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { fraudScore: 'desc' },
      take: 50,
    });
    return {
      patternType: 'location',
      suspiciousRecords: suspicious.map((r) => ({
        userId: r.userId,
        userName: `${r.user.firstName} ${r.user.lastName}`,
        date: r.date.toISOString().split('T')[0],
        fraudScore: r.fraudScore,
        checkInDistance: r.checkInDistance,
        checkInLat: r.checkInLat,
        checkInLng: r.checkInLng,
      })),
    };
  }

  return { error: `Unknown pattern type: ${input.patternType}` };
}

async function getBranchInfo(
  input: Record<string, any>,
  prisma: PrismaService,
) {
  const where: Record<string, any> = input.branchId
    ? { id: input.branchId }
    : { isActive: true };

  const branches = await prisma.branch.findMany({
    where,
    include: {
      wifiConfigs: { where: { isActive: true }, select: { ssid: true, bssid: true, floor: true } },
      _count: { select: { employees: true, departments: true } },
    },
  });

  return {
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      address: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      radius: b.radius,
      timezone: b.timezone,
      workStartTime: b.workStartTime,
      workEndTime: b.workEndTime,
      lateThreshold: b.lateThreshold,
      employeeCount: b._count.employees,
      departmentCount: b._count.departments,
      wifiConfigs: b.wifiConfigs,
    })),
  };
}

async function calculateOvertime(
  input: Record<string, any>,
  prisma: PrismaService,
) {
  const startDate = new Date(input.year, input.month - 1, 1);
  const endDate = new Date(input.year, input.month, 0); // last day of month

  const records = await prisma.attendance.findMany({
    where: {
      userId: input.userId,
      date: { gte: startDate, lte: endDate },
      overtimeHours: { gt: 0 },
    },
    select: {
      date: true,
      totalHours: true,
      overtimeHours: true,
    },
    orderBy: { date: 'asc' },
  });

  const totalOvertime = records.reduce(
    (sum, r) => sum + (r.overtimeHours ?? 0),
    0,
  );

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { firstName: true, lastName: true },
  });

  return {
    userId: input.userId,
    userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
    month: input.month,
    year: input.year,
    totalOvertimeHours: Math.round(totalOvertime * 100) / 100,
    daysWithOvertime: records.length,
    details: records.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      totalHours: r.totalHours,
      overtimeHours: r.overtimeHours,
    })),
  };
}

async function getLeaveBalance(
  input: Record<string, any>,
  prisma: PrismaService,
) {
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31);

  const leaves = await prisma.leave.findMany({
    where: {
      userId: input.userId,
      startDate: { gte: startOfYear },
      endDate: { lte: endOfYear },
    },
    orderBy: { startDate: 'desc' },
  });

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { firstName: true, lastName: true },
  });

  // Calculate days used per type
  const byType: Record<string, { total: number; approved: number; pending: number }> = {};
  for (const leave of leaves) {
    const days =
      Math.ceil(
        (leave.endDate.getTime() - leave.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;
    if (!byType[leave.type]) {
      byType[leave.type] = { total: 0, approved: 0, pending: 0 };
    }
    byType[leave.type].total += days;
    if (leave.isApproved === true) byType[leave.type].approved += days;
    if (leave.isApproved === null) byType[leave.type].pending += days;
  }

  // Standard annual allowance (can be made configurable)
  const annualAllowance = 12;

  return {
    userId: input.userId,
    userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
    year: currentYear,
    annualAllowance,
    usedByType: byType,
    totalUsed: Object.values(byType).reduce((s, v) => s + v.approved, 0),
    remaining: annualAllowance - (byType['ANNUAL']?.approved ?? 0),
    leaves: leaves.map((l) => ({
      id: l.id,
      type: l.type,
      startDate: l.startDate.toISOString().split('T')[0],
      endDate: l.endDate.toISOString().split('T')[0],
      reason: l.reason,
      isApproved: l.isApproved,
    })),
  };
}

async function sendNotification(
  input: Record<string, any>,
  prisma: PrismaService,
) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
    },
  });

  return {
    success: true,
    notificationId: notification.id,
    message: `Notification sent to user ${input.userId}`,
  };
}
