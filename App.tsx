import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Session } from './src/auth/session';
import { secureStorage } from './src/auth/secureStorage';
import { AccessScreen } from './src/screens/AccessScreen';
import { TechnicalScreen } from './src/screens/TechnicalScreen';
import { colors } from './src/theme';
const session = new Session(secureStorage);
export default function App() {
  const [client] = useState(session);
  return <SafeAreaProvider><SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" />
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Image source={require('./assets/logo.png')} resizeMode="contain" style={styles.logo} accessible accessibilityLabel="Logo oficial de WhatsCommerce EC" />
        <AccessScreen session={client} /><TechnicalScreen />
        <Text style={styles.note}>Nunca compartas tus credenciales. Los permisos y datos vigentes se comprueban en el servidor.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, padding: 24, gap: 24, width: '100%', maxWidth: 600, alignSelf: 'center' }, logo: { width: '100%', height: 200 }, note: { color: colors.text, fontSize: 14, lineHeight: 21 } });
