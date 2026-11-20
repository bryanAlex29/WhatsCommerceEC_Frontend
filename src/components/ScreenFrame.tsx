import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../layout';
import { colors } from '../theme';
import { TextAction } from './ui';

export function ScreenFrame({ children, onBack, backLabel = 'Volver', disabled = false, login = false, dense = false, underHeader = false }: {
  children: ReactNode; onBack?: () => void; backLabel?: string; disabled?: boolean; login?: boolean; dense?: boolean; underHeader?: boolean;
}) {
  const layout = useResponsiveLayout();
  return <SafeAreaView style={styles.safe} edges={underHeader ? ['left', 'right', 'bottom'] : undefined}>
    <KeyboardAvoidingView style={styles.surface} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.content,
        { padding: layout.padding, paddingTop: layout.compact ? 4 : 8, paddingBottom: login || dense ? 12 : layout.padding,
          gap: login || dense ? layout.loginGap : layout.gap, maxWidth: layout.contentWidth }]}>
        {onBack && <TextAction onPress={onBack} disabled={disabled}>{backLabel}</TextAction>}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark },
  surface: { flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  content: { flexGrow: 1, width: '100%', alignSelf: 'center' },
});
