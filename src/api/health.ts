import { getApiUrl } from '../config/env';

export interface HealthResponse {
  status: 'ok';
  service: 'whatscommerceec-backend';
}

export class HealthCheckError extends Error {
  constructor(readonly code: 'CONFIGURATION' | 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'RESPONSE', message: string) {
    super(message);
  }
}

export async function checkHealth(timeoutMs = 5000): Promise<HealthResponse> {
  let baseUrl: string;
  try { baseUrl = getApiUrl(); }
  catch { throw new HealthCheckError('CONFIGURATION', 'Configura EXPO_PUBLIC_API_URL con una URL HTTP(S) pública válida, sin credenciales.'); }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new HealthCheckError('TIMEOUT', 'La comprobación agotó el tiempo de espera.'));
      controller.abort();
    }, timeoutMs);
  });
  const request = async (): Promise<HealthResponse> => {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch {
      throw new HealthCheckError('NETWORK', 'No se pudo contactar con el backend. Revisa la red y la URL.');
    }
    if (!response.ok) {
      const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : 0;
      throw new HealthCheckError('HTTP', `El backend devolvió HTTP ${status}.`);
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new HealthCheckError('RESPONSE', 'El backend no devolvió un JSON válido.');
    }
    if (typeof data !== 'object' || data === null || !('status' in data) ||
        !('service' in data) || data.status !== 'ok' || data.service !== 'whatscommerceec-backend') {
      throw new HealthCheckError('RESPONSE', 'La respuesta no coincide con el contrato health.');
    }
    return { status: data.status, service: data.service };
  };
  try {
    return await Promise.race([request(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
