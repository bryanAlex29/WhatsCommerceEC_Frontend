import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../theme';

export function Button({ children, onPress, disabled = false }: { children: string; onPress: () => void; disabled?: boolean }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [ui.button, (focused || pressed) && ui.focus, disabled && ui.disabled]}><Text style={ui.buttonText}>{children}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={ui.stack}><Text style={ui.text}>{label}</Text><TextInput {...props} accessibilityLabel={label} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[ui.input, focused && ui.inputFocus]} /></View>;
}
export function Card({ children }: { children: ReactNode }) { return <View style={ui.card}>{children}</View>; }
export function Notice({ children }: { children: string }) { return children ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.text}>ⓘ {children}</Text> : null; }
export const ui = StyleSheet.create({
  stack: { gap: 8 }, card: { padding: 20, gap: 16, borderWidth: 2, borderColor: colors.primary, borderRadius: 12 },
  text: { color: colors.text, fontSize: 16, lineHeight: 24 }, title: { color: colors.primaryDark, fontSize: 26, fontWeight: '700' },
  button: { minHeight: 48, borderWidth: 3, borderColor: colors.primaryDark, padding: 12, backgroundColor: colors.primaryDark, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '600' },
  focus: { borderColor: colors.accent }, disabled: { borderStyle: 'dashed' },
  inputFocus: { borderColor: colors.primaryDark, borderWidth: 4 },
  input: { color: colors.text, backgroundColor: colors.background, borderColor: colors.text, borderWidth: 2, borderRadius: 8, minHeight: 48, padding: 12, fontSize: 16 },
});
