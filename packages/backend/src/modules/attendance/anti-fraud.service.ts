import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AnomalyType, AnomalySeverity } from '@prisma/client';
import {
  FRAUD_THRESHOLDS,
  FRAUD_LAYER_MAX_SCORES,
  SPEED_THRESHOLDS,
} from '@smart-attendance/shared';
import {
  haversineDistance,
  isWithinGeofence,
  calculateTravelSpeed,
} from '../../common/utils/geo';
import { isIpInAnyRange } from '../../common/utils/ip';
import { CheckInDto } from './dto/check-in.dto';

export interface FraudCheckResult {
  score: number;
  passed: boolean;
  checks: {
    wifi: { score: number; detail: string };
    gps: { score: number; detail: string; distance?: number };
    device: { score: number; detail: string };
    speed: { score: number; detail: string; speedKmh?: number };
    ipSubnet: { score: number; detail: string };
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
    clientIp?: string,
  ): Promise<FraudCheckResult> {
    // WiFi BSSID must match branch — block immediately if not
    const wifiGateResult = await this.checkWifiGate(branchId, dto);
    if (!wifiGateResult.passed) {
      this.logger.error(
        `BLOCKED check-in for user ${userId}: WiFi verification failed — ${wifiGateResult.detail}`,
      );
      return {
        score: 100,
        passed: false,
        checks: {
          wifi: { score: 100, detail: wifiGateResult.detail },
          gps: { score: 0, detail: 'Skipped — WiFi gate failed' },
          device: { score: 0, detail: 'Skipped — WiFi gate failed' },
          speed: { score: 0, detail: 'Skipped — WiFi gate failed' },
          ipSubnet: { score: 0, detail: 'Skipped — WiFi gate failed' },
        },
      };
    }

    const [wifiResult, gpsResult, deviceResult, speedResult, ipResult] =
      await Promise.all([
        this.checkWifi(branchId, dto),
        this.checkGps(branchId, dto),
        this.checkDevice(userId, dto),
        this.checkSpeed(userId, dto),
        this.checkIpSubnet(branchId, clientIp),
      ]);

    const rawScore =
      wifiResult.score + gpsResult.score + deviceResult.score + speedResult.score + ipResult.score;
    const score = Math.min(rawScore, 100);

    let passed: boolean;
    if (score <= FRAUD_THRESHOLDS.CLEAN) {
      passed = true;
    } else if (score <= FRAUD_THRESHOLDS.SUSPICIOUS) {
      // Suspicious - allowed but flagged
      passed = true;
      this.logger.warn(
        `Suspicious check-in for user ${userId}: score=${score}`,
      );
    } else if (score <= FRAUD_THRESHOLDS.HIGH_RISK) {
      // High risk - allowed but manager notified
      passed = true;
      this.logger.warn(
        `High-risk check-in for user ${userId}: score=${score}`,
      );
      await this.cacheHighRiskAlert(userId, branchId, score);
    } else {
      // Blocked
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
        ipSubnet: ipResult,
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

    return { score: FRAUD_LAYER_MAX_SCORES.WIFI, detail: 'WiFi BSSID does not match any branch network' };
  }

  // ──────────────────────────────────────────────
  // Layer 2: GPS Geofencing (max 40 points)
  // ──────────────────────────────────────────────

  private async checkGps(
    branchId: string,
    dto: CheckInDto,
  ): Promise<{ score: number; detail: string; distance?: number }> {
    if (dto.latitude == null || dto.longitude == null) {
      return { score: 0, detail: 'No GPS data provided (skipped — using WiFi/IP verification)' };
    }

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
      score: FRAUD_LAYER_MAX_SCORES.GPS,
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
        score: FRAUD_LAYER_MAX_SCORES.DEVICE,
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
      // Fire-and-forget: timestamp update must not block fraud result
      this.prisma.userDevice
        .update({ where: { id: existingDevice.id }, data: { lastUsedAt: new Date() } })
        .catch((err) => this.logger.warn(`Failed to update device lastUsedAt: ${err.message}`));

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
    if (dto.latitude == null || dto.longitude == null) {
      return { score: 0, detail: 'No GPS data provided (skipped)' };
    }

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

    if (speedKmh > SPEED_THRESHOLDS.IMPOSSIBLE) {
      // Impossible travel speed - likely location spoofing
      this.logger.warn(
        `Impossible travel speed detected for user ${userId}: ${speedRounded} km/h`,
      );
      return {
        score: FRAUD_LAYER_MAX_SCORES.SPEED,
        detail: `Impossible travel speed: ${speedRounded} km/h`,
        speedKmh: speedRounded,
      };
    }

    if (speedKmh > SPEED_THRESHOLDS.HIGH) {
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
  // Layer 5: IP Subnet Verification (max 20 points)
  // ──────────────────────────────────────────────

  private async checkIpSubnet(
    branchId: string,
    clientIp?: string,
  ): Promise<{ score: number; detail: string }> {
    if (!clientIp) {
      return { score: 0, detail: 'No client IP available (skipped)' };
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { allowedIpRanges: true },
    });

    if (!branch || branch.allowedIpRanges.length === 0) {
      return { score: 0, detail: 'No IP ranges configured (skipped)' };
    }

    if (isIpInAnyRange(clientIp, branch.allowedIpRanges)) {
      return { score: 0, detail: `IP ${clientIp} within allowed subnet` };
    }

    return { score: 20, detail: `IP ${clientIp} not in allowed subnet` };
  }

  // ──────────────────────────────────────────────
  // WiFi Gate (no-GPS mode)
  // ──────────────────────────────────────────────

  /**
   * Hard gate: when GPS is unavailable, WiFi BSSID must match the branch.
   * Returns passed=false if no WiFi data or BSSID doesn't match.
   */
  private async checkWifiGate(
    branchId: string,
    dto: CheckInDto,
  ): Promise<{ passed: boolean; detail: string }> {
    if (!dto.wifiBssid) {
      return { passed: false, detail: 'No GPS and no WiFi data — cannot verify location' };
    }

    const branchWifiList = await this.prisma.branchWifi.findMany({
      where: { branchId, isActive: true },
    });

    if (branchWifiList.length === 0) {
      return { passed: false, detail: 'No GPS and branch has no WiFi configured — cannot verify location' };
    }

    const match = branchWifiList.some(
      (w) => w.bssid.toLowerCase() === dto.wifiBssid!.toLowerCase(),
    );

    if (match) {
      return { passed: true, detail: 'WiFi BSSID matches branch network (no-GPS mode)' };
    }

    return { passed: false, detail: 'No GPS and WiFi BSSID does not match any branch network' };
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

    if (result.checks.wifi.score >= FRAUD_LAYER_MAX_SCORES.WIFI) {
      anomalies.push({
        type: AnomalyType.WIFI_MISMATCH,
        severity: result.score > FRAUD_THRESHOLDS.BLOCKED ? AnomalySeverity.CRITICAL : AnomalySeverity.MEDIUM,
        description: result.checks.wifi.detail,
      });
    }

    if (result.checks.gps.score >= FRAUD_LAYER_MAX_SCORES.GPS) {
      anomalies.push({
        type: AnomalyType.LOCATION_SPOOF,
        severity: AnomalySeverity.HIGH,
        description: result.checks.gps.detail,
        metadata: { distance: result.checks.gps.distance },
      });
    }

    if (result.checks.device.score >= FRAUD_LAYER_MAX_SCORES.DEVICE) {
      anomalies.push({
        type: AnomalyType.DEVICE_MISMATCH,
        severity: AnomalySeverity.CRITICAL,
        description: result.checks.device.detail,
      });
    }

    if (result.checks.speed.score >= FRAUD_LAYER_MAX_SCORES.SPEED) {
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
