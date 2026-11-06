import { ApiError, request } from '../src/api/client';
// Fetch simulado; no integración HTTP real ni cuentas.
const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => { globalThis.fetch = fetchMock; process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000'; fetchMock.mockReset(); });
afterAll(() => { globalThis.fetch = originalFetch; if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = originalUrl; });
it('centraliza /api, auth en cabecera, token refresh en body, sin cookies', async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ fixture: true }) });
  await request('/auth/me', { access: 'synthetic-access' });
  expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/auth/me', expect.objectContaining({ credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-access' } }));
});
it('no reintenta POST ni muestra errores privados', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { code: 'INVALID_CREDENTIALS', message: 'private fixture' } }) });
  await expect(request('/auth/login', { method: 'POST', body: { email: 'fixture@example.test', password: 'synthetic' } })).rejects.toThrow('Credenciales inválidas');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('código desconocido y errores de red se sanitizan', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: 'SQL_PRIVATE', message: 'private fixture' } }) });
  await expect(request('/auth/me')).rejects.toEqual(new ApiError(500, ''));
  fetchMock.mockRejectedValueOnce(new Error('private fixture'));
  await expect(request('/auth/me')).rejects.toThrow('No se pudo conectar');
});
it('logout requiere 204 y no lee JSON de éxito', async () => {
  const json = jest.fn(); fetchMock.mockResolvedValue({ ok: true, status: 204, json });
  await request('/auth/logout', { method: 'POST', body: { refreshToken: 'a'.repeat(43) } }); expect(json).not.toHaveBeenCalled();
});
