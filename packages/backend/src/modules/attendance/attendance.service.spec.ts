import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AntiFraudService } from './anti-fraud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CheckInDto } from './dto/check-in.dto';

const mockPrisma = {
  user: { findUnique: vi.fn() },
  attendance: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
};

const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const mockAntiFraud = {
  checkFraud: vi.fn(),
  getAnomaliesFromResult: vi.fn().mockReturnValue([]),
  createAnomaly: vi.fn(),
};

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: AntiFraudService, useValue: mockAntiFraud },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  const baseDto: CheckInDto = {
    latitude: 10.7769,
    longitude: 106.7009,
    wifiBssid: 'AA:BB:CC:DD:EE:FF',
    deviceFingerprint: 'fp-123',
    mockLocationDetected: false,
  };

  const mockUserWithBranch = {
    id: 'user-1',
    branchId: 'branch-1',
    isActive: true,
    branch: {
      id: 'branch-1',
      latitude: 10.7769,
      longitude: 106.7009,
      radius: 200,
      workStartTime: '08:00',
      lateThreshold: 15,
    },
  };

  const cleanFraudResult = {
    score: 0,
    passed: true,
    checks: {
      wifi: { score: 0, detail: 'ok' },
      gps: { score: 0, detail: 'ok' },
      device: { score: 0, detail: 'ok' },
      speed: { score: 0, detail: 'ok' },
    },
  };

  // ──────────────────────────────────────────────
  // Check-In
  // ──────────────────────────────────────────────

  describe('checkIn', () => {
    it('should successfully check in with ON_TIME status', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithBranch);
      mockPrisma.attendance.findUnique.mockResolvedValue(null); // no existing
      mockAntiFraud.checkFraud.mockResolvedValue(cleanFraudResult);
      mockPrisma.attendance.create.mockResolvedValue({
        id: 'att-1',
        status: 'ON_TIME',
        branch: { name: 'HCM Q1', code: 'HCM-Q1' },
      });

      const result = await service.checkIn('user-1', baseDto);

      expect(result.attendance).toBeDefined();
      expect(result.fraudCheck.score).toBe(0);
      expect(mockPrisma.attendance.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.checkIn('non-existent', baseDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user has no branch', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        branch: null,
      });

      await expect(service.checkIn('user-1', baseDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when already checked in today', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithBranch);
      mockPrisma.attendance.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.checkIn('user-1', baseDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ForbiddenException when fraud check blocks', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithBranch);
      mockPrisma.attendance.findUnique.mockResolvedValue(null);
      mockAntiFraud.checkFraud.mockResolvedValue({
        ...cleanFraudResult,
        score: 95,
        passed: false,
      });

      await expect(service.checkIn('user-1', baseDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create anomaly records when fraud score > 50', async () => {
      const highFraud = {
        score: 65,
        passed: true,
        checks: {
          wifi: { score: 30, detail: 'mismatch' },
          gps: { score: 20, detail: 'near' },
          device: { score: 15, detail: 'new' },
          speed: { score: 0, detail: 'ok' },
        },
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithBranch);
      mockPrisma.attendance.findUnique.mockResolvedValue(null);
      mockAntiFraud.checkFraud.mockResolvedValue(highFraud);
      mockAntiFraud.getAnomaliesFromResult.mockReturnValue([
        { type: 'WIFI_MISMATCH', severity: 'MEDIUM', description: 'mismatch' },
      ]);
      mockPrisma.attendance.create.mockResolvedValue({
        id: 'att-1',
        status: 'ON_TIME',
        branch: { name: 'HCM Q1', code: 'HCM-Q1' },
      });

      await service.checkIn('user-1', baseDto);

      expect(mockAntiFraud.createAnomaly).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // Check-Out
  // ──────────────────────────────────────────────

  describe('checkOut', () => {
    it('should throw NotFoundException when no check-in exists', async () => {
      mockPrisma.attendance.findUnique.mockResolvedValue(null);

      await expect(service.checkOut('user-1', baseDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when already checked out', async () => {
      mockPrisma.attendance.findUnique.mockResolvedValue({
        id: 'att-1',
        checkOutTime: new Date(),
        branch: mockUserWithBranch.branch,
      });

      await expect(service.checkOut('user-1', baseDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should successfully check out and calculate hours', async () => {
      const checkInTime = new Date();
      checkInTime.setHours(checkInTime.getHours() - 8); // 8 hours ago

      mockPrisma.attendance.findUnique.mockResolvedValue({
        id: 'att-1',
        branchId: 'branch-1',
        checkInTime,
        checkOutTime: null,
        fraudScore: 0,
        branch: mockUserWithBranch.branch,
      });
      mockAntiFraud.checkFraud.mockResolvedValue(cleanFraudResult);
      mockPrisma.attendance.update.mockResolvedValue({
        id: 'att-1',
        totalHours: 8,
        branch: { name: 'HCM Q1', code: 'HCM-Q1' },
      });

      const result = await service.checkOut('user-1', baseDto);
      expect(result.attendance).toBeDefined();
      expect(mockPrisma.attendance.update).toHaveBeenCalled();
    });

    it('should block check-out when fraud score > 90', async () => {
      mockPrisma.attendance.findUnique.mockResolvedValue({
        id: 'att-1',
        branchId: 'branch-1',
        checkInTime: new Date(),
        checkOutTime: null,
        fraudScore: 0,
        branch: mockUserWithBranch.branch,
      });
      mockAntiFraud.checkFraud.mockResolvedValue({
        score: 95,
        passed: false,
        checks: cleanFraudResult.checks,
      });

      await expect(service.checkOut('user-1', baseDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ──────────────────────────────────────────────
  // Get Today
  // ──────────────────────────────────────────────

  describe('getToday', () => {
    it('should return cached attendance if available', async () => {
      const cached = { id: 'att-1', status: 'ON_TIME' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getToday('user-1');
      expect(result).toEqual(cached);
      expect(mockPrisma.attendance.findUnique).not.toHaveBeenCalled();
    });

    it('should query DB and cache if not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      const attendance = { id: 'att-1', status: 'ON_TIME' };
      mockPrisma.attendance.findUnique.mockResolvedValue(attendance);

      const result = await service.getToday('user-1');
      expect(result).toEqual(attendance);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return null when no attendance today', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.attendance.findUnique.mockResolvedValue(null);

      const result = await service.getToday('user-1');
      expect(result).toBeNull();
    });
  });
});
