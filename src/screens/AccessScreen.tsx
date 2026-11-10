import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Text, View } from 'react-native';
import { Session } from '../auth/session';
import { Button, Card, Field, Notice, ui } from '../components/ui';
import { PasswordRecoveryScreen } from './PasswordRecoveryScreen';

const statuses = { ACTIVE: 'Activa', SUSPENDED: 'Suspendida', PENDING_ACTIVATION: 'Pendiente de activación' };
export function AccessScreen({ session }: { session: Session }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [validation, setValidation] = useState('');
  const [recovering, setRecovering] = useState(false);
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') { setPassword(''); session.suspendContext(); }
      else if (appState.current !== 'active') void session.focus();
      appState.current = next;
    });
    return () => subscription.remove();
  }, [session]);
  function login() {
    if (!email.trim() || !password) { setValidation('Completa correo y contraseña.'); return; }
    if ([...password].length > 128) { setValidation('La contraseña supera el límite permitido.'); return; }
    setValidation(''); const submitted = password; const submittedEmail = email;
    setPassword(''); setEmail(''); void session.login(submittedEmail, submitted);
  }
  if (recovering && !state.user) return <PasswordRecoveryScreen onBack={completed => {
    if (completed) void session.logout('Contraseña actualizada. Inicia sesión nuevamente.');
    setRecovering(false);
  }} />;
  return <View style={{ gap: 20 }}>
    <Text accessibilityRole="header" style={ui.title}>{state.user ? 'Tu espacio de trabajo' : 'Iniciar sesión'}</Text>
    <Notice>{validation || state.message}</Notice>
    {state.busy && <Text accessibilityLiveRegion="polite" style={ui.text}>Operación en curso…</Text>}
    {!state.user ? <Card>
      <Field label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" maxLength={1024} editable={!state.busy} />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" editable={!state.busy} onSubmitEditing={login} />
      <Button disabled={state.busy} onPress={login}>Ingresar</Button>
      <Button disabled={state.busy} onPress={() => { setEmail(''); setPassword(''); setValidation(''); setRecovering(true); }}>¿Olvidaste tu contraseña?</Button>
      <Button disabled={state.busy} onPress={() => { setValidation(''); setPassword(''); setEmail(''); void session.restore(); }}>Restaurar sesión guardada</Button>
      <Text style={ui.text}>No hay registro público. El primer administrador se aprovisiona desde consola local autorizada. La aceptación de invitaciones tendrá su propia pantalla en una entrega posterior.</Text>
    </Card> : <>
      <Text style={ui.text}>{state.user.email}</Text>
      {state.user.platformRole === 'PLATFORM_ADMIN' && <Text style={ui.text}>Identidad de plataforma. La administración de empresas no forma parte de esta pantalla y no concede acceso comercial global.</Text>}
      {state.company ? <Card>
        <Text accessibilityRole="header" style={ui.title}>{state.company.tradeName}</Text>
        <Text style={ui.text}>Estado: {statuses[state.company.status]}</Text>
        <Text style={ui.text}>Vista {state.company.representation === 'BASIC' ? 'básica' : 'completa'} autorizada por servidor</Text>
        {state.company.representation === 'FULL' && <>
          <Text style={ui.text}>Razón social: {state.company.legalName}</Text><Text style={ui.text}>RUC: {state.company.ruc}</Text>
          <Text style={ui.text}>Dirección fiscal: {state.company.taxAddress}</Text><Text style={ui.text}>Correo de contacto: {state.company.contactEmail}</Text><Text style={ui.text}>Teléfono: {state.company.contactPhone}</Text>
        </>}
        <Button disabled={state.busy} onPress={() => { session.backToCompanies(); void session.loadCompanies(); }}>Cambiar empresa</Button>
        <Button disabled={state.busy} onPress={() => void session.focus()}>Revalidar empresa</Button>
      </Card> : <Card>
        <Text accessibilityRole="header" style={ui.title}>Selecciona una empresa</Text>
        {state.listLoaded && state.companies.length === 0 && <Text style={ui.text}>No tienes empresas vinculadas.</Text>}
        {state.companies.map(item => <View key={item.companyId} style={ui.stack}>
          <Text style={ui.text}>{item.tradeName} · {statuses[item.status]} · {item.role === 'COMPANY_ADMIN' ? 'Administrador' : 'Vendedor'}</Text>
          {item.status === 'ACTIVE' ? <Button disabled={state.busy} onPress={() => void session.selectCompany(item.companyId)}>{`Abrir ${item.tradeName}`}</Button> : <Text style={ui.text}>No disponible para operaciones empresariales.</Text>}
        </View>)}
        {state.nextCursor && <Button disabled={state.busy} onPress={() => void session.loadCompanies(true)}>Cargar más empresas</Button>}
        <Button disabled={state.busy} onPress={() => void session.loadCompanies()}>Actualizar empresas</Button>
      </Card>}
    </>}
    <Button onPress={() => { setPassword(''); setEmail(''); setValidation(''); void session.logout(); }}>Cerrar sesión y borrar acceso local</Button>
  </View>;
}
