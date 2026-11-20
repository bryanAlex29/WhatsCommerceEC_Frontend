import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Decorative storefront, not an alternate brand mark. Native primitives only. */
export function StoreIllustration({ maxWidth = 320 }: { maxWidth?: number }) {
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.store, { maxWidth }]}>
    <View style={styles.building}>
      <View style={styles.window}><View style={styles.reflection} /></View>
      <View style={styles.bagHandle} /><View style={styles.bag} />
      <View style={styles.label} /><View style={styles.labelSmall} />
    </View>
    <View style={styles.awning}>{Array.from({ length: 6 }, (_, index) =>
      <View key={index} style={[styles.stripe, index % 2 === 1 && styles.stripeDark]} />)}</View>
    <View style={styles.base} />
  </View>;
}
const styles = StyleSheet.create({
  store: { width: '100%', maxWidth: 320, aspectRatio: 1.5, alignSelf: 'center' },
  building: { position: 'absolute', top: '22%', bottom: '5%', left: '9%', right: '9%', borderWidth: 7, borderColor: colors.primary, borderBottomWidth: 0 },
  awning: { position: 'absolute', top: 0, left: 0, right: 0, height: '34%', flexDirection: 'row' },
  stripe: { flex: 1, backgroundColor: colors.primary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  stripeDark: { backgroundColor: colors.primary, opacity: 0.45 },
  base: { position: 'absolute', bottom: 0, left: '4%', right: '4%', height: 9, borderRadius: 8, backgroundColor: colors.primary },
  window: { position: 'absolute', top: '18%', left: '8%', width: '44%', height: '50%', backgroundColor: colors.primary, borderTopLeftRadius: 24, overflow: 'hidden' },
  reflection: { position: 'absolute', top: '-20%', right: '-35%', width: '70%', height: '160%', backgroundColor: colors.primaryDark, transform: [{ rotate: '40deg' }] },
  bag: { position: 'absolute', top: '43%', left: '21%', width: '27%', height: '44%', borderRadius: 10, backgroundColor: colors.background },
  bagHandle: { position: 'absolute', top: '27%', left: '27%', width: '15%', height: '30%', borderRadius: 24, borderWidth: 5, borderColor: colors.background },
  label: { position: 'absolute', top: '40%', right: '8%', width: '29%', height: '16%', backgroundColor: colors.background, opacity: 0.9, borderRadius: 5 },
  labelSmall: { position: 'absolute', top: '67%', right: '8%', width: '29%', height: '12%', backgroundColor: colors.primary, borderRadius: 5 },
});
