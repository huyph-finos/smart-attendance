'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api-client';

export interface CheckInData {
  latitude?: number;
  longitude?: number;
  accuracy: number;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  deviceFingerprint?: string;
  mockLocationDetected?: boolean;
  mood?: string | null;
}

export interface TodayAttendance {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  totalHours: number | null;
  overtimeHours: number | null;
  fraudScore: number;
  isVerified: boolean;
  mood: string | null;
  branch?: { name: string; code: string };
  anomalies?: Array<{
    id: string;
    type: string;
    severity: string;
    isResolved: boolean;
  }>;
}

export interface CheckInResult {
  attendance: TodayAttendance;
  fraudCheck: {
    score: number;
    passed: boolean;
    checks: Record<string, { score: number; detail: string }>;
  };
}

export interface AttendanceState {
  todayAttendance: TodayAttendance | null;
  isCheckingIn: boolean;
  isCheckingOut: boolean;
  fetchToday: () => Promise<void>;
  checkIn: (data: CheckInData) => Promise<CheckInResult>;
  checkOut: (data: CheckInData) => Promise<CheckInResult>;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  todayAttendance: null,
  isCheckingIn: false,
  isCheckingOut: false,

  fetchToday: async () => {
    try {
      const { data: response } = await apiClient.get('/attendance/today');
      set({ todayAttendance: response.data ?? response });
    } catch (error) {
      set({ todayAttendance: null });
      throw error;
    }
  },

  checkIn: async (data: CheckInData) => {
    set({ isCheckingIn: true });
    try {
      const { data: response } = await apiClient.post(
        '/attendance/check-in',
        data,
      );
      const result = response.data ?? response;
      set({ todayAttendance: result.attendance ?? result, isCheckingIn: false });
      return result;
    } catch (error) {
      set({ isCheckingIn: false });
      throw error;
    }
  },

  checkOut: async (data: CheckInData) => {
    set({ isCheckingOut: true });
    try {
      const { data: response } = await apiClient.post(
        '/attendance/check-out',
        data,
      );
      const result = response.data ?? response;
      set({ todayAttendance: result.attendance ?? result, isCheckingOut: false });
      return result;
    } catch (error) {
      set({ isCheckingOut: false });
      throw error;
    }
  },
}));
