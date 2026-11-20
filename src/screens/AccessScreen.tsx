import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Image, StyleSheet, Text, View } from 'react-native';
import { Session } from '../auth/session';
import { Button, Card, Notice, TextAction, ui } from '../components/ui';
import { CredentialField } from '../components/CredentialField';
import { colors } from '../theme';
import { useResponsiveLayout } from '../layout';
import logoDimensions from '../../assets/logo-monochrome-compact.json';

const statuses = { ACTIVE: 'Activa', SUSPENDED: 'Suspendida', PENDING_ACTIVATION: 'Pendiente de activación' };
const loginLogo = require('../../assets/logo-monochrome-compact.png');
const logoAspectRatio = logoDimensions.width / logoDimensions.height;
export function AccessScreen({ session, onRecover, manageLifecycle = true, view = 'auto', onSelectCompany, onBackCompany }: {
  session: Session; onRecover?: () => void; manageLifecycle?: boolean;
  view?: 'auto' | 'list' | 'company'; onSelectCompany?: (id: string) => void; onBackCompany?: () => void;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const layout = useResponsiveLayout();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [validation, setValidation] = useState('');
  const [revealed, setRevealed] = useState(false);
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') { setPassword(''); setRevealed(false); if (manageLifecycle) session.suspendContext(); }
      else if (manageLifecycle && appState.current !== 'active') void session.focus();
      appState.current = next;
    });
    return () => subscription.remove();
  }, [session, manageLifecycle]);
  function login() {
    if (!email.trim() || !password) { setValidation('Completa correo y contraseña.'); return; }
    if ([...password].length > 128) { setValidation('La contraseña supera el límite permitido.'); return; }
    setValidation(''); const submitted = password; const submittedEmail = email;
    setPassword(''); setEmail(''); setRevealed(false); void session.login(submittedEmail, submitted);
  }
  if (!state.user) return <View style={[styles.login, { gap: layout.loginGap }]}>
    <View style={styles.brand}><Image source={loginLogo} resizeMode="contain" style={[styles.logo,
      { width: layout.logoWidth, height: layout.logoWidth / logoAspectRatio }]}
      accessible accessibilityLabel="Logo oficial de WhatsCommerce EC" /></View>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.title, layout.compact && styles.compactTitle]}>Iniciar sesión</Text>
      <Text style={styles.subtitle}>Ingresa con las credenciales de tu administrador.</Text>
    </View>
    <Notice>{validation || state.message}</Notice>
    {state.busy && <Text accessibilityLiveRegion="polite" style={ui.text}>Operación en curso…</Text>}
    <View style={[styles.form, { gap: layout.loginControlGap }]}>
      <CredentialField label="Correo electrónico" value={email} onChangeText={setEmail} placeholder="Tu correo electrónico"
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" maxLength={1024} editable={!state.busy} />
      <CredentialField label="Contraseña" value={password} onChangeText={setPassword} password revealed={revealed} onToggle={() => setRevealed(value => !value)}
        placeholder="Tu contraseña" autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" editable={!state.busy} onSubmitEditing={login} returnKeyType="go" />
      {onRecover && <TextAction disabled={state.busy} onPress={() => { setEmail(''); setPassword(''); setValidation(''); setRevealed(false); onRecover(); }}>¿Olvidaste tu contraseña?</TextAction>}
      <Button variant="brand" disabled={state.busy} onPress={login}>Ingresar</Button>
    </View>
    {state.message && <TextAction disabled={state.busy} onPress={() => void session.logout()}>Borrar acceso local anterior</TextAction>}
  </View>;
  return <View style={{ gap: layout.gap }}>
    <Text accessibilityRole="header" style={ui.title}>Tu espacio de trabajo</Text>
    <Notice>{validation || state.message}</Notice>
    {state.busy && <Text accessibilityLiveRegion="polite" style={ui.text}>Operación en curso…</Text>}
      <Text style={ui.text}>{state.user.email}</Text>
      {state.user.platformRole === 'PLATFORM_ADMIN' && <Text style={ui.text}>Identidad de plataforma. La administración de empresas no forma parte de esta pantalla y no concede acceso comercial global.</Text>}
      {state.company && view !== 'list' ? <Card>
        <Text accessibilityRole="header" style={ui.title}>{state.company.tradeName}</Text>
        <Text style={ui.text}>Estado: {statuses[state.company.status]}</Text>
        <Text style={ui.text}>Vista {state.company.representation === 'BASIC' ? 'básica' : 'completa'} autorizada por servidor</Text>
        {state.company.representation === 'FULL' && <>
          <Text style={ui.text}>Razón social: {state.company.legalName}</Text><Text style={ui.text}>RUC: {state.company.ruc}</Text>
          <Text style={ui.text}>Dirección fiscal: {state.company.taxAddress}</Text><Text style={ui.text}>Correo de contacto: {state.company.contactEmail}</Text><Text style={ui.text}>Teléfono: {state.company.contactPhone}</Text>
        </>}
        <Button disabled={state.busy} onPress={() => { if (onBackCompany) onBackCompany(); else { session.backToCompanies(); void session.loadCompanies(); } }}>Cambiar empresa</Button>
        <Button disabled={state.busy} onPress={() => void session.focus()}>Revalidar empresa</Button>
      </Card> : view === 'company' ? <Card><Text style={ui.text}>El contexto empresarial no está disponible. Revalida la empresa o vuelve a la selección.</Text>
        <Button disabled={state.busy} onPress={() => void session.focus()}>Revalidar empresa</Button>
        <Button onPress={() => onBackCompany?.()}>Volver a empresas</Button>
      </Card> : <Card>
        <Text accessibilityRole="header" style={ui.title}>Selecciona una empresa</Text>
        {state.listLoaded && state.companies.length === 0 && <Text style={ui.text}>No tienes empresas vinculadas.</Text>}
        {state.companies.map(item => <View key={item.companyId} style={ui.stack}>
          <Text style={ui.text}>{item.tradeName} · {statuses[item.status]} · {item.role === 'COMPANY_ADMIN' ? 'Administrador' : 'Vendedor'}</Text>
          {item.status === 'ACTIVE' ? <Button disabled={state.busy} onPress={() => { if (onSelectCompany) onSelectCompany(item.companyId); else void session.selectCompany(item.companyId); }}>{`Abrir ${item.tradeName}`}</Button> : <Text style={ui.text}>No disponible para operaciones empresariales.</Text>}
        </View>)}
        {state.nextCursor && <Button disabled={state.busy} onPress={() => void session.loadCompanies(true)}>Cargar más empresas</Button>}
        <Button disabled={state.busy} onPress={() => void session.loadCompanies()}>Actualizar empresas</Button>
      </Card>}
    <Button onPress={() => { setPassword(''); setEmail(''); setValidation(''); void session.logout(); }}>Cerrar sesión y borrar acceso local</Button>
  </View>;
}
const styles = StyleSheet.create({
  login: { width: '100%' },
  brand: { alignItems: 'center' }, logo: { maxWidth: '100%', tintColor: colors.primaryDark },
  heading: { alignItems: 'center', gap: 6 },
  title: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  compactTitle: { fontSize: 24, lineHeight: 30 },
  subtitle: { color: colors.text, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 300 },
  form: { width: '100%' },
});
