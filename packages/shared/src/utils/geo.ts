/**
 * Calculate distance between two GPS coordinates using Haversine formula.
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Check if a point is within a geofence radius.
 */
export function isWithinGeofence(
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): boolean {
  const distance = haversineDistance(pointLat, pointLng, centerLat, centerLng);
  return distance <= radiusMeters;
}

/**
 * Calculate travel speed between two check-ins (km/h).
 */
export function calculateTravelSpeed(
  lat1: number,
  lng1: number,
  time1: Date,
  lat2: number,
  lng2: number,
  time2: Date,
): number {
  const distanceKm = haversineDistance(lat1, lng1, lat2, lng2) / 1000;
  const timeHours =
    Math.abs(time2.getTime() - time1.getTime()) / (1000 * 60 * 60);
  if (timeHours === 0) return Infinity;
  return distanceKm / timeHours;
}
