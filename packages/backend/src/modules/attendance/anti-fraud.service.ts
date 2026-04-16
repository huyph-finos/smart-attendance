import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AnomalyType, AnomalySeverity } from '@prisma/client';
import {
  haversineDistance,
  isWithinGeofence,
  calculateTravelSpeed,
} from '../../common/utils/geo';
import { CheckInDto } from './dto/check-in.dto';

export interface FraudCheckResult {
  score: number;
  passed: boolean;
  checks: {
    wifi: { score: number; detail: string };
    gps: { score: number; detail: string; distance?: number };
    device: { score: number; detail: string };
    speed: { score: number; detail: string; speedKmh?: number };
  };
}

@Injectable()
export class AntiFraudService {
  private readonly logger = new Logger(AntiFraudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Run multi-layer fraud detection on a check-in attempt.
   * Returns a composite score (0-100) and per-layer breakdown.
   */
  async checkFraud(
    userId: string,
    branchId: string,
    dto: CheckInDto,
  ): Promise<FraudCheckResult> {
    const [wifiResult, gpsResult, deviceResult, speedResult] =
      await Promise.all([
        this.checkWifi(branchId, dto),
        this.checkGps(branchId, dto),
        this.checkDevice(userId, dto),
        this.checkSpeed(userId, dto),
      ]);

    const rawScore =
      wifiResult.score + gpsResult.score + deviceResult.score + speedResult.score;
    const score = Math.min(rawScore, 100);

    let passed: boolean;
    if (score <= 20) {
      // CLEAN
      passed = true;
    } else if (score <= 50) {
      // SUSPICIOUS - allowed but flagged
      passed = true;
      this.logger.warn(
        `Suspicious check-in for user ${userId}: score=${score}`,
      );
    } else if (score <= 80) {
      // HIGH RISK - allowed but manager notified
      passed = true;
      this.logger.warn(
        `High-risk check-in for user ${userId}: score=${score}`,
      );
      await this.cacheHighRiskAlert(userId, branchId, score);
    } else {
      // BLOCKED
      passed = false;
      this.logger.error(
        `BLOCKED check-in for user ${userId}: score=${score}`,
      );
    }

    return {
      score,
      passed,
      checks: {
        wifi: wifiResult,
        gps: gpsResult,
        device: deviceResult,
        speed: speedResult,
      },
    };
  }

  // ──────────────────────────────────────────────
  // Layer 1: WiFi Verification (max 30 points)
  // ──────────────────────────────────────────────

  private async checkWifi(
    branchId: string,
    dto: CheckInDto,
  ): Promise<{ score: number; detail: string }> {
    if (!dto.wifiBssid) {
      return { score: 15, detail: 'No WiFi data provided (inconclusive)' };
    }

    const branchWifiList = await this.prisma.branchWifi.findMany({
      where: { branchId, isActive: true },
    });

    if (branchWifiList.length === 0) {
      // Branch has no WiFi configured - skip this layer
      return { score: 0, detail: 'No WiFi configured for branch (skipped)' };
    }

    const match = branchWifiList.some(
      (w) => w.bssid.toLowerCase() === dto.wifiBssid!.toLowerCase(),
    );

    if (match) {
      return { score: 0, detail: 'WiFi BSSID matches branch network' };
    }

    return { score: 30, detail: 'WiFi BSSID does not match any branch network' };
  }

  // ──────────────────────────────────────────────
  // Layer 2: GPS Geofencing (max 40 points)
  // ──────────────────────────────────────────────

  private async checkGps(
    branchId: string,
    dto: CheckInDto,
  ): Promise<{ score: number; detail: string; distance?: number }> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { latitude: true, longitude: true, radius: true },
    });

    if (!branch) {
      return { score: 0, detail: 'Branch not found (skipped)' };
    }

    const distance = haversineDistance(
      dto.latitude,
      dto.longitude,
      branch.latitude,
      branch.longitude,
    );

    const distanceRounded = Math.round(distance);

    if (isWithinGeofence(dto.latitude, dto.longitude, branch.latitude, branch.longitude, branch.radius)) {
      return {
        score: 0,
        detail: `Within geofence (${distanceRounded}m / ${branch.radius}m radius)`,
        distance: distanceRounded,
      };
    }

    if (distance <= branch.radius * 2) {
      return {
        score: 20,
        detail: `Near geofence boundary (${distanceRounded}m / ${branch.radius}m radius)`,
        distance: distanceRounded,
      };
    }

    return {
      score: 40,
      detail: `Outside geofence (${distanceRounded}m / ${branch.radius}m radius)`,
      distance: distanceRounded,
    };
  }

  // ──────────────────────────────────────────────
  // Layer 3: Device Fingerprint (max 50 points)
  // ──────────────────────────────────────────────

  private async checkDevice(
    userId: string,
    dto: CheckInDto,
  ): Promise<{ score: number; detail: string }> {
    // Mock location detection takes highest priority
    if (dto.mockLocationDetected) {
      return {
        score: 50,
        detail: 'Mock location detected on device',
      };
    }

    const existingDevice = await this.prisma.userDevice.findUnique({
      where: {
        userId_fingerprint: {
          userId,
          fingerprint: dto.deviceFingerprint,
        },
      },
    });

    if (existingDevice) {
      // Update last used timestamp
      await this.prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: { lastUsedAt: new Date() },
      });

      if (existingDevice.isTrusted) {
        return { score: 0, detail: 'Trusted device recognized' };
      }

      // Known but not explicitly trusted
      return { score: 5, detail: 'Known device (not yet trusted)' };
    }

    // New device - register it and flag
    await this.prisma.userDevice.create({
      data: {
        userId,
        fingerprint: dto.deviceFingerprint,
        userAgent: 'mobile-app',
        platform: 'unknown',
        isTrusted: false,
      },
    });

    return { score: 15, detail: 'New device registered' };
  }

  // ──────────────────────────────────────────────
  // Layer 4: Speed Anomaly (max 40 points)
  // ──────────────────────────────────────────────

  private async checkSpeed(
    userId: string,
    dto: CheckInDto,
  ): Promise<{ score: number; detail: string; speedKmh?: number }> {
    // Look at the user's most recent attendance with GPS data (today or yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const lastAttendance = await this.prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: yesterday },
        OR: [
          { checkOutLat: { not: null }, checkOutLng: { not: null } },
          { checkInLat: { not: null }, checkInLng: { not: null } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastAttendance) {
      return { score: 0, detail: 'No recent attendance for speed comparison' };
    }

    // Prefer check-out coords (latest point), fall back to check-in coords
    const prevLat =
      lastAttendance.checkOutLat ?? lastAttendance.checkInLat;
    const prevLng =
      lastAttendance.checkOutLng ?? lastAttendance.checkInLng;
    const prevTime =
      lastAttendance.checkOutTime ?? lastAttendance.checkInTime;

    if (prevLat == null || prevLng == null || prevTime == null) {
      return { score: 0, detail: 'Incomplete GPS data on previous record' };
    }

    const now = new Date();
    const speedKmh = calculateTravelSpeed(
      prevLat,
      prevLng,
      prevTime,
      dto.latitude,
      dto.longitude,
      now,
    );

    const speedRounded = Math.round(speedKmh * 10) / 10;

    if (speedKmh > 200) {
      // Impossible travel speed - likely location spoofing
      this.logger.warn(
        `Impossible travel speed detected for user ${userId}: ${speedRounded} km/h`,
      );
      return {
        score: 40,
        detail: `Impossible travel speed: ${speedRounded} km/h`,
        speedKmh: speedRounded,
      };
    }

    if (speedKmh > 120) {
      return {
        score: 15,
        detail: `High travel speed: ${speedRounded} km/h`,
        speedKmh: speedRounded,
      };
    }

    return {
      score: 0,
      detail: `Normal travel speed: ${speedRounded} km/h`,
      speedKmh: speedRounded,
    };
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  /**
   * Cache a high-risk alert in Redis for real-time manager notification.
   */
  private async cacheHighRiskAlert(
    userId: string,
    branchId: string,
    score: number,
  ): Promise<void> {
    try {
      const key = `fraud:alert:${branchId}:${userId}`;
      await this.redis.setex(
        key,
        3600, // 1 hour TTL
        JSON.stringify({
          userId,
          branchId,
          score,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      this.logger.error('Failed to cache high-risk alert', error);
    }
  }

  /**
   * Create an anomaly record linked to an attendance entry.
   */
  async createAnomaly(
    attendanceId: string,
    type: AnomalyType,
    severity: AnomalySeverity,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.anomaly.create({
      data: {
        attendanceId,
        type,
        severity,
        description,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });
  }

  /**
   * Determine the appropriate anomaly type(s) from fraud check results.
   */
  getAnomaliesFromResult(
    result: FraudCheckResult,
  ): Array<{ type: AnomalyType; severity: AnomalySeverity; description: string; metadata?: Record<string, unknown> }> {
    const anomalies: Array<{
      type: AnomalyType;
      severity: AnomalySeverity;
      description: string;
      metadata?: Record<string, unknown>;
    }> = [];

    if (result.checks.wifi.score >= 30) {
      anomalies.push({
        type: AnomalyType.WIFI_MISMATCH,
        severity: result.score > 80 ? AnomalySeverity.CRITICAL : AnomalySeverity.MEDIUM,
        description: result.checks.wifi.detail,
      });
    }

    if (result.checks.gps.score >= 40) {
      anomalies.push({
        type: AnomalyType.LOCATION_SPOOF,
        severity: AnomalySeverity.HIGH,
        description: result.checks.gps.detail,
        metadata: { distance: result.checks.gps.distance },
      });
    }

    if (result.checks.device.score >= 50) {
      anomalies.push({
        type: AnomalyType.DEVICE_MISMATCH,
        severity: AnomalySeverity.CRITICAL,
        description: result.checks.device.detail,
      });
    }

    if (result.checks.speed.score >= 40) {
      anomalies.push({
        type: AnomalyType.SPEED_ANOMALY,
        severity: AnomalySeverity.CRITICAL,
        description: result.checks.speed.detail,
        metadata: { speedKmh: result.checks.speed.speedKmh },
      });
    }

    return anomalies;
  }
}
