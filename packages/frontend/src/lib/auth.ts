const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  if (!isBrowser()) return false;
  const token = getAccessToken();
  if (!token) return false;
  // Check if token is expired by decoding JWT payload
  return !isTokenExpired(token);
}

/**
 * Decode JWT payload and check expiration.
 * Returns true if token is expired or malformed.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    // Add 30s buffer so we refresh before actual expiry
    return Date.now() >= (payload.exp * 1000) - 30_000;
  } catch {
    return true;
  }
}

/**
 * Get seconds until token expires. Returns 0 if expired or invalid.
 */
/**
 * Get seconds until token expires (with same 30s buffer as isTokenExpired).
 * Returns 0 if expired or invalid.
 */
export function getTokenTTL(): number {
  const token = getAccessToken();
  if (!token) return 0;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return Infinity;
    // Same 30s buffer as isTokenExpired for consistency
    const remaining = Math.floor((payload.exp * 1000 - 30_000 - Date.now()) / 1000);
    return Math.max(0, remaining);
  } catch {
    return 0;
  }
}
