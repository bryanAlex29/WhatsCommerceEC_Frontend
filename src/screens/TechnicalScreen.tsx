import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { checkHealth, HealthCheckError } from '../api/health';
import { getApiUrl } from '../config/env';
import { Button, Card, ui } from '../components/ui';
export function TechnicalScreen() {
  const [message, setMessage] = useState('Backend sin comprobar.'); const [busy, setBusy] = useState(false); const pending = useRef(false);
  let apiUrl = 'Configuración pública ausente o inválida';
  try { apiUrl = getApiUrl(); } catch { /* No reflejar valores inválidos o credenciales. */ }
  async function check() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('Comprobando backend…');
    try { await checkHealth(); setMessage('Backend disponible en la última comprobación.'); }
    catch (error) {
      if (!(error instanceof HealthCheckError)) setMessage('No se pudo comprobar el backend. Revisa la conexión y la configuración pública.');
      else if (error.code === 'NETWORK') setMessage('Expo Go no pudo conectar con la API. Si esta URL abre en el navegador del teléfono, comprueba el permiso de red local de Expo Go y vuelve a abrir el proyecto actual.');
      else if (error.code === 'TIMEOUT') setMessage('La comprobación agotó el tiempo de espera. Comprueba la conexión del teléfono y que la API esté activa.');
      else if (error.code === 'CONFIGURATION') setMessage('La URL pública de la API no está configurada correctamente. Reinicia Expo después de corregirla.');
      else if (error.code === 'HTTP') setMessage(error.message);
      else setMessage('La API respondió, pero no con el JSON esperado de WhatsCommerce EC. Comprueba la URL configurada.');
    }
    finally { pending.current = false; setBusy(false); }
  }
  return <Card><Text accessibilityRole="header" style={ui.title}>Área técnica pública</Text><Text style={ui.text}>Health no requiere sesión ni garantiza conexión a la base de datos. Solo se comprueba al pulsar.</Text><Text selectable style={ui.text}>{`API configurada: ${apiUrl}`}</Text><Text accessibilityLiveRegion="polite" style={ui.text}>{message}</Text><Button disabled={busy} onPress={() => void check()}>Comprobar backend</Button></Card>;
}
