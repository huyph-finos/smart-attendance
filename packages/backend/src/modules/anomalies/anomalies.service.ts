import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, AnomalyType, AnomalySeverity } from '@prisma/client';
import { paginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class AnomaliesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: {
      page?: number;
      limit?: number;
      severity?: AnomalySeverity;
      type?: AnomalyType;
      isResolved?: boolean;
      branchId?: string;
    },
    user: { id: string; role: string; branchId?: string },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AnomalyWhereInput = {};

    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.isResolved !== undefined) {
      where.isResolved = query.isResolved;
    }

    // Branch filter: managers auto-filter to their branch
    const branchId =
      user.role === 'MANAGER' ? user.branchId : query.branchId;
    if (branchId) {
      where.attendance = { branchId };
    }

    const [data, total] = await Promise.all([
      this.prisma.anomaly.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          attendance: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
              branch: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      this.prisma.anomaly.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  async getStats(user: { id: string; role: string; branchId?: string }) {
    const baseWhere: Prisma.AnomalyWhereInput = {};

    if (user.role === 'MANAGER' && user.branchId) {
      baseWhere.attendance = { branchId: user.branchId };
    }

    const [total, unresolved, critical, high] = await Promise.all([
      this.prisma.anomaly.count({ where: baseWhere }),
      this.prisma.anomaly.count({
        where: { ...baseWhere, isResolved: false },
      }),
      this.prisma.anomaly.count({
        where: { ...baseWhere, severity: AnomalySeverity.CRITICAL, isResolved: false },
      }),
      this.prisma.anomaly.count({
        where: { ...baseWhere, severity: AnomalySeverity.HIGH, isResolved: false },
      }),
    ]);

    return { total, unresolved, critical, high };
  }

  async findOne(id: string) {
    const anomaly = await this.prisma.anomaly.findUnique({
      where: { id },
      include: {
        attendance: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!anomaly) {
      throw new NotFoundException('Anomaly not found');
    }

    return anomaly;
  }

  async resolve(
    id: string,
    resolvedBy: string,
    resolvedNote: string,
  ) {
    const anomaly = await this.prisma.anomaly.findUnique({
      where: { id },
    });

    if (!anomaly) {
      throw new NotFoundException('Anomaly not found');
    }

    return this.prisma.anomaly.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedBy,
        resolvedAt: new Date(),
        resolvedNote,
      },
      include: {
        attendance: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });
  }
}
