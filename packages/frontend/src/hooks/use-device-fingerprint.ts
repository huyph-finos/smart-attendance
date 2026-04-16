'use client';

import { useState, useEffect } from 'react';

const FINGERPRINT_KEY = 'deviceFingerprint';

interface DeviceFingerprint {
  fingerprint: string;
  platform: string;
  userAgent: string;
}

/**
 * Simple string hash function (djb2 algorithm).
 * Not cryptographic — used only for generating a deterministic fingerprint.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit integer, then to hex string
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform,
    `${screen.availWidth}x${screen.availHeight}`,
    `${navigator.maxTouchPoints ?? 0}`,
  ];

  const raw = components.join('|');

  // Generate multiple hash segments for a longer fingerprint
  const hash1 = hashString(raw);
  const hash2 = hashString(raw + 'salt1');
  const hash3 = hashString(raw + 'salt2');
  const hash4 = hashString(raw + 'salt3');

  return `${hash1}-${hash2}-${hash3}-${hash4}`;
}

export function useDeviceFingerprint(): DeviceFingerprint {
  const [fingerprint, setFingerprint] = useState<string>('');

  useEffect(() => {
    const cached = localStorage.getItem(FINGERPRINT_KEY);
    if (cached) {
      setFingerprint(cached);
    } else {
      const fp = generateFingerprint();
      localStorage.setItem(FINGERPRINT_KEY, fp);
      setFingerprint(fp);
    }
  }, []);

  return {
    fingerprint,
    platform: typeof navigator !== 'undefined' ? navigator.platform : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}
