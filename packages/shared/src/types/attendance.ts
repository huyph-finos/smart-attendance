export enum AttendanceStatus {
  ON_TIME = 'ON_TIME',
  LATE = 'LATE',
  EARLY_LEAVE = 'EARLY_LEAVE',
  ABSENT = 'ABSENT',
  ON_LEAVE = 'ON_LEAVE',
}

export enum AnomalyType {
  SPEED_ANOMALY = 'SPEED_ANOMALY',
  DEVICE_MISMATCH = 'DEVICE_MISMATCH',
  TIME_PATTERN = 'TIME_PATTERN',
  LOCATION_SPOOF = 'LOCATION_SPOOF',
  WIFI_MISMATCH = 'WIFI_MISMATCH',
  FREQUENCY_ANOMALY = 'FREQUENCY_ANOMALY',
}

export enum AnomalySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface IAttendance {
  id: string;
  userId: string;
  branchId: string;
  date: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  status: AttendanceStatus;
  totalHours?: number;
  overtimeHours?: number;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  checkInWifiBssid?: string;
  checkOutWifiBssid?: string;
  checkInDeviceId?: string;
  checkOutDeviceId?: string;
  checkInDistance?: number;
  fraudScore: number;
  isVerified: boolean;
  isOfflineSync: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICheckInDto {
  latitude: number;
  longitude: number;
  wifiSsid?: string;
  wifiBssid?: string;
  deviceFingerprint: string;
  mockLocationDetected?: boolean;
  mood?: string;
}

export interface IAnomaly {
  id: string;
  attendanceId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  metadata?: Record<string, unknown>;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolvedNote?: string;
  createdAt: Date;
}

export interface IFraudCheckResult {
  score: number;
  passed: boolean;
  checks: {
    wifi: { score: number; matched: boolean; details: string };
    gps: { score: number; distance: number; withinRadius: boolean; details: string };
    device: { score: number; trusted: boolean; mockDetected: boolean; details: string };
  };
}
