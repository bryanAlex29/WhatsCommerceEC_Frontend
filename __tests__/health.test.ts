import { checkHealth } from '../src/api/health';

// Simulaciones explícitas: no acreditan conexión con un backend real.
const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
  globalThis.fetch = fetchMock;
});
afterEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = originalFetch;
  delete process.env.EXPO_PUBLIC_API_URL;
  jest.useRealTimers();
});

it('valida el contrato y solicita únicamente health', async () => {
  const body = { status: 'ok', service: 'whatscommerceec-backend' };
  fetchMock.mockResolvedValue({ ok: true, json: async () => body });
  await expect(checkHealth()).resolves.toEqual(body);
  expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/health', expect.objectContaining({ method: 'GET', credentials: 'omit' }));
});
it('rechaza errores HTTP sin revelar su cuerpo', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 503 });
  await expect(checkHealth()).rejects.toThrow('HTTP 503');
});
it.each([null, {}, { status: 'ok', service: 'otro' }, { status: 'error', service: 'whatscommerceec-backend' }])('rechaza respuesta fuera del contrato: %p', async (body) => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => body });
  await expect(checkHealth()).rejects.toThrow('contrato');
});
it('rechaza JSON inválido', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new Error('simulado'); } });
  await expect(checkHealth()).rejects.toThrow('JSON válido');
});
it('maneja desconexión', async () => {
  fetchMock.mockRejectedValue(new Error('simulado'));
  await expect(checkHealth()).rejects.toThrow('No se pudo contactar');
});
it('no hace solicitudes sin configuración', async () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  await expect(checkHealth()).rejects.toThrow('Configura');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('limita el tiempo incluso si fetch no responde', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const result = expect(checkHealth(100)).rejects.toThrow('tiempo de espera');
  await jest.advanceTimersByTimeAsync(100);
  await result;
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});
