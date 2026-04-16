import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  isWithinGeofence,
  calculateTravelSpeed,
} from './geo';

describe('haversineDistance', () => {
  it('should return 0 for the same point', () => {
    const dist = haversineDistance(10.7769, 106.7009, 10.7769, 106.7009);
    expect(dist).toBe(0);
  });

  it('should calculate known distance HCM to Hanoi (~1,200 km)', () => {
    // HCM: 10.8231, 106.6297 | HN: 21.0285, 105.8542
    const dist = haversineDistance(10.8231, 106.6297, 21.0285, 105.8542);
    const distKm = dist / 1000;
    expect(distKm).toBeGreaterThan(1100);
    expect(distKm).toBeLessThan(1300);
  });

  it('should handle negative coordinates', () => {
    // Sydney: -33.8688, 151.2093 | Tokyo: 35.6762, 139.6503
    const dist = haversineDistance(-33.8688, 151.2093, 35.6762, 139.6503);
    const distKm = dist / 1000;
    expect(distKm).toBeGreaterThan(7500);
    expect(distKm).toBeLessThan(8000);
  });

  it('should return a small distance for nearby points', () => {
    // Two points ~100m apart in HCM
    const dist = haversineDistance(10.7769, 106.7009, 10.7778, 106.7009);
    expect(dist).toBeGreaterThan(90);
    expect(dist).toBeLessThan(110);
  });
});

describe('isWithinGeofence', () => {
  const centerLat = 10.7769;
  const centerLng = 106.7009;
  const radius = 200; // 200m

  it('should return true for a point within the geofence', () => {
    // Same point
    expect(isWithinGeofence(10.7769, 106.7009, centerLat, centerLng, radius)).toBe(true);
  });

  it('should return true for a point on the boundary', () => {
    // ~200m north
    const pointLat = 10.7769 + 200 / 111320; // roughly 200m
    expect(isWithinGeofence(pointLat, centerLng, centerLat, centerLng, radius)).toBe(true);
  });

  it('should return false for a point outside the geofence', () => {
    // ~500m away
    const farLat = 10.7769 + 500 / 111320;
    expect(isWithinGeofence(farLat, centerLng, centerLat, centerLng, radius)).toBe(false);
  });
});

describe('calculateTravelSpeed', () => {
  it('should calculate normal travel speed', () => {
    // 10km distance in 30 minutes = 20 km/h
    const t1 = new Date('2024-01-01T08:00:00Z');
    const t2 = new Date('2024-01-01T08:30:00Z');
    // ~10km apart
    const speed = calculateTravelSpeed(10.7769, 106.7009, t1, 10.8669, 106.7009, t2);
    expect(speed).toBeGreaterThan(15);
    expect(speed).toBeLessThan(25);
  });

  it('should return Infinity when time difference is zero', () => {
    const t = new Date('2024-01-01T08:00:00Z');
    const speed = calculateTravelSpeed(10.7769, 106.7009, t, 10.8769, 106.7009, t);
    expect(speed).toBe(Infinity);
  });

  it('should return 0 for the same point', () => {
    const t1 = new Date('2024-01-01T08:00:00Z');
    const t2 = new Date('2024-01-01T09:00:00Z');
    const speed = calculateTravelSpeed(10.7769, 106.7009, t1, 10.7769, 106.7009, t2);
    expect(speed).toBe(0);
  });
});
