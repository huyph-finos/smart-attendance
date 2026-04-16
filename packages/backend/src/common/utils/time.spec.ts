import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  getMinutesSinceMidnight,
  isLate,
  calculateWorkHours,
  calculateOvertime,
  formatDate,
} from './time';

describe('parseTimeToMinutes', () => {
  it('should parse midnight', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
  });

  it('should parse 08:30', () => {
    expect(parseTimeToMinutes('08:30')).toBe(510);
  });

  it('should parse 23:59', () => {
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });
});

describe('getMinutesSinceMidnight', () => {
  it('should return correct minutes for morning time', () => {
    const date = new Date('2024-01-01T08:30:00');
    expect(getMinutesSinceMidnight(date)).toBe(8 * 60 + 30);
  });
});

describe('isLate', () => {
  it('should return false when on time', () => {
    const checkIn = new Date('2024-01-01T08:00:00');
    expect(isLate(checkIn, '08:00', 15)).toBe(false);
  });

  it('should return false when within threshold', () => {
    const checkIn = new Date('2024-01-01T08:10:00');
    expect(isLate(checkIn, '08:00', 15)).toBe(false);
  });

  it('should return false at exact threshold boundary', () => {
    const checkIn = new Date('2024-01-01T08:15:00');
    expect(isLate(checkIn, '08:00', 15)).toBe(false);
  });

  it('should return true when past threshold', () => {
    const checkIn = new Date('2024-01-01T08:16:00');
    expect(isLate(checkIn, '08:00', 15)).toBe(true);
  });

  it('should return true when clearly late', () => {
    const checkIn = new Date('2024-01-01T09:30:00');
    expect(isLate(checkIn, '08:00', 15)).toBe(true);
  });
});

describe('calculateWorkHours', () => {
  it('should calculate standard 8-hour day', () => {
    const checkIn = new Date('2024-01-01T08:00:00');
    const checkOut = new Date('2024-01-01T16:00:00');
    expect(calculateWorkHours(checkIn, checkOut)).toBe(8);
  });

  it('should handle partial hours', () => {
    const checkIn = new Date('2024-01-01T08:00:00');
    const checkOut = new Date('2024-01-01T12:30:00');
    expect(calculateWorkHours(checkIn, checkOut)).toBe(4.5);
  });

  it('should return negative for reversed times', () => {
    const checkIn = new Date('2024-01-01T16:00:00');
    const checkOut = new Date('2024-01-01T08:00:00');
    expect(calculateWorkHours(checkIn, checkOut)).toBe(-8);
  });
});

describe('calculateOvertime', () => {
  it('should return 0 when under standard hours', () => {
    expect(calculateOvertime(7)).toBe(0);
  });

  it('should return 0 for exactly standard hours', () => {
    expect(calculateOvertime(8)).toBe(0);
  });

  it('should return overtime for over standard hours', () => {
    expect(calculateOvertime(10)).toBe(2);
  });

  it('should use custom standard hours', () => {
    expect(calculateOvertime(5, 4)).toBe(1);
  });
});

describe('formatDate', () => {
  it('should format date as YYYY-MM-DD', () => {
    const date = new Date('2024-03-15T10:30:00Z');
    expect(formatDate(date)).toBe('2024-03-15');
  });
});
