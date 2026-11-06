import { ApiError, type Transport } from '../src/api/client';
import { company, companyPage, sessionTokens } from '../src/api/contracts';
import { Session } from '../src/auth/session';
import type { SecureStorage } from '../src/auth/secureStorage';

// TODOS los datos y tokens de este archivo son fixtures sintéticos; transporte/almacén simulados.
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const user = { id, email: 'fixture@example.test', platformRole: null };
const fixtureExpiry = new Date(Date.now() + 86400000).toISOString();
const tokens = (suffix = 'one') => ({ accessToken: `e30.e30.${suffix}`, tokenType: 'Bearer', expiresIn: 900, refreshToken: (suffix === 'one' ? 'a' : 'b').repeat(43), refreshExpiresAt: fixtureExpiry, user });
const row = (companyId = id) => ({ companyId, tradeName: 'Empresa de prueba', status: 'ACTIVE', role: 'SELLER' });
const basic = (companyId = id) => ({ representation: 'BASIC', id: companyId, tradeName: 'Empresa de prueba', status: 'ACTIVE' });
const full = () => ({ ...basic(), representation: 'FULL', legalName: 'Razón sintética', ruc: '1234567890123', taxAddress: 'Dirección ficticia', contactEmail: 'fixture@example.test', contactPhone: '+59312345678', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup() {
  let saved: string | null = null;
  const storage: jest.Mocked<SecureStorage> = { read: jest.fn(async () => saved), write: jest.fn(async value => { saved = value; }), clear: jest.fn(async () => { saved = null; }) };
  const transport = jest.fn<ReturnType<Transport>, Parameters<Transport>>().mockImplementation(async path => {
    if (path === '/auth/login' || path === '/auth/refresh') return tokens();
    if (path === '/auth/logout') return undefined;
    if (path === '/auth/me') return user;
    if (path.startsWith('/me/companies')) return { items: [row()], nextCursor: null };
    if (path.startsWith('/companies/')) return basic(path.split('/').pop());
    throw new Error('Ruta de fixture inesperada');
  });
  return { session: new Session(storage, transport), storage, transport, saved: () => saved };
}
const login = (session: Session) => session.login('fixture@example.test', 'Synthetic!Only');

describe('validadores de contrato, fixtures', () => {
  it('rechaza campos faltantes, desconocidos, token corrupto, fechas y páginas inválidas', () => {
    expect(() => sessionTokens({ ...tokens(), refreshToken: 'bad' })).toThrow();
    expect(() => sessionTokens({ ...tokens(), accessToken: 'not a JWT' })).toThrow();
    expect(() => sessionTokens({ ...tokens(), user: { ...user, companyId: id } })).toThrow();
    expect(() => sessionTokens({ ...tokens(), expiresIn: 3600 })).toThrow();
    expect(() => sessionTokens({ ...tokens(), refreshExpiresAt: 'invalid' })).toThrow();
    expect(() => company({ ...basic(), legalName: 'No permitido' })).toThrow();
    expect(() => company({ representation: 'BASIC' })).toThrow();
    expect(() => companyPage({ items: Array(21).fill(row()), nextCursor: null })).toThrow();
    expect(() => companyPage({ items: [row()], nextCursor: '' })).toThrow();
  });
});
it('guarda refresh antes de publicar access/identidad; no persiste access o password', async () => {
  const { session, storage, transport } = setup(); const write = deferred<void>(); storage.write.mockReturnValueOnce(write.promise);
  const pending = login(session); await new Promise(resolve => setTimeout(resolve, 0));
  expect(session.getSnapshot().user).toBeNull();
  expect(transport.mock.calls.some(([path]) => path === '/me/companies')).toBe(false);
  write.resolve(); await pending;
  expect(storage.write).toHaveBeenCalledWith('a'.repeat(43)); expect(session.getSnapshot().user).toEqual(user);
  expect(JSON.stringify(session.getSnapshot())).not.toContain('accessToken');
});
it('login incorrecto no renueva ni revela detalles', async () => {
  const { session, transport } = setup(); transport.mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS'));
  await login(session);
  expect(session.getSnapshot().user).toBeNull(); expect(session.getSnapshot().message).toContain('Credenciales inválidas');
  expect(transport.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(0);
});
it('fallo de almacenamiento nunca presenta sesión válida e intenta revocar', async () => {
  const { session, storage, transport } = setup(); storage.write.mockRejectedValueOnce(new Error('detalle nativo sensible'));
  await login(session);
  expect(session.getSnapshot().user).toBeNull(); expect(storage.clear).toHaveBeenCalled();
  expect(session.getSnapshot().message).not.toContain('detalle nativo');
  expect(transport.mock.calls.some(([path]) => path === '/auth/logout')).toBe(true);
});
it('restauración es explícita, renueva una vez y consulta identidad vigente', async () => {
  const { session, storage, transport } = setup(); await storage.write('a'.repeat(43));
  expect(transport).not.toHaveBeenCalled(); await session.restore();
  expect(session.getSnapshot().user).toEqual(user);
  expect(transport.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(1);
  expect(transport.mock.calls.some(([path]) => path === '/auth/me')).toBe(true);
});
it('restauración incierta no repite refresh y pide login, limpiando todo', async () => {
  const { session, storage, transport, saved } = setup(); await storage.write('a'.repeat(43));
  transport.mockRejectedValueOnce(new Error('respuesta perdida'));
  await session.restore();
  expect(session.getSnapshot().user).toBeNull(); expect(saved()).toBeNull();
  expect(session.getSnapshot().message).toContain('Inicia sesión');
  expect(transport.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(1);
});
it('GET expirados concurrentes usan un solo refresh y solo un replay por GET', async () => {
  const { session, transport } = setup(); await login(session); const renewal = deferred<unknown>(); const rotated = tokens('two');
  transport.mockImplementation(async (path, options) => {
    if (path === '/auth/refresh') return renewal.promise;
    if (options?.access?.endsWith('.one')) throw new ApiError(401, 'ACCESS_TOKEN_EXPIRED');
    return user;
  });
  const a = session.get('/auth/me'); const b = session.get('/auth/me');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(transport.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(1);
  renewal.resolve(rotated); expect(await Promise.all([a, b])).toEqual([user, user]);
  expect(transport.mock.calls.filter(([path]) => path === '/auth/me')).toHaveLength(4);
});
it.each([[401, 'UNAUTHENTICATED'], [401, 'SESSION_EXPIRED'], [401, 'SESSION_REVOKED'], [403, 'FORBIDDEN'], [404, 'RESOURCE_NOT_FOUND'], [409, 'STATE_CONFLICT']])('no renueva ante %s %s', async (status, code) => {
  const { session, transport } = setup(); await login(session);
  transport.mockRejectedValueOnce(new ApiError(status as number, code as string));
  await expect(session.get('/auth/me')).rejects.toThrow();
  expect(transport.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(0);
  if (status === 401) expect(session.getSnapshot().user).toBeNull();
});
it('logout borra privado y seguro aun sin red, sin afirmar revocación remota', async () => {
  const { session, transport, saved } = setup(); await login(session); await session.selectCompany(id);
  transport.mockRejectedValue(new Error('sin red')); await session.logout();
  expect(saved()).toBeNull(); expect(session.getSnapshot()).toMatchObject({ user: null, company: null, companies: [] });
  expect(session.getSnapshot().message).toContain('No se confirmó la revocación remota');
});
it('respuesta de login tardía tras logout se revoca y no publica credenciales', async () => {
  const { session, transport, saved } = setup(); const late = deferred<unknown>(); transport.mockReturnValueOnce(late.promise);
  const pending = login(session); await session.logout(); late.resolve(tokens()); await pending;
  expect(session.getSnapshot().user).toBeNull(); expect(saved()).toBeNull();
  expect(transport.mock.calls.some(([path, options]) => path === '/auth/logout' && (options?.body as { refreshToken: string }).refreshToken === 'a'.repeat(43))).toBe(true);
});
it('escritura tardía se serializa antes del borrado; no afecta el siguiente login', async () => {
  const { session, storage, saved } = setup(); const pendingWrite = deferred<void>(); const original = storage.write.getMockImplementation()!;
  storage.write.mockImplementationOnce(async value => { await pendingWrite.promise; await original(value); });
  const pendingLogin = login(session); await new Promise(resolve => setTimeout(resolve, 0));
  const pendingLogout = session.logout(); pendingWrite.resolve(); await Promise.all([pendingLogin, pendingLogout]);
  expect(saved()).toBeNull(); expect(session.getSnapshot().user).toBeNull();
  await login(session); expect(saved()).toBe('a'.repeat(43)); expect(session.getSnapshot().user).toEqual(user);
});
it('empresa tardía de A no reaparece al cambiar a B o cerrar sesión', async () => {
  const { session, transport } = setup(); await login(session); const late = deferred<unknown>(); transport.mockReturnValueOnce(late.promise);
  const a = session.selectCompany(id); await session.selectCompany(other); late.resolve(full()); await a;
  expect(session.getSnapshot().company?.id).toBe(other);
  const lateB = deferred<unknown>(); transport.mockReturnValueOnce(lateB.promise);
  const b = session.selectCompany(other); await session.logout(); lateB.resolve(basic(other)); await b;
  expect(session.getSnapshot().company).toBeNull();
});
it('FULL a BASIC y foco reemplazan sin conservar fiscal; corrupción borra la vista', async () => {
  const { session, transport } = setup(); await login(session);
  transport.mockResolvedValueOnce(full()); await session.selectCompany(id); expect(session.getSnapshot().company?.representation).toBe('FULL');
  session.suspendContext(); expect(session.getSnapshot().company).toBeNull();
  await session.focus(); expect(session.getSnapshot().company).toEqual(basic());
  expect(session.getSnapshot().company).not.toHaveProperty('ruc');
  transport.mockResolvedValueOnce({ ...basic(), ruc: '1234567890123' }); await session.focus();
  expect(session.getSnapshot().company).toBeNull(); expect(session.getSnapshot().message).toContain('respuesta no válida');
});
it('empresa bloqueada limpia contexto, no identidad', async () => {
  const { session, transport } = setup(); await login(session); await session.selectCompany(id);
  transport.mockRejectedValueOnce(new ApiError(403, 'COMPANY_SUSPENDED')); await session.focus();
  expect(session.getSnapshot()).toMatchObject({ company: null, user, busy: false });
  expect(session.getSnapshot().message).toContain('suspendida');
});
it('paginación sigue cursor, reinicia inválido solo una vez y no mezcla páginas', async () => {
  const { session, transport } = setup(); await login(session);
  transport.mockResolvedValueOnce({ items: [row()], nextCursor: 'opaque' }); await session.loadCompanies();
  transport.mockResolvedValueOnce({ items: [row(other)], nextCursor: null }); await session.loadCompanies(true);
  expect(session.getSnapshot().companies).toHaveLength(2);
  expect(transport.mock.calls.some(([path]) => path === '/me/companies?cursor=opaque')).toBe(true);
  transport.mockRejectedValueOnce(new ApiError(400, 'INVALID_CURSOR')).mockRejectedValueOnce(new ApiError(400, 'INVALID_CURSOR'));
  const calls = transport.mock.calls.length; await session.loadCompanies();
  expect(transport.mock.calls.length - calls).toBe(2); expect(session.getSnapshot().companies).toEqual([]);
});
it('página tardía de sesión anterior no repuebla selector', async () => {
  const { session, transport } = setup(); await login(session); const late = deferred<unknown>(); transport.mockReturnValueOnce(late.promise);
  const pending = session.loadCompanies(); await session.logout(); late.resolve({ items: [row()], nextCursor: null }); await pending;
  expect(session.getSnapshot().companies).toEqual([]);
});
it('sin refresh o con refresh corrupto no llama rutas protegidas', async () => {
  const { session, storage, transport } = setup(); await session.restore(); expect(transport).not.toHaveBeenCalled();
  storage.read.mockResolvedValueOnce('invalid'); await session.restore();
  expect(session.getSnapshot().user).toBeNull(); expect(storage.clear).toHaveBeenCalled();
  expect(transport.mock.calls.some(([path]) => path === '/auth/refresh')).toBe(false);
});
it.each([-8 * 86400000, 8 * 86400000])('no usa reloj móvil desfasado %s como autoridad de vigencia', async offset => {
  const actual = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(actual + offset);
  try {
    const { session } = setup(); await login(session);
    expect(session.getSnapshot().user).toEqual(user);
  } finally { clock.mockRestore(); }
});
it('rechaza refresh que cambia el vencimiento absoluto recibido', async () => {
  const { session, transport, saved } = setup(); await login(session);
  transport.mockImplementation(async path => {
    if (path === '/auth/refresh') return { ...tokens('two'), refreshExpiresAt: new Date(Date.parse(fixtureExpiry) + 1000).toISOString() };
    if (path === '/auth/logout') return undefined;
    throw new ApiError(401, 'ACCESS_TOKEN_EXPIRED');
  });
  await expect(session.get('/auth/me')).rejects.toThrow();
  expect(session.getSnapshot().user).toBeNull(); expect(saved()).toBeNull();
});
it('segundo GET expirado después de renovar no entra en bucle', async () => {
  const { session, transport } = setup(); await login(session);
  transport.mockImplementation(async path => {
    if (path === '/auth/refresh') return tokens('two'); if (path === '/auth/logout') return undefined;
    throw new ApiError(401, 'ACCESS_TOKEN_EXPIRED');
  });
  await expect(session.get('/auth/me')).rejects.toThrow();
  expect(transport.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(1);
  expect(transport.mock.calls.filter(([path]) => path === '/auth/me')).toHaveLength(2);
  expect(session.getSnapshot().user).toBeNull();
});
it('refresh tardío tras logout revoca token histórico y también token rotado recibido', async () => {
  const { session, transport, saved } = setup(); await login(session); const late = deferred<unknown>();
  transport.mockImplementation(async path => {
    if (path === '/auth/refresh') return late.promise; if (path === '/auth/logout') return undefined;
    throw new ApiError(401, 'ACCESS_TOKEN_EXPIRED');
  });
  const get = session.get('/auth/me').catch(() => undefined);
  await new Promise(resolve => setTimeout(resolve, 0)); await session.logout(); late.resolve(tokens('two')); await get;
  expect(saved()).toBeNull(); expect(session.getSnapshot().user).toBeNull();
  const revoked = transport.mock.calls.filter(([path]) => path === '/auth/logout').map(([, options]) => (options?.body as { refreshToken: string }).refreshToken);
  expect(revoked).toEqual(expect.arrayContaining(['a'.repeat(43), 'b'.repeat(43)]));
});
it('fallo de borrado deja todo privado vacío y bloquea restauración hasta borrar explícitamente', async () => {
  const { session, storage, transport } = setup(); await login(session); storage.clear.mockRejectedValueOnce(new Error('fixture failure'));
  await session.logout(); expect(session.getSnapshot().user).toBeNull(); expect(session.getSnapshot().message).toContain('No se pudo borrar');
  const count = transport.mock.calls.length; await session.restore(); expect(transport.mock.calls).toHaveLength(count);
  await session.logout(); await login(session); expect(session.getSnapshot().user).toEqual(user);
});
it('error tardío de empresa A no borra contexto B ni dispara refresh', async () => {
  const { session, transport } = setup(); await login(session); const late = deferred<unknown>(); transport.mockReturnValueOnce(late.promise);
  const pending = session.selectCompany(id); await session.selectCompany(other);
  late.reject(new ApiError(403, 'COMPANY_SUSPENDED')); await pending;
  expect(session.getSnapshot().company?.id).toBe(other);
  expect(transport.mock.calls.filter(([path]) => path === '/auth/refresh')).toHaveLength(0);
});
it('cambio de foco no permite duplicar login pendiente', async () => {
  const { session, transport } = setup(); const late = deferred<unknown>(); transport.mockReturnValueOnce(late.promise);
  const pending = login(session); session.suspendContext(); await login(session); late.resolve(tokens()); await pending;
  expect(transport.mock.calls.filter(([path]) => path === '/auth/login')).toHaveLength(1);
});
it('respuesta de login anterior no borra ni reemplaza token del login nuevo', async () => {
  const { session, transport, saved } = setup(); const late = deferred<unknown>();
  transport.mockReturnValueOnce(late.promise);
  const first = login(session); await session.logout();
  transport.mockResolvedValueOnce(tokens('two')); await login(session);
  expect(saved()).toBe('b'.repeat(43));
  late.resolve(tokens()); await first;
  expect(saved()).toBe('b'.repeat(43)); expect(session.getSnapshot().user).toEqual(user);
});
