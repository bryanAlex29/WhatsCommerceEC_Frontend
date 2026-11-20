import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Field, ui } from '../src/components/ui';
import { colors } from '../src/theme';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
}
it('foco de entrada usa borde contrastado y aumenta su grosor, sin depender solo del color', () => {
  render(<Field label="Campo de prueba" value="" onChangeText={() => {}} />);
  const initial = StyleSheet.flatten(screen.getByLabelText('Campo de prueba').props.style);
  fireEvent(screen.getByLabelText('Campo de prueba'), 'focus');
  const focused = StyleSheet.flatten(screen.getByLabelText('Campo de prueba').props.style);
  expect(focused.borderWidth - initial.borderWidth).toBeGreaterThanOrEqual(2);
  expect(focused.borderColor).toBe(colors.primaryDark);
  const contrast = (luminance(colors.background) + 0.05) / (luminance(focused.borderColor) + 0.05);
  expect(contrast).toBeGreaterThanOrEqual(3);
  fireEvent(screen.getByLabelText('Campo de prueba'), 'blur');
  expect(StyleSheet.flatten(screen.getByLabelText('Campo de prueba').props.style).borderWidth).toBe(initial.borderWidth);
  expect(ui.input.minHeight).toBeGreaterThanOrEqual(48);
});
