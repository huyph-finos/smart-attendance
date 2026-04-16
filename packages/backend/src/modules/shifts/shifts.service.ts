import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShiftType } from '@prisma/client';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(branchId?: string) {
    const where = branchId ? { branchId, isActive: true } : { isActive: true };

    return this.prisma.shift.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: {
    branchId: string;
    name: string;
    type: ShiftType;
    startTime: string;
    endTime: string;
  }) {
    return this.prisma.shift.create({
      data: {
        branchId: data.branchId,
        name: data.name,
        type: data.type,
        startTime: data.startTime,
        endTime: data.endTime,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async assign(
    assignments: Array<{ userId: string; shiftId: string; date: string }>,
  ) {
    const results = await Promise.allSettled(
      assignments.map((a) =>
        this.prisma.shiftAssignment.upsert({
          where: {
            userId_date: {
              userId: a.userId,
              date: new Date(a.date),
            },
          },
          create: {
            userId: a.userId,
            shiftId: a.shiftId,
            date: new Date(a.date),
          },
          update: {
            shiftId: a.shiftId,
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            shift: { select: { id: true, name: true, type: true } },
          },
        }),
      ),
    );

    const created = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<unknown>).value);
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r, i) => ({
        assignment: assignments[i],
        error: (r as PromiseRejectedResult).reason?.message ?? 'Unknown error',
      }));

    return {
      total: assignments.length,
      created: created.length,
      errors: errors.length,
      data: created,
      failures: errors,
    };
  }

  async getWeeklySchedule(branchId: string, weekOf: string) {
    const startDate = new Date(weekOf);
    startDate.setHours(0, 0, 0, 0);
    // Set to Monday of that week
    const day = startDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startDate.setDate(startDate.getDate() + diff);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        shift: { branchId },
        date: { gte: startDate, lte: endDate },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        shift: { select: { id: true, name: true, type: true, startTime: true, endTime: true } },
      },
      orderBy: [{ date: 'asc' }, { shift: { startTime: 'asc' } }],
    });

    // Group by date
    const schedule: Record<string, typeof assignments> = {};
    for (const assignment of assignments) {
      const dateKey = assignment.date.toISOString().split('T')[0];
      if (!schedule[dateKey]) {
        schedule[dateKey] = [];
      }
      schedule[dateKey].push(assignment);
    }

    return {
      branchId,
      weekOf: startDate.toISOString().split('T')[0],
      weekEnd: endDate.toISOString().split('T')[0],
      schedule,
    };
  }
}
