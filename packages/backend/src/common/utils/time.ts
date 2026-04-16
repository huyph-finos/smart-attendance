/**
 * Parse "HH:mm" string to minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get minutes since midnight for a Date.
 */
export function getMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Check if check-in time is late relative to work start time.
 */
export function isLate(
  checkInTime: Date,
  workStartTime: string,
  thresholdMinutes: number,
): boolean {
  const checkInMinutes = getMinutesSinceMidnight(checkInTime);
  const startMinutes = parseTimeToMinutes(workStartTime);
  return checkInMinutes > startMinutes + thresholdMinutes;
}

/**
 * Calculate total working hours between check-in and check-out.
 */
export function calculateWorkHours(
  checkIn: Date,
  checkOut: Date,
): number {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
}

/**
 * Calculate overtime hours.
 */
export function calculateOvertime(
  totalHours: number,
  standardHours: number = 8,
): number {
  return Math.max(0, Math.round((totalHours - standardHours) * 100) / 100);
}

/**
 * Format Date to "YYYY-MM-DD" string.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
