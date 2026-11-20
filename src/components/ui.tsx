import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../theme';
import { useResponsiveLayout } from '../layout';

export function Button({ children, onPress, disabled = false, variant = 'primary' }: { children: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'light' | 'brand' }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [ui.button, variant === 'light' && ui.lightButton, variant === 'brand' && ui.brandButton, (focused || pressed) && ui.focus, disabled && ui.disabled]}><Text style={[ui.buttonText, variant === 'light' && ui.lightButtonText, variant === 'brand' && ui.brandButtonText]}>{children}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={ui.stack}><Text style={ui.text}>{label}</Text><TextInput {...props} accessibilityLabel={label} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[ui.input, focused && ui.inputFocus]} /></View>;
}
export function Card({ children }: { children: ReactNode }) {
  const { compact } = useResponsiveLayout();
  return <View style={[ui.card, compact && { padding: 16, gap: 12 }]}>{children}</View>;
}
export function TextAction({ children, onPress, disabled = false, accessibilityLabel }: { children: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? children} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={[ui.textAction, focused && ui.focus, disabled && ui.disabled]}><Text style={ui.textActionLabel}>{children}</Text></Pressable>;
}
export function Notice({ children }: { children: string }) { return children ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.text}>ⓘ {children}</Text> : null; }
export const ui = StyleSheet.create({
  stack: { gap: 8 }, card: { padding: 20, gap: 16, borderWidth: 2, borderColor: colors.primary, borderRadius: 12 },
  text: { color: colors.text, fontSize: 16, lineHeight: 24 }, title: { color: colors.primaryDark, fontSize: 26, fontWeight: '700' },
  button: { minHeight: 48, borderWidth: 3, borderColor: colors.primaryDark, padding: 12, backgroundColor: colors.primaryDark, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  lightButton: { backgroundColor: colors.background, borderColor: colors.background, borderRadius: 24, minHeight: 64, paddingVertical: 16 },
  lightButtonText: { color: colors.primaryDark, fontSize: 22, fontWeight: '700' },
  brandButton: { backgroundColor: colors.primary, borderColor: colors.primary, borderRadius: 16, minHeight: 56 },
  brandButtonText: { fontSize: 20, fontWeight: '700' },
  textAction: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.background, paddingHorizontal: 8, borderRadius: 10 },
  textActionLabel: { color: colors.primaryDark, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  focus: { borderColor: colors.accent, outlineColor: colors.primaryDark, outlineWidth: 2, outlineOffset: 2 }, disabled: { borderStyle: 'dashed' },
  inputFocus: { borderColor: colors.primaryDark, borderWidth: 4 },
  input: { color: colors.text, backgroundColor: colors.background, borderColor: colors.text, borderWidth: 2, borderRadius: 8, minHeight: 48, padding: 12, fontSize: 16 },
});
