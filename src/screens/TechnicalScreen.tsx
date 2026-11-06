import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { checkHealth } from '../api/health';
import { Button, Card, ui } from '../components/ui';
export function TechnicalScreen() {
  const [message, setMessage] = useState('Backend sin comprobar.'); const [busy, setBusy] = useState(false); const pending = useRef(false);
  async function check() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('Comprobando backend…');
    try { await checkHealth(); setMessage('Backend disponible en la última comprobación.'); }
    catch { setMessage('No se pudo comprobar el backend. Revisa la conexión y la configuración pública.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Card><Text accessibilityRole="header" style={ui.title}>Área técnica pública</Text><Text style={ui.text}>Health no requiere sesión ni garantiza conexión a la base de datos. Solo se comprueba al pulsar.</Text><Text accessibilityLiveRegion="polite" style={ui.text}>{message}</Text><Button disabled={busy} onPress={() => void check()}>Comprobar backend</Button></Card>;
}
