import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../theme';

export function CredentialField({ label, password = false, revealed = false, onToggle, ...props }: TextInputProps & {
  label: string; password?: boolean; revealed?: boolean; onToggle?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [toggleFocused, setToggleFocused] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.outline, focused && styles.focus]}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.icon}>
        {password ? <><View style={styles.shackle} /><View style={styles.lock} /></> : <Text allowFontScaling={false} style={styles.at}>@</Text>}
      </View>
      <TextInput {...props} accessibilityLabel={label} secureTextEntry={password && !revealed}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={styles.input} selectionColor={colors.primaryDark} />
      {password && <Pressable accessibilityRole="button" accessibilityLabel={`${revealed ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
        accessibilityState={{ disabled: props.editable === false, selected: revealed }} disabled={props.editable === false}
        onPress={onToggle} onFocus={() => setToggleFocused(true)} onBlur={() => setToggleFocused(false)}
        style={[styles.toggle, toggleFocused && styles.focus]}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.eye}>
          <View style={styles.pupil} />{revealed && <View style={styles.slash} />}
        </View>
      </Pressable>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  field: { gap: 4 }, label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  outline: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.primaryDark, borderRadius: 16, minHeight: 52, paddingHorizontal: 12, gap: 10 },
  focus: { borderColor: colors.accent, borderWidth: 2, outlineColor: colors.primaryDark, outlineWidth: 2, outlineOffset: 2 },
  input: { flex: 1, minWidth: 0, minHeight: 48, color: colors.text, fontSize: 16, paddingVertical: 10 },
  icon: { width: 22, height: 24, alignItems: 'center', justifyContent: 'center' },
  at: { fontSize: 20, color: colors.primaryDark },
  shackle: { position: 'absolute', top: 2, width: 10, height: 12, borderWidth: 2, borderColor: colors.primaryDark, borderRadius: 5 },
  lock: { position: 'absolute', bottom: 2, width: 16, height: 12, borderWidth: 2, borderColor: colors.primaryDark, borderRadius: 3, backgroundColor: colors.background },
  toggle: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background, borderRadius: 8 },
  eye: { width: 22, height: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  pupil: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primaryDark },
  slash: { position: 'absolute', width: 26, height: 2, backgroundColor: colors.primaryDark, transform: [{ rotate: '-35deg' }] },
});
