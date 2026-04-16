/**
 * Anti-fraud scoring thresholds and constants.
 */
export const FRAUD_THRESHOLDS = {
  /** Score 0-20: Clean, no issues */
  CLEAN: 20,
  /** Score 21-50: Suspicious, allowed but logged */
  SUSPICIOUS: 50,
  /** Score 51-80: High risk, allowed but manager notified */
  HIGH_RISK: 80,
  /** Score >80: Blocked */
  BLOCKED: 80,
} as const;

export const FRAUD_LAYER_MAX_SCORES = {
  WIFI: 30,
  GPS: 40,
  DEVICE: 50,
  SPEED: 40,
} as const;

export const SPEED_THRESHOLDS = {
  /** Speed above this (km/h) is flagged as high */
  HIGH: 120,
  /** Speed above this (km/h) is flagged as impossible (likely spoofing) */
  IMPOSSIBLE: 200,
} as const;
