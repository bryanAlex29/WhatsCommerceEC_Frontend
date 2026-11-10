import { getApiUrl } from '../config/env';
const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Credenciales inválidas.', ACCESS_TOKEN_EXPIRED: 'La sesión necesita renovarse.',
  UNAUTHENTICATED: 'Inicia sesión nuevamente.', SESSION_EXPIRED: 'La sesión venció. Inicia sesión nuevamente.',
  SESSION_REVOKED: 'La sesión fue revocada. Inicia sesión nuevamente.', INVALID_REFRESH_TOKEN: 'Inicia sesión nuevamente.',
  FORBIDDEN: 'No tienes permiso para esta operación.', COMPANY_SUSPENDED: 'La empresa está suspendida.',
  COMPANY_PENDING_ACTIVATION: 'La empresa está pendiente de activación.', RESOURCE_NOT_FOUND: 'Recurso no disponible.',
  INVALID_CURSOR: 'El listado cambió. Vuelve a cargarlo.', RATE_LIMITED: 'Demasiados intentos. Espera antes de volver a intentar.',
  SERVICE_TEMPORARILY_UNAVAILABLE: 'Servicio temporalmente no disponible.',
  INVALID_RECOVERY_CODE: 'Código inválido o vencido. Solicita uno nuevo si ya agotaste los cinco intentos.',
  VALIDATION_ERROR: 'Revisa el correo, el código y las reglas de la contraseña.',
};
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(messages[code] ?? 'No se pudo completar la solicitud.'); }
}
export class NetworkError extends Error { constructor() { super('No se pudo conectar con la API. Comprueba tu conexión y la configuración pública.'); } }
export type Transport = (path: string, options?: { method?: 'GET' | 'POST'; body?: unknown; access?: string; signal?: AbortSignal }) => Promise<unknown>;
export const request: Transport = async (path, options = {}) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(`${getApiUrl()}/api${path}`, {
      method: options.method ?? 'GET', signal: controller.signal, cache: 'no-store', credentials: 'omit',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.access ? { Authorization: `Bearer ${options.access}` } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    if (!response.ok) {
      let code = '';
      try { const body: unknown = await response.json(); const candidate = (body as { error?: { code?: unknown } } | null)?.error?.code; if (typeof candidate === 'string' && Object.hasOwn(messages, candidate)) code = candidate; } catch { /* No mostrar mensajes remotos. */ }
      throw new ApiError(response.status, code);
    }
    if (path === '/auth/logout' || path === '/auth/password-recovery/reset') { if (response.status !== 204) throw new ApiError(0, ''); return undefined; }
    if (response.status !== (path === '/auth/password-recovery/request' ? 202 : 200)) throw new ApiError(0, '');
    try { return await response.json(); } catch { throw new ApiError(0, ''); }
  } catch (error) { if (error instanceof ApiError) throw error; throw new NetworkError(); }
  finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
};
