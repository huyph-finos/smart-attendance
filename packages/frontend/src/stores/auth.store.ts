'use client';

import { create } from 'zustand';
import apiClient from '@/lib/api-client';
import { setTokens, clearTokens } from '@/lib/auth';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branchId: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data: response } = await apiClient.post('/auth/login', {
        email,
        password,
      });
      // API may return directly or wrapped in { success, data }
      const payload = response.data ?? response;
      const { accessToken, refreshToken, user } = payload;
      setTokens(accessToken, refreshToken);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Proceed with local logout even if the API call fails
    } finally {
      clearTokens();
      set({ user: null });
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const { data: response } = await apiClient.get('/auth/me');
      set({ user: response.data ?? response, isLoading: false });
    } catch (error) {
      set({ user: null, isLoading: false });
      throw error;
    }
  },
}));
