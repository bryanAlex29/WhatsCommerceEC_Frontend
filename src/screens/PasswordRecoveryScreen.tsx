import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Text, View } from 'react-native';
import { PasswordRecovery } from '../auth/recovery';
import { Button, Card, Field, Notice, ui } from '../components/ui';

export function PasswordRecoveryScreen({ onBack }: { onBack: (completed: boolean) => void }) {
  const [flow] = useState(() => new PasswordRecovery());
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot);
  const [email, setEmail] = useState(''); const [code, setCode] = useState('');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') { setCode(''); setPassword(''); setConfirmation(''); flow.cancel(); }
    });
    return () => { subscription.remove(); flow.dispose(); };
  }, [flow]);
  const submit = () => {
    const submittedPassword = password; const submittedConfirmation = confirmation; const submittedCode = code;
    setPassword(''); setConfirmation(''); setCode('');
    void flow.reset(email, submittedCode, submittedPassword, submittedConfirmation);
  };
  return <View style={ui.stack}>
    <Text accessibilityRole="header" style={ui.title}>Recuperar contraseña</Text>
    <Notice>{state.message}</Notice>
    {state.busy && <Text accessibilityLiveRegion="polite" style={ui.text}>Operación en curso…</Text>}
    {state.stage !== 'done' && <Card>
      <Field label="Correo registrado" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" maxLength={1024} editable={!state.busy && state.stage === 'request'} />
      {state.stage === 'request' ? <Button disabled={state.busy} onPress={() => void flow.request(email)}>Solicitar código</Button> : <>
        <Text style={ui.text}>Introduce el código más reciente. Puedes solicitar otro después de 60 segundos; el anterior dejará de funcionar. Máximo tres solicitudes por hora.</Text>
        <Field label="Código de ocho dígitos" value={code} onChangeText={setCode} keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" maxLength={8} editable={!state.busy} />
        <Text style={ui.text}>Nueva contraseña: 15–128 caracteres, una mayúscula y un símbolo, sin espacios. Los números son opcionales.</Text>
        <Field label="Nueva contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" editable={!state.busy} />
        <Field label="Confirmar nueva contraseña" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" editable={!state.busy} onSubmitEditing={submit} />
        <Button disabled={state.busy} onPress={submit}>Cambiar contraseña</Button>
        <Button disabled={state.busy} onPress={() => { setCode(''); setPassword(''); setConfirmation(''); void flow.request(email); }}>Solicitar otro código</Button>
      </>}
    </Card>}
    <Button onPress={() => { setCode(''); setPassword(''); setConfirmation(''); setEmail(''); flow.cancel(); onBack(state.stage === 'done'); }}>Volver al login</Button>
  </View>;
}
