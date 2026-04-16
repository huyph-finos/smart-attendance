'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api-client';

export interface CheckInData {
  latitude: number;
  longitude: number;
  accuracy: number;
  wifiSSID?: string | null;
  wifiBSSID?: string | null;
  deviceFingerprint?: string;
  mockLocationDetected?: boolean;
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
      set({ todayAttendance: response.data });
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
      set({ todayAttendance: response.data, isCheckingIn: false });
      return response.data;
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
      set({ todayAttendance: response.data, isCheckingOut: false });
      return response.data;
    } catch (error) {
      set({ isCheckingOut: false });
      throw error;
    }
  },
}));
