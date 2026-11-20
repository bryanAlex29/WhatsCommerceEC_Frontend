import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { StoreIllustration } from '../components/StoreIllustration';
import { colors } from '../theme';
import { useResponsiveLayout } from '../layout';

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const layout = useResponsiveLayout();
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content,
    { padding: layout.padding, paddingTop: layout.compact ? 16 : 32, gap: layout.compact ? 20 : 32 }]}>
    <View pointerEvents="none" accessible={false} style={styles.glow} />
    <View style={[styles.hero, { gap: layout.compact ? 16 : 28 }]}>
      <View style={[styles.brand, { maxWidth: layout.welcomeLogoWidth }]}>
        <Image source={require('../../assets/logo-monochrome.png')} resizeMode="contain" style={styles.logo}
          accessible accessibilityLabel="Logo oficial de WhatsCommerce EC" />
      </View>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, layout.compact && styles.compactTitle]}>Tu negocio,{ '\n' }más cerca.</Text>
        <Text style={styles.subtitle}>Automatiza tus ventas y la atención por WhatsApp</Text>
      </View>
      <StoreIllustration maxWidth={layout.illustrationWidth} />
    </View>
    <View style={styles.actions}><Button variant="light" onPress={onStart}>Comenzar</Button></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primaryDark },
  content: { flexGrow: 1, justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', width: 480, height: 480, borderRadius: 240, top: -220, left: -260, backgroundColor: colors.primary, opacity: 0.22 },
  hero: { width: '100%', maxWidth: 400, alignItems: 'center' },
  brand: { width: '100%', aspectRatio: 1.5 },
  logo: { width: '100%', height: '100%', tintColor: colors.background, opacity: 0.85 },
  copy: { width: '100%', gap: 16, alignItems: 'center' },
  title: { color: colors.background, fontSize: 36, lineHeight: 42, fontWeight: '800', textAlign: 'center' },
  compactTitle: { fontSize: 28, lineHeight: 34 },
  subtitle: { color: colors.background, fontSize: 20, lineHeight: 29, textAlign: 'center', maxWidth: 320 },
  actions: { width: '100%', maxWidth: 400, paddingBottom: 12 },
});
