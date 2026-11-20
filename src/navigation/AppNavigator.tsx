import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DefaultTheme, NavigationContainer, useFocusEffect, useIsFocused, usePreventRemove, type NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Session } from '../auth/session';
import { TextAction } from '../components/ui';
import { AccessScreen } from '../screens/AccessScreen';
import { PasswordRecoveryScreen } from '../screens/PasswordRecoveryScreen';
import { TechnicalScreen } from '../screens/TechnicalScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { colors } from '../theme';
import { ScreenFrame as Frame } from '../components/ScreenFrame';

// Never pass credentials, account/company records or invitation codes as route params.
export type Routes = { Welcome: undefined; Login: undefined; Recovery: undefined; Workspace: undefined; Company: undefined; Diagnostics: undefined };
const Stack = createNativeStackNavigator<Routes>();
const Context = createContext<{ session: Session; begin: () => void } | null>(null);
function useSession() { const value = useContext(Context); if (!value) throw new Error('SESSION_CONTEXT_REQUIRED'); return value; }
const theme = { ...DefaultTheme, colors: { primary: colors.primary, background: colors.primaryDark, card: colors.background,
  text: colors.text, border: colors.primaryDark, notification: colors.accent } };

function Welcome({ navigation }: NativeStackScreenProps<Routes, 'Welcome'>) {
  const { begin } = useSession();
  return <SafeAreaView style={styles.safe}><WelcomeScreen onStart={() => { begin(); navigation.navigate('Login'); }} /></SafeAreaView>;
}
function Login({ navigation }: NativeStackScreenProps<Routes, 'Login'>) {
  const { session } = useSession(); const state = useSyncExternalStore(session.subscribe, session.getSnapshot); const active = useIsFocused();
  // Avoid abandoning an in-flight sign-in; allow the auth branch to replace it on success.
  usePreventRemove(state.busy && !state.user, () => {});
  return <Frame login>
    <AccessScreen key={active ? 'focused' : 'blurred'} session={session} manageLifecycle={false} onRecover={() => navigation.navigate('Recovery')} />
    <View style={styles.loginFooter}>
      <View style={styles.footerItem}><TextAction disabled={state.busy} onPress={() => navigation.navigate('Diagnostics')}>Comprobar conexión</TextAction></View>
      {navigation.canGoBack() && <View style={styles.footerItem}><TextAction disabled={state.busy} onPress={() => navigation.goBack()}>Volver a bienvenida</TextAction></View>}
    </View>
  </Frame>;
}
function Recovery({ navigation }: NativeStackScreenProps<Routes, 'Recovery'>) {
  const { session } = useSession();
  return <PasswordRecoveryScreen onBack={completed => {
    if (completed) void session.logout('Contraseña actualizada. Inicia sesión nuevamente.');
    navigation.goBack();
  }} />;
}
function Workspace({ navigation }: NativeStackScreenProps<Routes, 'Workspace'>) {
  const { session } = useSession();
  return <Frame>
    <AccessScreen session={session} manageLifecycle={false} view="list" onSelectCompany={id => {
      void session.selectCompany(id).then(() => { if (session.getSnapshot().company?.id === id && navigation.isFocused()) navigation.navigate('Company'); });
    }} />
    <TextAction onPress={() => navigation.navigate('Diagnostics')}>Comprobar conexión</TextAction>
  </Frame>;
}
function Company({ navigation }: NativeStackScreenProps<Routes, 'Company'>) {
  const { session } = useSession();
  useFocusEffect(useCallback(() => () => { if (session.getSnapshot().user) session.backToCompanies(); }, [session]));
  return <Frame onBack={() => navigation.goBack()} backLabel="Volver a empresas">
    <AccessScreen session={session} manageLifecycle={false} view="company" onBackCompany={() => navigation.goBack()} />
  </Frame>;
}
function Diagnostics({ navigation }: NativeStackScreenProps<Routes, 'Diagnostics'>) {
  return <Frame onBack={() => navigation.goBack()}><TechnicalScreen /></Frame>;
}
export function AppNavigator({ session, navigationRef }: { session: Session; navigationRef?: NavigationContainerRefWithCurrent<Routes> }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let current = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') session.suspendContext();
      else if (current !== 'active') void session.focus();
      current = next;
    });
    return () => subscription.remove();
  }, [session]);
  return <Context.Provider value={{ session, begin: () => setEntered(true) }}>
    <NavigationContainer ref={navigationRef} theme={theme}>
      <Stack.Navigator key={state.user ? `authenticated-${state.user.id}` : 'guest'}
        initialRouteName={state.user ? 'Workspace' : entered ? 'Login' : 'Welcome'} screenOptions={{ headerShown: false, gestureEnabled: true,
        contentStyle: { backgroundColor: colors.primaryDark }, statusBarStyle: 'light' }}>
        {state.user ? <Stack.Group navigationKey={`authenticated-${state.user.id}`}>
          <Stack.Screen name="Workspace" component={Workspace} />
          <Stack.Screen name="Company" component={Company} />
          <Stack.Screen name="Diagnostics" component={Diagnostics} />
        </Stack.Group> : <Stack.Group navigationKey="guest">
          <Stack.Screen name="Welcome" component={Welcome} />
          <Stack.Screen name="Login" component={Login} options={{ gestureEnabled: !state.busy }} />
          <Stack.Screen name="Recovery" component={Recovery} />
          <Stack.Screen name="Diagnostics" component={Diagnostics} />
        </Stack.Group>}
      </Stack.Navigator>
    </NavigationContainer>
  </Context.Provider>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark },
  loginFooter: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  footerItem: { flex: 1, minWidth: 0 },
});
