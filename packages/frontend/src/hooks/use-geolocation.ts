'use client';

import { useState, useCallback, useEffect } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  isLoading: boolean;
  mockLocationDetected: boolean;
  refresh: () => void;
}

function detectMockLocation(position: GeolocationPosition): boolean {
  const { accuracy, altitude, altitudeAccuracy } = position.coords;

  // Accuracy of exactly 0 is suspicious — real GPS always has some error margin
  if (accuracy === 0) return true;

  // Altitude of exactly 0 with no altitude accuracy is a common mock indicator
  if (altitude === 0 && altitudeAccuracy === null) return true;

  // Extremely precise accuracy (< 1 meter) is unusual for real devices
  if (accuracy !== null && accuracy > 0 && accuracy < 1) return true;

  return false;
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isLoading: true,
    mockLocationDetected: false,
    refresh: () => {},
  });

  const getPosition = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by this browser',
        isLoading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const mockDetected = detectMockLocation(position);
        setState((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          isLoading: false,
          mockLocationDetected: mockDetected,
        }));
      },
      (error) => {
        let errorMessage: string;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'An unknown error occurred';
        }
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, []);

  useEffect(() => {
    getPosition();
  }, [getPosition]);

  return { ...state, refresh: getPosition };
}
