export function parseApiUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error('Configura EXPO_PUBLIC_API_URL para comprobar el backend.');
  }
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || url.pathname !== '/') {
      throw new Error('URL inválida');
    }
    return url.origin;
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL debe ser una URL HTTP(S) base, sin credenciales, rutas ni parámetros.');
  }
}

export function getApiUrl(): string {
  // Expo requiere acceso estático para incluir esta variable pública en el bundle.
  return parseApiUrl(process.env.EXPO_PUBLIC_API_URL);
}
