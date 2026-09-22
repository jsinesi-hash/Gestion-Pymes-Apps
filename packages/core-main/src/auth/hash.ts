import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const N = 16384;
const r = 8;
const p = 1;
const KEY_LEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, KEY_LEN, { N, r, p }).toString('hex');
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const parts = stored.split('$');
    // parts: ['scrypt', N, r, p, saltHex, hashHex]
    const [, storedN, storedR, storedP, saltHex, hashHex] = parts;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(plain, saltHex, expected.length, {
      N: parseInt(storedN),
      r: parseInt(storedR),
      p: parseInt(storedP),
    });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
