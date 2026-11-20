import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { Session } from './src/auth/session';
import { secureStorage } from './src/auth/secureStorage';
import { AppNavigator, type Routes } from './src/navigation/AppNavigator';
export default function App({ session, navigationRef }: { session?: Session; navigationRef?: NavigationContainerRefWithCurrent<Routes> }) {
  const [client] = useState(() => session ?? new Session(secureStorage));
  return <SafeAreaProvider><AppNavigator session={client} navigationRef={navigationRef} /></SafeAreaProvider>;
}
