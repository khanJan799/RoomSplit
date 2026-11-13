import {
  ActivityItem,
  AuthSession,
  Contribution,
  Expense,
  FundRequest,
  Group,
  Member,
  PersonalLoan,
  SettlementTransfer,
  UserAccount,
} from '../types';

export const PBKDF2_ITERATIONS = 100_000;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_FINANCIAL_AMOUNT = 1_000_000_000;
export const MIN_GROUP_PASSWORD_LENGTH = 4;
export const MAX_GROUP_PASSWORD_LENGTH = 128;

const RATE_LIMIT_STORAGE_KEY = 'roomsplit_rate_limit_v1';
const MAX_FAILED_ATTEMPTS_PER_ROOM = 5;
const MAX_GLOBAL_FAILED_ATTEMPTS = 15;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function getCryptoObj(): Crypto | undefined {
  return typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObj = getCryptoObj();
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }
  throw new Error('Cryptographically secure random generator is unavailable in this environment.');
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    return new Uint8Array(0);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function generateSecureId(prefix: string): string {
  const cryptoObj = getCryptoObj();
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `${prefix}-${cryptoObj.randomUUID()}`;
  }
  return `${prefix}-${bytesToHex(randomBytes(16))}`;
}

export function generateRoomCode(existingCodes: string[] = []): string {
  const normalizedExisting = new Set(existingCodes.map((c) => c.trim().toUpperCase()));
  for (let attempt = 0; attempt < 25; attempt++) {
    const bytes = randomBytes(6);
    let codeBody = '';
    for (let i = 0; i < 6; i++) {
      codeBody += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
    }
    const candidate = `RS-${codeBody}`;
    if (!normalizedExisting.has(candidate)) {
      return candidate;
    }
  }
  return `RS-${bytesToHex(randomBytes(4)).toUpperCase()}`;
}

/**
 * Pure TypeScript SHA-256 + HMAC-SHA256 + PBKDF2-SHA256 fallback
 * used strictly when Web Crypto `crypto.subtle` is unavailable (e.g. non-HTTPS local IP).
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(msg: Uint8Array): Uint8Array {
  const l = msg.length;
  const bitLen = l * 8;
  const paddedLen = Math.ceil((l + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(msg);
  padded[l] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64;
  const k = key.length > blockSize ? sha256Bytes(key) : key;
  const ipad = new Uint8Array(blockSize + data.length);
  const opad = new Uint8Array(blockSize + 32);
  ipad.fill(0x36, 0, blockSize);
  opad.fill(0x5c, 0, blockSize);
  for (let i = 0; i < k.length; i++) {
    ipad[i] ^= k[i];
    opad[i] ^= k[i];
  }
  ipad.set(data, blockSize);
  const inner = sha256Bytes(ipad);
  opad.set(inner, blockSize);
  return sha256Bytes(opad);
}

function pbkdf2Sha256Fallback(
  passwordBytes: Uint8Array,
  saltBytes: Uint8Array,
  iterations: number
): Uint8Array {
  const saltBlock = new Uint8Array(saltBytes.length + 4);
  saltBlock.set(saltBytes);
  saltBlock[saltBytes.length + 3] = 1; // block index 1 (32-byte key output)

  let u = hmacSha256(passwordBytes, saltBlock);
  const dk = new Uint8Array(u);
  for (let i = 1; i < iterations; i++) {
    u = hmacSha256(passwordBytes, u);
    for (let j = 0; j < 32; j++) {
      dk[j] ^= u[j];
    }
  }
  return dk;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface PasswordHashResult {
  hash: string;
  salt: string;
  algorithm: 'PBKDF2-SHA256';
}

export async function hashGroupPassword(
  password: string,
  existingSaltHex?: string
): Promise<PasswordHashResult> {
  const normalized = password.trim();
  const saltBytes = existingSaltHex ? hexToBytes(existingSaltHex) : randomBytes(16);
  const saltHex = existingSaltHex || bytesToHex(saltBytes);
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(normalized);

  const cryptoObj = getCryptoObj();
  if (cryptoObj && cryptoObj.subtle) {
    const keyMaterial = await cryptoObj.subtle.importKey(
      'raw',
      passwordBytes,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const derivedBits = await cryptoObj.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes.buffer.slice(saltBytes.byteOffset, saltBytes.byteOffset + saltBytes.byteLength) as ArrayBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return {
      hash: bytesToHex(new Uint8Array(derivedBits)),
      salt: saltHex,
      algorithm: 'PBKDF2-SHA256',
    };
  }

  const dk = pbkdf2Sha256Fallback(passwordBytes, saltBytes, PBKDF2_ITERATIONS);
  return {
    hash: bytesToHex(dk),
    salt: saltHex,
    algorithm: 'PBKDF2-SHA256',
  };
}

export async function verifyGroupPassword(
  candidatePassword: string,
  storedHash?: string,
  storedSalt?: string
): Promise<boolean> {
  const trimmed = candidatePassword.trim();
  if (!trimmed || !storedHash || !storedSalt) {
    return false;
  }
  const computed = await hashGroupPassword(trimmed, storedSalt);
  return constantTimeEqual(computed.hash, storedHash);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  reason?: 'empty' | 'too_short' | 'too_long';
} {
  const trimmed = password.trim();
  if (!trimmed) return { valid: false, reason: 'empty' };
  if (trimmed.length < MIN_GROUP_PASSWORD_LENGTH) return { valid: false, reason: 'too_short' };
  if (trimmed.length > MAX_GROUP_PASSWORD_LENGTH) return { valid: false, reason: 'too_long' };
  return { valid: true };
}

/**
 * Auth Session Helpers (bound to memberId & expiring after SESSION_TTL_MS)
 */
export function createAuthSession(groupId: string, memberId: string): AuthSession {
  const now = Date.now();
  return {
    groupId,
    memberId,
    token: bytesToHex(randomBytes(24)),
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
}

export function isSessionValid(
  session: AuthSession | undefined | null,
  expectedMemberId?: string | null
): boolean {
  if (!session || typeof session !== 'object') return false;
  if (!session.groupId || !session.memberId || !session.token) return false;
  if (expectedMemberId && session.memberId !== expectedMemberId) return false;
  if (typeof session.expiresAt !== 'number' || !Number.isFinite(session.expiresAt)) return false;
  return Date.now() < session.expiresAt;
}

export function pruneExpiredSessions(
  sessions: Record<string, AuthSession>
): Record<string, AuthSession> {
  const now = Date.now();
  const cleaned: Record<string, AuthSession> = {};
  for (const [groupId, session] of Object.entries(sessions)) {
    if (
      session &&
      typeof session === 'object' &&
      session.groupId === groupId &&
      typeof session.memberId === 'string' &&
      typeof session.token === 'string' &&
      typeof session.expiresAt === 'number' &&
      session.expiresAt > now
    ) {
      cleaned[groupId] = session;
    }
  }
  return cleaned;
}

/**
 * Brute-force rate limiter for room joining / credential verification
 */
interface RateLimitBucket {
  timestamps: number[];
  lockedUntil: number;
}

const memoryRateLimits = new Map<string, RateLimitBucket>();

function loadRateLimitStore(): Record<string, RateLimitBucket> {
  const out: Record<string, RateLimitBucket> = {};
  memoryRateLimits.forEach((v, k) => {
    out[k] = v;
  });
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (v && typeof v === 'object' && Array.isArray((v as RateLimitBucket).timestamps)) {
              out[k] = v as RateLimitBucket;
            }
          }
        }
      }
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
  return out;
}

function saveRateLimitStore(store: Record<string, RateLimitBucket>): void {
  memoryRateLimits.clear();
  for (const [k, v] of Object.entries(store)) {
    memoryRateLimits.set(k, v);
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
}

export function resetAllRateLimits(): void {
  memoryRateLimits.clear();
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

function normalizeRateKey(code: string): string {
  const clean = code.trim().toUpperCase();
  if (!clean) return 'room:__empty__';
  return `room:${clean.startsWith('RS-') ? clean : `RS-${clean}`}`;
}

export function checkJoinRateLimit(code: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const store = loadRateLimitStore();
  const roomKey = normalizeRateKey(code);
  const keys = [roomKey, '__global__'];

  let maxLockedUntil = 0;
  for (const k of keys) {
    const bucket = store[k];
    if (bucket && bucket.lockedUntil > now) {
      maxLockedUntil = Math.max(maxLockedUntil, bucket.lockedUntil);
    }
  }

  if (maxLockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((maxLockedUntil - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedJoinAttempt(code: string): {
  locked: boolean;
  retryAfterSeconds: number;
  attemptsRemaining: number;
} {
  const now = Date.now();
  const store = loadRateLimitStore();
  const roomKey = normalizeRateKey(code);

  const updateBucket = (key: string, maxAttempts: number): RateLimitBucket => {
    const existing = store[key] || { timestamps: [], lockedUntil: 0 };
    const recent = existing.timestamps.filter((ts) => now - ts < ATTEMPT_WINDOW_MS);
    recent.push(now);
    const lockedUntil =
      recent.length >= maxAttempts ? Math.max(existing.lockedUntil, now + LOCKOUT_DURATION_MS) : existing.lockedUntil;
    const updated: RateLimitBucket = { timestamps: recent, lockedUntil };
    store[key] = updated;
    return updated;
  };

  const roomBucket = updateBucket(roomKey, MAX_FAILED_ATTEMPTS_PER_ROOM);
  const globalBucket = updateBucket('__global__', MAX_GLOBAL_FAILED_ATTEMPTS);
  saveRateLimitStore(store);

  const maxLockedUntil = Math.max(roomBucket.lockedUntil, globalBucket.lockedUntil);
  if (maxLockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((maxLockedUntil - now) / 1000)),
      attemptsRemaining: 0,
    };
  }

  return {
    locked: false,
    retryAfterSeconds: 0,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS_PER_ROOM - roomBucket.timestamps.length),
  };
}

export function clearJoinRateLimit(code: string): void {
  const store = loadRateLimitStore();
  const roomKey = normalizeRateKey(code);
  delete store[roomKey];
  saveRateLimitStore(store);
}

/**
 * Input Sanitization & Validation
 */
export function sanitizeText(input: unknown, maxLength = 120): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizePhone(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/[^0-9+\-\s()]/g, '')
    .trim()
    .slice(0, 24);
}

export function validateIsoDate(input: unknown): string {
  const fallback = new Date().toISOString().split('T')[0];
  if (typeof input !== 'string') return fallback;
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return fallback;
  const parsed = Date.parse(`${trimmed}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return fallback;
  return trimmed;
}

export function validateFinancialAmount(
  raw: unknown,
  options: { allowZero?: boolean; max?: number } = {}
): { valid: boolean; value: number; error?: string } {
  const { allowZero = false, max = MAX_FINANCIAL_AMOUNT } = options;
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;

  if (!Number.isFinite(num)) {
    return { valid: false, value: 0, error: 'Invalid numeric amount.' };
  }

  const rounded = Math.round(num * 100) / 100;
  if (allowZero ? rounded < 0 : rounded <= 0) {
    return {
      valid: false,
      value: 0,
      error: allowZero ? 'Amount cannot be negative.' : 'Amount must be greater than zero.',
    };
  }

  if (rounded > max) {
    return {
      valid: false,
      value: 0,
      error: `Amount exceeds maximum allowed limit (${max.toLocaleString()}).`,
    };
  }

  return { valid: true, value: rounded };
}

/**
 * Duplicate rapid submission protection
 */
const recentActionLocks = new Map<string, number>();

export function claimActionLock(actionKey: string, windowMs = 800): boolean {
  const now = Date.now();
  const prev = recentActionLocks.get(actionKey);
  if (prev && now - prev < windowMs) {
    return false;
  }
  recentActionLocks.set(actionKey, now);
  if (recentActionLocks.size > 200) {
    for (const [k, ts] of recentActionLocks.entries()) {
      if (now - ts > 10_000) recentActionLocks.delete(k);
    }
  }
  return true;
}

export function resetActionLocks(): void {
  recentActionLocks.clear();
}

/**
 * Safe Storage Deserialization & Schema Guards (prevents prototype pollution & corrupted storage crashes)
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function stripUnsafeKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsafeKeys);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!FORBIDDEN_KEYS.has(k)) {
        clean[k] = stripUnsafeKeys(v);
      }
    }
    return clean;
  }
  return value;
}

export function safeParseArray<T>(
  raw: string | null,
  isValidItem: (item: unknown) => item is T,
  fallback: T[]
): T[] {
  if (!raw) return fallback;
  try {
    const parsed = stripUnsafeKeys(JSON.parse(raw));
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter(isValidItem);
  } catch {
    return fallback;
  }
}

export function safeParseObject<T>(
  raw: string | null,
  isValidObj: (obj: unknown) => obj is T,
  fallback: T
): T {
  if (!raw) return fallback;
  try {
    const parsed = stripUnsafeKeys(JSON.parse(raw));
    return isValidObj(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export function isValidMember(val: unknown): val is Member {
  if (!val || typeof val !== 'object') return false;
  const m = val as Member;
  return (
    isNonEmptyString(m.id) &&
    isNonEmptyString(m.name) &&
    typeof m.phone === 'string' &&
    typeof m.roomNumber === 'string' &&
    (m.role === 'main_admin' || m.role === 'co_admin' || m.role === 'member')
  );
}

export function isValidUserAccount(val: unknown): val is UserAccount {
  if (!val || typeof val !== 'object') return false;
  const u = val as UserAccount;
  return (
    isNonEmptyString(u.id) &&
    isNonEmptyString(u.name) &&
    typeof u.phone === 'string' &&
    typeof u.roomNumber === 'string' &&
    typeof u.createdAt === 'string'
  );
}

export function isValidGroup(val: unknown): val is Group & { password?: string } {
  if (!val || typeof val !== 'object') return false;
  const g = val as Group & { password?: string };
  return (
    isNonEmptyString(g.id) &&
    isNonEmptyString(g.name) &&
    isNonEmptyString(g.code) &&
    isNonEmptyString(g.mainAdminId) &&
    (g.currency === 'IQD' || g.currency === 'USD' || g.currency === 'EUR') &&
    typeof g.initialFund === 'number' &&
    Number.isFinite(g.initialFund) &&
    Array.isArray(g.members) &&
    g.members.every(isValidMember)
  );
}

export function isValidContribution(val: unknown): val is Contribution {
  if (!val || typeof val !== 'object') return false;
  const c = val as Contribution;
  return (
    isNonEmptyString(c.id) &&
    isNonEmptyString(c.groupId) &&
    isNonEmptyString(c.memberId) &&
    typeof c.confirmedAmount === 'number' &&
    Number.isFinite(c.confirmedAmount) &&
    c.confirmedAmount >= 0
  );
}

export function isValidFundRequest(val: unknown): val is FundRequest {
  if (!val || typeof val !== 'object') return false;
  const r = val as FundRequest;
  return (
    isNonEmptyString(r.id) &&
    isNonEmptyString(r.groupId) &&
    isNonEmptyString(r.memberId) &&
    typeof r.amount === 'number' &&
    Number.isFinite(r.amount) &&
    r.amount > 0 &&
    (r.status === 'pending' || r.status === 'approved' || r.status === 'rejected')
  );
}

export function isValidExpense(val: unknown): val is Expense {
  if (!val || typeof val !== 'object') return false;
  const e = val as Expense;
  return (
    isNonEmptyString(e.id) &&
    isNonEmptyString(e.groupId) &&
    typeof e.amount === 'number' &&
    Number.isFinite(e.amount) &&
    e.amount > 0 &&
    Array.isArray(e.sharedMemberIds)
  );
}

export function isValidLoan(val: unknown): val is PersonalLoan {
  if (!val || typeof val !== 'object') return false;
  const l = val as PersonalLoan;
  return (
    isNonEmptyString(l.id) &&
    isNonEmptyString(l.groupId) &&
    isNonEmptyString(l.borrowerId) &&
    isNonEmptyString(l.lenderId) &&
    typeof l.originalAmount === 'number' &&
    Number.isFinite(l.originalAmount) &&
    l.originalAmount > 0 &&
    typeof l.remainingAmount === 'number' &&
    Number.isFinite(l.remainingAmount) &&
    l.remainingAmount >= 0
  );
}

export function isValidSettlementTransfer(val: unknown): val is SettlementTransfer {
  if (!val || typeof val !== 'object') return false;
  const s = val as SettlementTransfer;
  return (
    isNonEmptyString(s.id) &&
    isNonEmptyString(s.groupId) &&
    isNonEmptyString(s.fromMemberId) &&
    isNonEmptyString(s.toMemberId) &&
    typeof s.amount === 'number' &&
    Number.isFinite(s.amount) &&
    s.amount > 0
  );
}

export function isValidActivity(val: unknown): val is ActivityItem {
  if (!val || typeof val !== 'object') return false;
  const a = val as ActivityItem;
  return (
    isNonEmptyString(a.id) &&
    isNonEmptyString(a.groupId) &&
    typeof a.title === 'string' &&
    typeof a.amount === 'number' &&
    Number.isFinite(a.amount)
  );
}

export function isValidSessionRecord(val: unknown): val is Record<string, AuthSession> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  return true;
}
