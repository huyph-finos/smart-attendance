/**
 * Pure-TypeScript CIDR matching utilities.
 * Supports IPv4, IPv6, and IPv4-mapped IPv6 addresses (::ffff:x.x.x.x).
 */

/**
 * Normalize an IP address: strip IPv4-mapped IPv6 prefix and zone IDs.
 */
function normalizeIp(ip: string): string {
  let normalized = ip.trim();
  // Strip zone ID (e.g. %eth0)
  const zoneIdx = normalized.indexOf('%');
  if (zoneIdx !== -1) normalized = normalized.slice(0, zoneIdx);
  // Strip IPv4-mapped IPv6 prefix
  if (normalized.startsWith('::ffff:') && normalized.includes('.')) {
    normalized = normalized.slice(7);
  }
  return normalized;
}

function isIPv4(ip: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

/**
 * Convert an IPv4 address string to a 32-bit unsigned integer.
 */
function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Check if an IPv4 address is within a CIDR range.
 */
function ipv4InCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);

  if (prefix === 0) return true;
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

/**
 * Expand an IPv6 address to its full 8-group hex representation.
 * Handles :: shorthand expansion.
 */
function expandIPv6(ip: string): number[] {
  const halves = ip.split('::');
  let groups: string[] = [];

  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groups = ip.split(':');
  }

  return groups.map((g) => parseInt(g || '0', 16));
}

/**
 * Check if an IPv6 address is within a CIDR range.
 */
function ipv6InCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 128) return false;

  const ipGroups = expandIPv6(ip);
  const netGroups = expandIPv6(network);

  let bitsRemaining = prefix;
  for (let i = 0; i < 8; i++) {
    if (bitsRemaining <= 0) break;
    const bits = Math.min(bitsRemaining, 16);
    const mask = bits === 16 ? 0xffff : ((0xffff << (16 - bits)) & 0xffff);
    if ((ipGroups[i] & mask) !== (netGroups[i] & mask)) return false;
    bitsRemaining -= 16;
  }

  return true;
}

/**
 * Check if an IP address falls within a CIDR range.
 * Handles IPv4, IPv6, and IPv4-mapped IPv6 (::ffff:x.x.x.x).
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const normalizedIp = normalizeIp(ip);
  const [cidrNetwork] = cidr.split('/');
  const normalizedCidr = normalizeIp(cidrNetwork);

  // Rebuild CIDR with normalized network
  const prefix = cidr.split('/')[1];
  const cleanCidr = `${normalizedCidr}/${prefix}`;

  if (isIPv4(normalizedIp) && isIPv4(normalizedCidr)) {
    return ipv4InCidr(normalizedIp, cleanCidr);
  }

  if (!isIPv4(normalizedIp) && !isIPv4(normalizedCidr)) {
    return ipv6InCidr(normalizedIp, cleanCidr);
  }

  // Mismatched address families
  return false;
}

/**
 * Check if an IP matches any of the given CIDR ranges.
 */
export function isIpInAnyRange(ip: string, ranges: string[]): boolean {
  return ranges.some((cidr) => isIpInCidr(ip, cidr));
}
