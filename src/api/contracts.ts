// Fuente: ../docs/CONTRATO-DETALLADO-PROPUESTA.md §1–5 y DERCAS §16.
export type UserSelf = { id: string; email: string; platformRole: 'PLATFORM_ADMIN' | null };
export type SessionTokens = { accessToken: string; tokenType: 'Bearer'; expiresIn: 900; refreshToken: string; refreshExpiresAt: string; user: UserSelf };
export type CompanyStatus = 'ACTIVE' | 'PENDING_ACTIVATION' | 'SUSPENDED';
export type CompanySelection = { companyId: string; tradeName: string; status: CompanyStatus; role: 'COMPANY_ADMIN' | 'SELLER' };
type CompanyBase = { id: string; tradeName: string; status: CompanyStatus };
export type Company = (CompanyBase & { representation: 'BASIC' }) | (CompanyBase & { representation: 'FULL'; legalName: string; ruc: string; taxAddress: string; contactEmail: string; contactPhone: string; createdAt: string; updatedAt: string });
export type Page<T> = { items: T[]; nextCursor: string | null };
export class ContractError extends Error { constructor() { super('La API devolvió una respuesta no válida.'); } }
function requireValue(value: unknown): asserts value { if (!value) throw new ContractError(); }
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value));
  const result = value as Record<string, unknown>;
  requireValue(Object.keys(result).length === keys.length && keys.every(key => Object.hasOwn(result, key)));
  return result;
}
function text(value: unknown, max: number): string {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.trim() === value && [...value].length <= max && !/[\p{Cc}\p{Cs}]/u.test(value));
  return value as string;
}
export function uuid(value: unknown): string { const result = text(value, 36); requireValue(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)); return result; }
function date(value: unknown): string { const result = text(value, 24); requireValue(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(result) && Number.isFinite(Date.parse(result)) && new Date(result).toISOString() === result); return result; }
export function refreshToken(value: unknown): string { const result = text(value, 43); requireValue(/^[A-Za-z0-9_-]{43}$/.test(result)); return result; }
function status(value: unknown): CompanyStatus { requireValue(['ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED'].includes(value as string)); return value as CompanyStatus; }
function email(value: unknown): string {
  const result = text(value, 254);
  const parts = result.split('@'); const local = parts[0]; const domain = parts[1];
  requireValue(parts.length === 2 && local && domain && /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && domain.split('.').every(label => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label)));
  return result;
}
export function userSelf(value: unknown): UserSelf {
  const v = object(value, ['id', 'email', 'platformRole']);
  requireValue(v.platformRole === null || v.platformRole === 'PLATFORM_ADMIN');
  return { id: uuid(v.id), email: email(v.email), platformRole: v.platformRole as UserSelf['platformRole'] };
}
export function sessionTokens(value: unknown): SessionTokens {
  const v = object(value, ['accessToken', 'tokenType', 'expiresIn', 'refreshToken', 'refreshExpiresAt', 'user']);
  const accessToken = text(v.accessToken, 4096);
  // Solo formato compacto. La firma/claims y vigencia son autoridad del servidor.
  requireValue(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken) && v.tokenType === 'Bearer' && v.expiresIn === 900);
  return { accessToken, tokenType: 'Bearer', expiresIn: 900, refreshToken: refreshToken(v.refreshToken), refreshExpiresAt: date(v.refreshExpiresAt), user: userSelf(v.user) };
}
export function company(value: unknown): Company {
  const discriminant = (value as { representation?: unknown } | null)?.representation;
  requireValue(discriminant === 'BASIC' || discriminant === 'FULL');
  const base = ['representation', 'id', 'tradeName', 'status'];
  const v = object(value, discriminant === 'BASIC' ? base : [...base, 'legalName', 'ruc', 'taxAddress', 'contactEmail', 'contactPhone', 'createdAt', 'updatedAt']);
  const common = { id: uuid(v.id), tradeName: text(v.tradeName, 150), status: status(v.status) };
  if (discriminant === 'BASIC') return { ...common, representation: 'BASIC' };
  requireValue(typeof v.ruc === 'string' && /^[0-9]{13}$/.test(v.ruc) && typeof v.contactPhone === 'string' && /^\+[0-9]{8,15}$/.test(v.contactPhone));
  return { ...common, representation: 'FULL', legalName: text(v.legalName, 250), ruc: v.ruc as string, taxAddress: text(v.taxAddress, 300), contactEmail: email(v.contactEmail), contactPhone: v.contactPhone as string, createdAt: date(v.createdAt), updatedAt: date(v.updatedAt) };
}
export function companyPage(value: unknown): Page<CompanySelection> {
  const v = object(value, ['items', 'nextCursor']);
  requireValue(Array.isArray(v.items) && v.items.length <= 20);
  requireValue(v.nextCursor === null || (typeof v.nextCursor === 'string' && /^[\x21-\x7e]{1,2048}$/.test(v.nextCursor)));
  const items = (v.items as unknown[]).map(item => {
    const row = object(item, ['companyId', 'tradeName', 'status', 'role']);
    requireValue(row.role === 'COMPANY_ADMIN' || row.role === 'SELLER');
    return { companyId: uuid(row.companyId), tradeName: text(row.tradeName, 150), status: status(row.status), role: row.role as CompanySelection['role'] };
  });
  requireValue(new Set(items.map(item => item.companyId)).size === items.length);
  return { items, nextCursor: v.nextCursor as string | null };
}
