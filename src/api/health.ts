import { getApiUrl } from '../config/env';

export interface HealthResponse {
  status: 'ok';
  service: 'whatscommerceec-backend';
}

export async function checkHealth(timeoutMs = 5000): Promise<HealthResponse> {
  const baseUrl = getApiUrl();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('La comprobación agotó el tiempo de espera.'));
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
      throw new Error('No se pudo contactar con el backend. Revisa la red y la URL.');
    }
    if (!response.ok) throw new Error(`El backend devolvió HTTP ${response.status}.`);
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error('El backend no devolvió un JSON válido.');
    }
    if (typeof data !== 'object' || data === null || !('status' in data) ||
        !('service' in data) || data.status !== 'ok' || data.service !== 'whatscommerceec-backend') {
      throw new Error('La respuesta no coincide con el contrato health.');
    }
    return { status: data.status, service: data.service };
  };
  try {
    return await Promise.race([request(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
