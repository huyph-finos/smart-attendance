'use client';

/**
 * WiFi scanning hook.
 *
 * In standard web browsers, there is no API to scan WiFi networks or read
 * the current WiFi SSID/BSSID. The Network Information API only exposes
 * connection type (wifi, cellular, etc.) but not the specific network details.
 *
 * To get actual WiFi information, the app would need one of:
 * - A native mobile app (using platform-specific WiFi APIs)
 * - A native bridge (e.g., Capacitor, React Native)
 * - A browser extension with special permissions
 * - A companion desktop application exposing WiFi data via localhost
 *
 * This hook returns a stub so the rest of the app can reference WiFi data
 * without conditional checks everywhere. In production with a native wrapper,
 * replace this implementation with the actual native bridge calls.
 */

interface WifiInfo {
  ssid: string | null;
  bssid: string | null;
  isAvailable: boolean;
}

export function useWifi(): WifiInfo {
  return {
    ssid: null,
    bssid: null,
    isAvailable: false,
  };
}
