import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { AddWifiDto } from './dto/add-wifi.dto';
import { PaginationDto, paginatedResponse } from '../../common/dto/pagination.dto';

interface BranchFilters {
  isActive?: boolean;
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('Branch code already exists');
    }

    return this.prisma.branch.create({
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radius: dto.radius,
        workStartTime: dto.workStartTime,
        workEndTime: dto.workEndTime,
        lateThreshold: dto.lateThreshold,
      },
    });
  }

  async findAll(pagination: PaginationDto, filters: BranchFilters = {}) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const sortBy = pagination.sortBy ?? 'createdAt';
    const sortOrder = pagination.sortOrder ?? 'desc';
    const search = pagination.search;
    const skip = (page - 1) * limit;

    const where: Prisma.BranchWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: { select: { employees: true } },
        },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        wifiConfigs: true,
        _count: { select: { employees: true } },
      },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);

    return this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radius: dto.radius,
        workStartTime: dto.workStartTime,
        workEndTime: dto.workEndTime,
        lateThreshold: dto.lateThreshold,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async addWifi(branchId: string, dto: AddWifiDto) {
    await this.findOne(branchId);

    return this.prisma.branchWifi.create({
      data: {
        branchId,
        ssid: dto.ssid,
        bssid: dto.bssid,
        floor: dto.floor,
      },
    });
  }

  async removeWifi(branchId: string, wifiId: string) {
    const wifi = await this.prisma.branchWifi.findFirst({
      where: { id: wifiId, branchId },
    });
    if (!wifi) {
      throw new NotFoundException('WiFi configuration not found');
    }

    return this.prisma.branchWifi.delete({
      where: { id: wifiId },
    });
  }

  async getEmployees(branchId: string, pagination: PaginationDto) {
    await this.findOne(branchId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const sortBy = pagination.sortBy ?? 'createdAt';
    const sortOrder = pagination.sortOrder ?? 'desc';
    const search = pagination.search;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      branchId,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  async getDashboard(branchId: string) {
    await this.findOne(branchId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalEmployees, activeEmployees, todayAttendances, todayLate] =
      await Promise.all([
        this.prisma.user.count({ where: { branchId } }),
        this.prisma.user.count({ where: { branchId, isActive: true } }),
        this.prisma.attendance.count({
          where: { branchId, date: today },
        }),
        this.prisma.attendance.count({
          where: { branchId, date: today, status: 'LATE' },
        }),
      ]);

    return {
      totalEmployees,
      activeEmployees,
      todayAttendances,
      todayLate,
      attendanceRate:
        activeEmployees > 0
          ? Math.round((todayAttendances / activeEmployees) * 100)
          : 0,
    };
  }
}
