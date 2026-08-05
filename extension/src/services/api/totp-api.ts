const TOTP_STORAGE_KEY = 'popupTotpAccounts';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export interface TOTPAccount {
  id: string;
  issuer: string;
  accountName: string;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: 6 | 8;
  period: number;
  createdAt: string;
  updatedAt: string;
}

interface StoredTOTPAccount extends TOTPAccount {
  secret: string;
}

export interface TOTPCode {
  code: string;
  period: number;
  expiresIn: number;
  expiresAt: string;
}

export interface CreateTOTPAccountRequest {
  issuer?: string;
  accountName?: string;
  secret?: string;
  otpauthUrl?: string;
  algorithm?: string;
  digits?: number;
  period?: number;
}

export async function listTOTPAccounts(): Promise<TOTPAccount[]> {
  const accounts = await readStoredAccounts();
  return accounts.map(toPublicAccount).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function createTOTPAccount(body: CreateTOTPAccountRequest): Promise<TOTPAccount> {
  const accounts = await readStoredAccounts();
  const normalized = normalizeCreateRequest(body);
  await generateTOTP(normalized.secret, normalized.algorithm, normalized.digits, normalized.period, Date.now());

  const now = new Date().toISOString();
  const account: StoredTOTPAccount = {
    id: `totp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    issuer: normalized.issuer,
    accountName: normalized.accountName,
    secret: normalized.secret,
    algorithm: normalized.algorithm,
    digits: normalized.digits,
    period: normalized.period,
    createdAt: now,
    updatedAt: now
  };

  await writeStoredAccounts([account, ...accounts]);
  return toPublicAccount(account);
}

export async function deleteTOTPAccount(id: string): Promise<void> {
  const accounts = await readStoredAccounts();
  await writeStoredAccounts(accounts.filter((account) => account.id !== id));
}

export async function getTOTPCode(id: string): Promise<TOTPCode> {
  const accounts = await readStoredAccounts();
  const account = accounts.find((item) => item.id === id);
  if (!account) {
    throw new Error('令牌不存在');
  }
  const now = Date.now();
  const code = await generateTOTP(account.secret, account.algorithm, account.digits, account.period, now);
  const periodMs = account.period * 1000;
  const expiresAtMs = Math.floor(now / periodMs) * periodMs + periodMs;
  return {
    code,
    period: account.period,
    expiresIn: Math.max(0, Math.ceil((expiresAtMs - now) / 1000)),
    expiresAt: new Date(expiresAtMs).toISOString()
  };
}

async function readStoredAccounts(): Promise<StoredTOTPAccount[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return readFallbackAccounts();
  }
  const snapshot = await chrome.storage.local.get(TOTP_STORAGE_KEY);
  const value = snapshot[TOTP_STORAGE_KEY];
  return Array.isArray(value) ? value.filter(isStoredAccount) : [];
}

async function writeStoredAccounts(accounts: StoredTOTPAccount[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(TOTP_STORAGE_KEY, JSON.stringify(accounts));
    return;
  }
  await chrome.storage.local.set({ [TOTP_STORAGE_KEY]: accounts });
}

function readFallbackAccounts(): StoredTOTPAccount[] {
  try {
    const raw = localStorage.getItem(TOTP_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isStoredAccount) : [];
  } catch {
    return [];
  }
}

function normalizeCreateRequest(body: CreateTOTPAccountRequest): Required<CreateTOTPAccountRequest> {
  if (body.otpauthUrl?.trim()) {
    return parseOTPAUTHURL(body.otpauthUrl);
  }

  const accountName = body.accountName?.trim() || '';
  const secret = normalizeSecret(body.secret || '');
  const algorithm = normalizeAlgorithm(body.algorithm);
  const digits = normalizeDigits(body.digits);
  const period = normalizePeriod(body.period);

  validate(accountName, secret, algorithm, digits, period);
  return {
    issuer: body.issuer?.trim() || '',
    accountName,
    secret,
    otpauthUrl: '',
    algorithm,
    digits,
    period
  };
}

function parseOTPAUTHURL(raw: string): Required<CreateTOTPAccountRequest> {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error('otpauth 链接格式无效');
  }
  if (parsed.protocol !== 'otpauth:' || parsed.hostname !== 'totp') {
    throw new Error('仅支持 otpauth://totp 链接');
  }

  const params = parsed.searchParams;
  const label = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  const [labelIssuer, labelAccount] = label.includes(':') ? label.split(/:(.*)/s).filter(Boolean) : ['', label];
  const accountName = (labelAccount || label).trim();
  const issuer = (params.get('issuer') || labelIssuer || '').trim();
  const secret = normalizeSecret(params.get('secret') || '');
  const algorithm = normalizeAlgorithm(params.get('algorithm') || undefined);
  const digits = normalizeDigits(Number(params.get('digits')) || undefined);
  const period = normalizePeriod(Number(params.get('period')) || undefined);

  validate(accountName, secret, algorithm, digits, period);
  return {
    issuer,
    accountName,
    secret,
    otpauthUrl: '',
    algorithm,
    digits,
    period
  };
}

async function generateTOTP(
  secret: string,
  algorithm: 'SHA1' | 'SHA256' | 'SHA512',
  digits: 6 | 8,
  period: number,
  timestamp: number
): Promise<string> {
  const keyBytes = decodeBase32(secret);
  const counter = Math.floor(timestamp / 1000 / period);
  const counterBytes = new ArrayBuffer(8);
  const counterView = new DataView(counterBytes);
  counterView.setUint32(4, counter, false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: algorithm.replace('SHA', 'SHA-') } },
    false,
    ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBytes));
  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

function decodeBase32(secret: string): Uint8Array {
  const normalized = normalizeSecret(secret);
  let bits = '';
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error('Secret 必须是有效 Base32');
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  if (bytes.length === 0) {
    throw new Error('Secret 必须是有效 Base32');
  }
  return new Uint8Array(bytes);
}

function validate(accountName: string, secret: string, algorithm: string, digits: number, period: number): void {
  if (!accountName) {
    throw new Error('账户不能为空');
  }
  if (!secret) {
    throw new Error('Secret 不能为空');
  }
  decodeBase32(secret);
  if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) {
    throw new Error('算法仅支持 SHA1、SHA256、SHA512');
  }
  if (digits !== 6 && digits !== 8) {
    throw new Error('位数仅支持 6 或 8');
  }
  if (period < 10 || period > 300) {
    throw new Error('周期必须在 10 到 300 秒之间');
  }
}

function normalizeSecret(secret: string): string {
  return secret.trim().toUpperCase().replace(/[\s-]/g, '').replace(/=+$/g, '');
}

function normalizeAlgorithm(algorithm?: string): 'SHA1' | 'SHA256' | 'SHA512' {
  const normalized = (algorithm || 'SHA1').trim().toUpperCase().replace('-', '');
  if (normalized === 'SHA256' || normalized === 'SHA512') {
    return normalized;
  }
  return 'SHA1';
}

function normalizeDigits(digits?: number): 6 | 8 {
  return digits === 8 ? 8 : 6;
}

function normalizePeriod(period?: number): number {
  return Number.isFinite(period) && period ? Math.max(10, Math.min(300, Math.trunc(period))) : 30;
}

function toPublicAccount(account: StoredTOTPAccount): TOTPAccount {
  const { secret: _secret, ...publicAccount } = account;
  return publicAccount;
}

function isStoredAccount(value: unknown): value is StoredTOTPAccount {
  const account = value as StoredTOTPAccount;
  return Boolean(account?.id && account.accountName && account.secret && account.period);
}
