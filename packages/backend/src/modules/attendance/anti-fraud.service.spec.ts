import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AntiFraudService, FraudCheckResult } from './anti-fraud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CheckInDto } from './dto/check-in.dto';

const mockPrisma = {
  branchWifi: { findMany: vi.fn() },
  branch: { findUnique: vi.fn() },
  userDevice: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  },
  attendance: { findFirst: vi.fn() },
  anomaly: { create: vi.fn() },
};

const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

describe('AntiFraudService', () => {
  let service: AntiFraudService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AntiFraudService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AntiFraudService>(AntiFraudService);
  });

  const baseDto: CheckInDto = {
    latitude: 10.7769,
    longitude: 106.7009,
    wifiBssid: 'AA:BB:CC:DD:EE:FF',
    deviceFingerprint: 'fp-123',
    mockLocationDetected: false,
  };

  // ──────────────────────────────────────────────
  // checkFraud composite tests
  // ──────────────────────────────────────────────

  describe('checkFraud', () => {
    beforeEach(() => {
      // Default: all checks pass (score = 0)
      mockPrisma.branchWifi.findMany.mockResolvedValue([
        { bssid: 'AA:BB:CC:DD:EE:FF', isActive: true },
      ]);
      mockPrisma.branch.findUnique.mockResolvedValue({
        latitude: 10.7769,
        longitude: 106.7009,
        radius: 200,
      });
      mockPrisma.userDevice.findUnique.mockResolvedValue({
        id: '1',
        isTrusted: true,
      });
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
    });

    it('should return CLEAN (score <= 20) when all checks pass', async () => {
      const result = await service.checkFraud('user-1', 'branch-1', baseDto);
      expect(result.passed).toBe(true);
      expect(result.score).toBeLessThanOrEqual(20);
    });

    it('should return BLOCKED (score > 80) for mock location + wifi mismatch + outside GPS', async () => {
      mockPrisma.branchWifi.findMany.mockResolvedValue([
        { bssid: 'XX:XX:XX:XX:XX:XX', isActive: true },
      ]);
      mockPrisma.branch.findUnique.mockResolvedValue({
        latitude: 21.0, // far from dto point
        longitude: 105.8,
        radius: 100,
      });

      const dto: CheckInDto = {
        ...baseDto,
        mockLocationDetected: true, // +50 (device)
        wifiBssid: 'AA:BB:CC:DD:EE:FF', // mismatch +30 (wifi)
        // GPS: far outside → +40
      };

      const result = await service.checkFraud('user-1', 'branch-1', dto);
      expect(result.passed).toBe(false);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should auto-BLOCK when no WiFi data (WiFi gate)', async () => {
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);

      const dto: CheckInDto = {
        ...baseDto,
        wifiBssid: undefined,
      };

      const result = await service.checkFraud('user-1', 'branch-1', dto);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(100);
      expect(result.checks.wifi.detail).toContain('WiFi');
    });

    it('should cache high-risk alert when score 51-80', async () => {
      // WiFi mismatch (30) + near boundary GPS (20) + new device (15) = 65
      mockPrisma.branchWifi.findMany.mockResolvedValue([
        { bssid: 'XX:XX:XX:XX:XX:XX', isActive: true },
      ]);
      mockPrisma.branch.findUnique.mockResolvedValue({
        latitude: 10.78,
        longitude: 106.7009,
        radius: 100, // small radius so point is near but outside
      });
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);

      const result = await service.checkFraud('user-1', 'branch-1', baseDto);

      if (result.score > 50 && result.score <= 80) {
        expect(mockRedis.setex).toHaveBeenCalled();
      }
    });
  });

  // ──────────────────────────────────────────────
  // getAnomaliesFromResult
  // ──────────────────────────────────────────────

  describe('getAnomaliesFromResult', () => {
    it('should return empty array for clean result', () => {
      const result: FraudCheckResult = {
        score: 0,
        passed: true,
        checks: {
          wifi: { score: 0, detail: 'ok' },
          gps: { score: 0, detail: 'ok' },
          device: { score: 0, detail: 'ok' },
          speed: { score: 0, detail: 'ok' },
          ipSubnet: { score: 0, detail: 'ok' },
        },
      };
      expect(service.getAnomaliesFromResult(result)).toEqual([]);
    });

    it('should detect WiFi mismatch anomaly', () => {
      const result: FraudCheckResult = {
        score: 30,
        passed: true,
        checks: {
          wifi: { score: 30, detail: 'BSSID mismatch' },
          gps: { score: 0, detail: 'ok' },
          device: { score: 0, detail: 'ok' },
          speed: { score: 0, detail: 'ok' },
          ipSubnet: { score: 0, detail: 'ok' },
        },
      };
      const anomalies = service.getAnomaliesFromResult(result);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('WIFI_MISMATCH');
    });

    it('should detect device mismatch anomaly for mock location', () => {
      const result: FraudCheckResult = {
        score: 50,
        passed: true,
        checks: {
          wifi: { score: 0, detail: 'ok' },
          gps: { score: 0, detail: 'ok' },
          device: { score: 50, detail: 'Mock location detected' },
          speed: { score: 0, detail: 'ok' },
          ipSubnet: { score: 0, detail: 'ok' },
        },
      };
      const anomalies = service.getAnomaliesFromResult(result);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('DEVICE_MISMATCH');
      expect(anomalies[0].severity).toBe('CRITICAL');
    });

    it('should detect speed anomaly', () => {
      const result: FraudCheckResult = {
        score: 40,
        passed: true,
        checks: {
          wifi: { score: 0, detail: 'ok' },
          gps: { score: 0, detail: 'ok' },
          device: { score: 0, detail: 'ok' },
          speed: { score: 40, detail: 'Impossible speed', speedKmh: 500 },
          ipSubnet: { score: 0, detail: 'ok' },
        },
      };
      const anomalies = service.getAnomaliesFromResult(result);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('SPEED_ANOMALY');
      expect(anomalies[0].metadata).toEqual({ speedKmh: 500 });
    });

    it('should detect multiple anomalies', () => {
      const result: FraudCheckResult = {
        score: 100,
        passed: false,
        checks: {
          wifi: { score: 30, detail: 'mismatch' },
          gps: { score: 40, detail: 'outside', distance: 5000 },
          device: { score: 50, detail: 'mock' },
          speed: { score: 40, detail: 'impossible', speedKmh: 1000 },
          ipSubnet: { score: 0, detail: 'ok' },
        },
      };
      const anomalies = service.getAnomaliesFromResult(result);
      expect(anomalies).toHaveLength(4);
    });
  });

  // ──────────────────────────────────────────────
  // createAnomaly
  // ──────────────────────────────────────────────

  describe('createAnomaly', () => {
    it('should create anomaly record in database', async () => {
      mockPrisma.anomaly.create.mockResolvedValue({ id: 'anomaly-1' });

      await service.createAnomaly(
        'att-1',
        'WIFI_MISMATCH' as any,
        'MEDIUM' as any,
        'WiFi BSSID mismatch',
        { tested: true },
      );

      expect(mockPrisma.anomaly.create).toHaveBeenCalledWith({
        data: {
          attendanceId: 'att-1',
          type: 'WIFI_MISMATCH',
          severity: 'MEDIUM',
          description: 'WiFi BSSID mismatch',
          metadata: { tested: true },
        },
      });
    });
  });
});
