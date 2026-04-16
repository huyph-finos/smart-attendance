'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api-client';

export interface CheckInData {
  latitude: number;
  longitude: number;
  accuracy: number;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  deviceFingerprint?: string;
  mockLocationDetected?: boolean;
  mood?: string | null;
}

export interface AttendanceState {
  todayAttendance: any | null;
  isCheckingIn: boolean;
  isCheckingOut: boolean;
  fetchToday: () => Promise<void>;
  checkIn: (data: CheckInData) => Promise<any>;
  checkOut: (data: CheckInData) => Promise<any>;
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
