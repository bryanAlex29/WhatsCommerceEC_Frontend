import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { PasswordRecovery, recoveryMessage } from '../auth/recovery';
import { passwordChecks } from '../auth/password-policy';
import { Button, Notice, TextAction, ui } from '../components/ui';
import { CredentialField } from '../components/CredentialField';
import { ScreenFrame } from '../components/ScreenFrame';
import { useResponsiveLayout } from '../layout';
import { colors } from '../theme';

type Routes = { RecoveryEmail: undefined; RecoveryCode: undefined; RecoveryPassword: undefined };
const Stack = createNativeStackNavigator<Routes>();
const Context = createContext<{ flow: PasswordRecovery; onBack: (completed: boolean) => void } | null>(null);
function useRecovery() {
  const context = useContext(Context); if (!context) throw new Error('RECOVERY_CONTEXT_REQUIRED');
  const state = useSyncExternalStore(context.flow.subscribe, context.flow.getSnapshot);
  return { ...context, state };
}
function StepIcon({ step }: { step: 'mail' | 'code' | 'lock' }) {
  const { compact } = useResponsiveLayout();
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.iconArea, { minHeight: compact ? 56 : 64 }]}>
    <View style={step === 'mail' ? styles.envelope : styles.lockBody}>
      {step === 'mail' ? <Text allowFontScaling={false} style={styles.iconGlyph}>@</Text> : step === 'code' ? <Text allowFontScaling={false} style={styles.iconGlyph}>•••</Text> : <View style={styles.keyhole} />}
    </View>
    {step === 'lock' && <View style={styles.shackle} />}
  </View>;
}
function useCountdown(retryAt: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}
function EmailRoute({ navigation }: NativeStackScreenProps<Routes, 'RecoveryEmail'>) {
  const { flow } = useRecovery(); const focused = useIsFocused();
  useFocusEffect(useCallback(() => { flow.returnToRequest(); }, [flow]));
  return <EmailForm key={focused ? 'focused' : 'blurred'} navigation={navigation} />;
}
function EmailForm({ navigation }: Pick<NativeStackScreenProps<Routes, 'RecoveryEmail'>, 'navigation'>) {
  const { flow, state, onBack } = useRecovery(); const [email, setEmail] = useState(flow.getEmail);
  const seconds = useCountdown(state.retryAt);
  useEffect(() => { const subscription = AppState.addEventListener('change', next => { if (next !== 'active') setEmail(''); }); return () => subscription.remove(); }, []);
  const send = async () => { await flow.request(email); if (flow.getSnapshot().stage === 'verify' && navigation.isFocused()) navigation.navigate('RecoveryCode'); };
  return <ScreenFrame underHeader dense>
    <StepIcon step="mail" />
    <Text style={styles.description}>Ingresa tu correo electrónico para solicitar un código de recuperación.</Text>
    <Notice>{state.message}</Notice>
    <CredentialField label="Correo registrado" placeholder="Tu correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address"
      autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={1024} editable={!state.busy} onSubmitEditing={() => void send()} />
    <Button variant="brand" disabled={state.busy || seconds > 0} onPress={() => void send()}>Enviar código</Button>
    {seconds > 0 && <Text style={styles.caption}>{`Puedes solicitar otro código en ${seconds} s.`}</Text>}
    <TextAction onPress={() => { flow.cancel(); onBack(false); }}>Volver al login</TextAction>
  </ScreenFrame>;
}
function CodeRoute({ navigation }: NativeStackScreenProps<Routes, 'RecoveryCode'>) {
  const { state } = useRecovery(); const focused = useIsFocused();
  useEffect(() => { if (focused && state.stage === 'request') navigation.popTo('RecoveryEmail'); }, [focused, navigation, state.stage]);
  return <CodeForm key={focused ? 'focused' : 'blurred'} navigation={navigation} />;
}
function CodeForm({ navigation }: Pick<NativeStackScreenProps<Routes, 'RecoveryCode'>, 'navigation'>) {
  const { flow, state } = useRecovery(); const [code, setCode] = useState('');
  const seconds = useCountdown(state.retryAt);
  const verify = async () => { const submitted = code; setCode(''); await flow.verify(submitted); if (flow.getSnapshot().stage === 'reset' && navigation.isFocused()) navigation.navigate('RecoveryPassword'); };
  return <ScreenFrame underHeader dense>
    <StepIcon step="code" />
    <Text style={styles.description}>Si el correo está registrado, recibirás un código de 8 dígitos en:</Text>
    <Text style={styles.email}>{flow.getEmail()}</Text>
    <Notice>{state.message === recoveryMessage ? '' : state.message}</Notice>
    {state.stage === 'reset' ? <><Text style={styles.caption}>Código verificado. Puedes continuar o solicitar uno nuevo.</Text><Button variant="brand" onPress={() => navigation.navigate('RecoveryPassword')}>Continuar con nueva contraseña</Button></> : <>
      <View style={styles.codeField}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.boxes}>
          {Array.from({ length: 8 }, (_, index) => <View key={index} style={styles.box}><Text style={styles.digit}>{code[index] || '·'}</Text></View>)}
        </View>
        <TextInput accessibilityLabel="Código de ocho dígitos" value={code} onChangeText={setCode} maxLength={8} keyboardType="number-pad"
          autoComplete="off" textContentType="none" autoCorrect={false} autoCapitalize="none" editable={!state.busy && state.canVerify}
          style={styles.codeInput} caretHidden onSubmitEditing={() => void verify()} />
      </View>
      <Button variant="brand" disabled={state.busy || !state.canVerify} onPress={() => void verify()}>Verificar código</Button>
    </>}
    <Text style={styles.caption}>Vence en 15 minutos desde su emisión. Máximo cinco intentos.</Text>
    <TextAction accessibilityLabel="Reenviar código" disabled={state.busy || seconds > 0} onPress={() => { setCode(''); void flow.request(flow.getEmail()); }}>{seconds > 0 ? `Reenviar en ${seconds} s` : 'Reenviar código'}</TextAction>
    <TextAction onPress={() => navigation.popTo('RecoveryEmail')}>Cambiar correo</TextAction>
  </ScreenFrame>;
}
function PasswordRoute({ navigation }: NativeStackScreenProps<Routes, 'RecoveryPassword'>) {
  const { state } = useRecovery(); const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    if (state.stage === 'request') navigation.popTo('RecoveryEmail');
    else if (state.stage === 'verify') navigation.popTo('RecoveryCode');
  }, [focused, navigation, state.stage]);
  return <PasswordForm key={focused ? 'focused' : 'blurred'} />;
}
function PasswordForm() {
  const { flow, state, onBack } = useRecovery();
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [shown, setShown] = useState(false); const [confirmationShown, setConfirmationShown] = useState(false);
  const checks = passwordChecks(password);
  const submit = async () => { const submitted = password; const confirmed = confirmation; setPassword(''); setConfirmation(''); setShown(false); setConfirmationShown(false); await flow.reset(submitted, confirmed); };
  return <ScreenFrame underHeader dense>
    <StepIcon step="lock" />
    <Text style={styles.description}>Crea una nueva contraseña para tu cuenta.</Text>
    <Notice>{state.message}</Notice>
    {state.stage === 'reset' && <>
      <CredentialField label="Nueva contraseña" password revealed={shown} onToggle={() => setShown(value => !value)} value={password} onChangeText={setPassword}
        autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" editable={!state.busy} />
      <CredentialField label="Confirmar nueva contraseña" password revealed={confirmationShown} onToggle={() => setConfirmationShown(value => !value)} value={confirmation} onChangeText={setConfirmation}
        autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" editable={!state.busy} onSubmitEditing={() => void submit()} />
      <View style={ui.stack}>{([
        ['length', '8–128 caracteres'], ['uppercase', 'Una letra mayúscula'], ['symbol', 'Un símbolo'], ['spacing', 'Sin espacios ni caracteres invisibles'],
      ] as const).map(([key, text]) => <Text key={key} style={styles.requirement}>{`${password && checks[key] ? '✓' : '○'} ${text}`}</Text>)}</View>
      <Text style={styles.caption}>Los números son opcionales.</Text>
      <Button variant="brand" disabled={state.busy} onPress={() => void submit()}>Cambiar contraseña</Button>
    </>}
    {(state.stage === 'done' || state.stage === 'uncertain') && <TextAction onPress={() => onBack(state.stage === 'done')}>Volver al login</TextAction>}
  </ScreenFrame>;
}
export function PasswordRecoveryScreen({ onBack }: { onBack: (completed: boolean) => void }) {
  const [flow] = useState(() => new PasswordRecovery());
  const [backFocused, setBackFocused] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') flow.cancel(); });
    return () => { subscription.remove(); flow.dispose(); };
  }, [flow]);
  return <Context.Provider value={{ flow, onBack }}><Stack.Navigator screenOptions={{ gestureEnabled: true, headerShadowVisible: false, headerStyle: { backgroundColor: colors.primaryDark },
    headerTintColor: colors.background, headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', statusBarStyle: 'light', contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="RecoveryEmail" component={EmailRoute} options={{ title: 'Recuperar contraseña', headerLeft: () =>
      <Pressable accessibilityRole="button" accessibilityLabel="Retroceder al login" onFocus={() => setBackFocused(true)} onBlur={() => setBackFocused(false)}
        style={({ pressed }) => [styles.headerBack, (pressed || backFocused) && styles.headerBackFocus]} onPress={() => { flow.cancel(); onBack(false); }}>
        <Text allowFontScaling={false} style={styles.headerArrow}>‹</Text>
      </Pressable> }} />
    <Stack.Screen name="RecoveryCode" component={CodeRoute} options={{ title: 'Verificar código' }} />
    <Stack.Screen name="RecoveryPassword" component={PasswordRoute} options={{ title: 'Nueva contraseña' }} />
  </Stack.Navigator></Context.Provider>;
}
const styles = StyleSheet.create({
  headerBack: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primaryDark, borderRadius: 8 },
  headerBackFocus: { borderColor: colors.accent },
  headerArrow: { color: colors.background, fontSize: 32 },
  description: { color: colors.text, textAlign: 'center', fontSize: 16, lineHeight: 23 },
  caption: { color: colors.text, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  email: { color: colors.text, fontWeight: '700', textAlign: 'center', fontSize: 16 },
  iconArea: { alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  envelope: { width: 54, height: 38, borderWidth: 2, borderColor: colors.primary, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  lockBody: { width: 48, height: 42, borderWidth: 2, borderColor: colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { color: colors.primaryDark, fontSize: 22, fontWeight: '700' },
  keyhole: { width: 7, height: 15, borderRadius: 4, backgroundColor: colors.primaryDark },
  shackle: { position: 'absolute', width: 24, height: 24, top: 0, borderColor: colors.primary, borderWidth: 2, borderRadius: 14 },
  codeField: { minHeight: 52 }, boxes: { flexDirection: 'row', gap: 4 },
  box: { flex: 1, minWidth: 0, minHeight: 52, borderWidth: 1, borderColor: colors.primaryDark, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  digit: { color: colors.text, fontSize: 20, fontWeight: '700' },
  codeInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0.01, color: colors.text, fontSize: 16 },
  requirement: { color: colors.primaryDark, fontSize: 14, lineHeight: 21 },
});
