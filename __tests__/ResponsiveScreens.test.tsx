import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Native from 'react-native';
import { AccessScreen } from '../src/screens/AccessScreen';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { PasswordRecoveryScreen } from '../src/screens/PasswordRecoveryScreen';
import { Session } from '../src/auth/session';
import type { Transport } from '../src/api/client';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const cases = [
  { width: 320, height: 568, fontScale: 1 },
  { width: 390, height: 844, fontScale: 1 },
  { width: 844, height: 390, fontScale: 1.5 },
  { width: 768, height: 1024, fontScale: 2 },
];
function session(transport?: Transport) { return new Session({ read: async () => null, write: async () => {}, clear: async () => {} }, transport); }
beforeEach(() => jest.spyOn(Native.AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }));
afterEach(() => jest.restoreAllMocks());
describe('renders con medidas simuladas; no prueba visual de dispositivo', () => {
  it.each(cases)('mantiene campos, botones y escalado de contenido a $width×$height/fuente$fontScale', viewport => {
    jest.spyOn(Native, 'useWindowDimensions').mockReturnValue({ ...viewport, scale: 2 });
    const onRecover = jest.fn();
    render(<AccessScreen session={session()} onRecover={onRecover} />);
    // RN Image prepends intrinsic PNG dimensions. Explicit height must override 435.
    const logoStyle = Native.StyleSheet.flatten([{ width: 1454, height: 435 }, screen.getByLabelText('Logo oficial de WhatsCommerce EC').props.style]);
    expect(logoStyle.height).toBeGreaterThan(0);
    expect(logoStyle.height).toBeLessThan(80);
    expect(logoStyle.width / logoStyle.height).toBeCloseTo(1454 / 435);
    expect(screen.getByRole('header', { name: 'Iniciar sesión' }).props.allowFontScaling).not.toBe(false);
    expect(screen.getByLabelText('Correo electrónico').props.editable).toBe(true);
    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(onRecover).toHaveBeenCalledTimes(1);
  });
  it('actualizar tamaño/orientación conserva el formulario, el ocultamiento y la funcionalidad', () => {
    const dimensions = jest.spyOn(Native, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, fontScale: 1, scale: 2 });
    const client = session(); const view = render(<AccessScreen session={client} />);
    fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'synthetic@example.test');
    fireEvent.changeText(screen.getByLabelText('Contraseña'), 'SyntheticPassword!');
    dimensions.mockReturnValue({ width: 844, height: 390, fontScale: 2, scale: 2 });
    view.rerender(<AccessScreen session={client} />);
    expect(screen.getByLabelText('Correo electrónico').props.value).toBe('synthetic@example.test');
    expect(screen.getByLabelText('Contraseña').props.value).toBe('SyntheticPassword!');
    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(false);
  });
  it('bienvenida compacta conserva Comenzar y recuperación mantiene todos sus campos', () => {
    jest.spyOn(Native, 'useWindowDimensions').mockReturnValue({ width: 320, height: 568, fontScale: 2, scale: 2 });
    const start = jest.fn(); const welcome = render(<WelcomeScreen onStart={start} />);
    fireEvent.press(screen.getByRole('button', { name: 'Comenzar' })); expect(start).toHaveBeenCalledTimes(1);
    welcome.unmount();
    const back = jest.fn(); render(<SafeAreaProvider><NavigationContainer><PasswordRecoveryScreen onBack={back} /></NavigationContainer></SafeAreaProvider>);
    expect(screen.getByLabelText('Correo registrado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Volver al login' })); expect(back).toHaveBeenCalledWith(false);
  });
  it.each(['BASIC', 'FULL'] as const)('conserva consulta %s y logout con letra grande en ventana horizontal', async representation => {
    jest.spyOn(Native, 'useWindowDimensions').mockReturnValue({ width: 844, height: 390, fontScale: 2, scale: 2 });
    const id = '11111111-1111-4111-8111-111111111111';
    const client = session(async path => {
      if (path === '/auth/login') return { accessToken: 'e30.e30.fixture', tokenType: 'Bearer', expiresIn: 900, refreshToken: 'a'.repeat(43), refreshExpiresAt: '2027-01-01T00:00:00.000Z', user: { id, email: 'synthetic@example.test', platformRole: null } };
      if (path === '/me/companies') return { items: [{ companyId: id, tradeName: 'Empresa sintética', status: 'ACTIVE', role: 'COMPANY_ADMIN' }], nextCursor: null };
      if (path === `/companies/${id}`) return representation === 'BASIC' ? { representation, id, tradeName: 'Empresa sintética', status: 'ACTIVE' } : {
        representation, id, tradeName: 'Empresa sintética', status: 'ACTIVE', legalName: 'Razón social sintética para comprobar el ajuste de texto', ruc: '1234567890123',
        taxAddress: 'Dirección fiscal ficticia extensa para comprobación de contenido', contactEmail: 'synthetic@example.test', contactPhone: '+59312345678', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      };
      return undefined;
    });
    await client.login('synthetic@example.test', 'SyntheticPassword!'); await client.selectCompany(id);
    render(<AccessScreen session={client} />);
    expect(screen.getByText(`Vista ${representation === 'BASIC' ? 'básica' : 'completa'} autorizada por servidor`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar empresa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión y borrar acceso local' })).toBeTruthy();
    if (representation === 'FULL') expect(screen.getByText(/Dirección fiscal ficticia extensa/)).toBeTruthy();
    else expect(screen.queryByText(/RUC:/)).toBeNull();
  });
});
