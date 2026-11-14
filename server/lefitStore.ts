import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { AuthUser, ScannedProduct } from '../src/types';

export const ADMIN_EMAILS = new Set(['lefit.business@gmail.com']);
const ADMIN_PRIMARY_EMAIL = 'lefit.business@gmail.com';
const ADMIN_PASSWORD_SALT = '08edcc9c4bdd69a36ece6ba52105cdc8';
const ADMIN_PASSWORD_HASH =
  '20e1923f8124bb69b1e3a669369a871669ec2f2f0315dc0c05747146868a8e5d27eaaaeabfdd0cbe5adb206d2f0a5136243d4ac4176fe04818eeb1654b9184af';

export function isAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  return ADMIN_EMAILS.has(email.toLowerCase().trim());
}

export interface ServerAccountRecord {
  id: string;
  name: string;
  email: string;
  provider: 'google' | 'apple' | 'email';
  avatar?: string;
  createdAt: number;
  passwordSalt: string;
  passwordHash: string;
  savedRecipes: ScannedProduct[];
}

interface DatabaseSchema {
  accounts: Record<string, ServerAccountRecord>;
}

const DATA_DIR = path.resolve(process.cwd(), '.lefit-data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const SECRET_FILE = path.join(DATA_DIR, 'auth.secret');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getAuthSecret(): string {
  if (process.env.LEFIT_AUTH_SECRET && process.env.LEFIT_AUTH_SECRET.trim().length >= 16) {
    return process.env.LEFIT_AUTH_SECRET.trim();
  }
  ensureDataDir();
  if (fs.existsSync(SECRET_FILE)) {
    const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}

const AUTH_SECRET = getAuthSecret();

function ensureAdminAccount(db: DatabaseSchema): boolean {
  const existing = db.accounts[ADMIN_PRIMARY_EMAIL];
  if (!existing) {
    db.accounts[ADMIN_PRIMARY_EMAIL] = {
      id: 'admin-lefit-business',
      name: 'LEFIT Admin',
      email: ADMIN_PRIMARY_EMAIL,
      provider: 'email',
      createdAt: Date.now(),
      passwordSalt: ADMIN_PASSWORD_SALT,
      passwordHash: ADMIN_PASSWORD_HASH,
      savedRecipes: [],
    };
    return true;
  }

  if (existing.passwordSalt !== ADMIN_PASSWORD_SALT || existing.passwordHash !== ADMIN_PASSWORD_HASH) {
    existing.passwordSalt = ADMIN_PASSWORD_SALT;
    existing.passwordHash = ADMIN_PASSWORD_HASH;
    return true;
  }
  return false;
}

function loadDatabase(): DatabaseSchema {
  ensureDataDir();
  let db: DatabaseSchema = { accounts: {} };
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      db = {
        accounts: parsed.accounts || {},
      };
    } catch (err) {
      console.warn('[LEFIT Store] Failed to parse DB, initializing fresh:', err);
    }
  }
  const changed = ensureAdminAccount(db);
  if (changed || !fs.existsSync(DB_FILE)) {
    saveDatabase(db);
  }
  return db;
}

function saveDatabase(db: DatabaseSchema) {
  ensureDataDir();
  const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  fs.renameSync(tmpFile, DB_FILE);
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const activeSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, activeSalt, 64).toString('hex');
  return { salt: activeSalt, hash: derived };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function signSessionToken(user: AuthUser): string {
  const payload = {
    sub: user.email.toLowerCase().trim(),
    id: user.id,
    provider: user.provider,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): { email: string; id: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(encoded).digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.sub || !payload.exp || Date.now() > payload.exp) return null;
    return { email: normalizeEmail(payload.sub), id: payload.id };
  } catch {
    return null;
  }
}

export function checkAccountExists(email: string): { exists: boolean; provider?: string; name?: string } {
  const db = loadDatabase();
  const key = normalizeEmail(email);
  const acc = db.accounts[key];
  if (!acc) return { exists: false };
  return { exists: true, provider: acc.provider, name: acc.name };
}

export function getAccountByEmail(email: string): ServerAccountRecord | null {
  const db = loadDatabase();
  return db.accounts[normalizeEmail(email)] || null;
}

export function toPublicUser(acc: ServerAccountRecord): AuthUser {
  const isAdmin = isAdminEmail(acc.email);
  return {
    id: acc.id,
    name: acc.name,
    email: acc.email,
    provider: acc.provider,
    avatar: acc.avatar,
    createdAt: acc.createdAt,
    isAdmin,
    role: isAdmin ? 'admin' : 'user',
  };
}

export function authenticateAccount(params: {
  email: string;
  password: string;
  confirmPassword?: string;
  name?: string;
  provider: 'google' | 'apple' | 'email';
  avatar?: string;
}):
  | { ok: true; token: string; user: AuthUser; isNewAccount: boolean }
  | { ok: false; status: number; error: string } {
  const normalized = normalizeEmail(params.email);

  if (!normalized || !normalized.includes('@')) {
    return { ok: false, status: 400, error: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
  }

  const minLen = params.provider === 'email' ? 6 : 4;
  if (!params.password || params.password.length < minLen) {
    return {
      ok: false,
      status: 400,
      error: `Das Passwort muss mindestens ${minLen} Zeichen lang sein.`,
    };
  }

  const db = loadDatabase();
  let account = db.accounts[normalized];
  let isNewAccount = false;

  if (account) {
    // STRICT PASSWORD VERIFICATION: Exact password with which this account was created
    const valid = verifyPassword(params.password, account.passwordSalt, account.passwordHash);
    if (!valid) {
      return {
        ok: false,
        status: 401,
        error:
          account.provider === 'google' || params.provider === 'google'
            ? `Falsches Passwort für ${account.email}! Es ist ausschließlich das exakte Passwort gültig, mit dem dieses Google-Konto erstellt wurde.`
            : `Falsches Passwort für ${account.email}! Bitte gib genau das Passwort ein, mit dem das Konto erstellt wurde.`,
      };
    }
  } else {
    if (typeof params.confirmPassword === 'string' && params.confirmPassword !== params.password) {
      return {
        ok: false,
        status: 400,
        error: 'Die beiden Passwörter stimmen nicht überein.',
      };
    }

    const { salt: pwSalt, hash: pwHash } = hashPassword(params.password);
    isNewAccount = true;
    account = {
      id: `${params.provider}-${crypto.randomUUID().slice(0, 8)}`,
      name: params.name?.trim() || normalized.split('@')[0],
      email: normalized,
      provider: params.provider,
      avatar: params.avatar,
      createdAt: Date.now(),
      passwordSalt: pwSalt,
      passwordHash: pwHash,
      savedRecipes: [],
    };
    db.accounts[normalized] = account;
    saveDatabase(db);
  }

  const publicUser = toPublicUser(account);
  const token = signSessionToken(publicUser);

  return { ok: true, token, user: publicUser, isNewAccount };
}

export function saveUserRecipe(email: string, product: ScannedProduct): {
  ok: true;
  savedRecipes: ScannedProduct[];
} {
  const db = loadDatabase();
  const key = normalizeEmail(email);
  const acc = db.accounts[key];
  if (!acc) {
    throw new Error('Account not found');
  }

  const filtered = (acc.savedRecipes || []).filter(
    (p) => p.productName.toLowerCase() !== product.productName.toLowerCase()
  );
  acc.savedRecipes = [product, ...filtered];
  db.accounts[key] = acc;
  saveDatabase(db);

  return {
    ok: true,
    savedRecipes: acc.savedRecipes,
  };
}

export function syncUserRecipes(email: string, localRecipes: ScannedProduct[]): {
  savedRecipes: ScannedProduct[];
} {
  const db = loadDatabase();
  const key = normalizeEmail(email);
  const acc = db.accounts[key];
  if (!acc) throw new Error('Account not found');

  if (!Array.isArray(acc.savedRecipes)) {
    acc.savedRecipes = [];
  }
  const serverNames = new Set(acc.savedRecipes.map((r) => r.productName.toLowerCase()));

  for (const item of localRecipes) {
    if (!item || !item.productName) continue;
    if (serverNames.has(item.productName.toLowerCase())) continue;
    acc.savedRecipes.push(item);
    serverNames.add(item.productName.toLowerCase());
  }

  acc.savedRecipes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  db.accounts[key] = acc;
  saveDatabase(db);

  return {
    savedRecipes: acc.savedRecipes,
  };
}

export function deleteUserRecipe(email: string, recipeId: string): {
  savedRecipes: ScannedProduct[];
} {
  const db = loadDatabase();
  const key = normalizeEmail(email);
  const acc = db.accounts[key];
  if (!acc) throw new Error('Account not found');

  acc.savedRecipes = (acc.savedRecipes || []).filter((p) => p.id !== recipeId);
  db.accounts[key] = acc;
  saveDatabase(db);

  return {
    savedRecipes: acc.savedRecipes,
  };
}

export function resetUserRecipes(email: string): {
  savedRecipes: ScannedProduct[];
} {
  const db = loadDatabase();
  const key = normalizeEmail(email);
  const acc = db.accounts[key];
  if (!acc) throw new Error('Account not found');

  acc.savedRecipes = [];
  db.accounts[key] = acc;
  saveDatabase(db);

  return {
    savedRecipes: [],
  };
}
