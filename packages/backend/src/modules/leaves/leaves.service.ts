import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { PaginationDto, paginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateLeaveDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    return this.prisma.leave.create({
      data: {
        userId,
        type: dto.type,
        startDate,
        endDate,
        reason: dto.reason,
        isApproved: null, // pending
      },
    });
  }

  async findMyLeaves(userId: string, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const sortBy = pagination.sortBy ?? 'createdAt';
    const sortOrder = pagination.sortOrder ?? 'desc';
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.leave.findMany({
        where: { userId },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.leave.count({ where: { userId } }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  async findPending(branchId: string | undefined, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const sortBy = pagination.sortBy ?? 'createdAt';
    const sortOrder = pagination.sortOrder ?? 'desc';
    const skip = (page - 1) * limit;

    const where: any = { isApproved: null };
    if (branchId) {
      where.user = { branchId };
    }

    const [data, total] = await Promise.all([
      this.prisma.leave.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, branchId: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.leave.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  async approve(id: string, approvedBy: string, isApproved: boolean) {
    const leave = await this.prisma.leave.findUnique({ where: { id } });

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    if (leave.isApproved !== null) {
      throw new BadRequestException('Leave request has already been processed');
    }

    return this.prisma.leave.update({
      where: { id },
      data: { isApproved, approvedBy },
    });
  }

  async cancel(id: string, userId: string) {
    const leave = await this.prisma.leave.findUnique({ where: { id } });

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    if (leave.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    if (leave.isApproved !== null) {
      throw new BadRequestException('Can only cancel pending leave requests');
    }

    return this.prisma.leave.delete({ where: { id } });
  }
}
