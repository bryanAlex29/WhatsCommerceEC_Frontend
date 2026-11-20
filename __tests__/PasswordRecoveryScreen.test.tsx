import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PasswordRecoveryScreen } from '../src/screens/PasswordRecoveryScreen';
import { recoveryMessage } from '../src/auth/recovery';
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
const fetchMock = jest.fn(); const originalFetch = globalThis.fetch; const originalUrl = process.env.EXPO_PUBLIC_API_URL;
const token = 'A'.repeat(43);
beforeEach(() => { process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000'; globalThis.fetch = fetchMock; fetchMock.mockReset(); jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); });
afterEach(() => { jest.restoreAllMocks(); globalThis.fetch = originalFetch; if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = originalUrl; });
function mount(back = jest.fn()) { render(<SafeAreaProvider><NavigationContainer><PasswordRecoveryScreen onBack={back} /></NavigationContainer></SafeAreaProvider>); return back; }
async function requestCode() {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ message: recoveryMessage }) });
  fireEvent.changeText(screen.getByLabelText('Correo registrado'), 'synthetic@example.test'); fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }));
  await screen.findByLabelText('Código de ocho dígitos');
}
async function verifyCode() {
  fireEvent.changeText(screen.getByLabelText('Código de ocho dígitos'), '00001234');
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ resetToken: token, expiresAt: '2027-01-01T00:00:00.000Z' }) });
  fireEvent.press(screen.getByRole('button', { name: 'Verificar código' })); await screen.findByLabelText('Nueva contraseña');
}
it('tres vistas reales, contraseña8 protegida, sin login automático', async () => {
  const back = mount(); await requestCode(); expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
  expect(screen.getByLabelText('Código de ocho dígitos').props.keyboardType).toBe('number-pad');
  await verifyCode(); expect(screen.queryByLabelText('Código de ocho dígitos')).toBeNull();
  expect(screen.getByLabelText('Nueva contraseña').props.secureTextEntry).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'Abcdefg!'); fireEvent.changeText(screen.getByLabelText('Confirmar nueva contraseña'), 'Abcdefg!');
  fetchMock.mockResolvedValueOnce({ ok: true, status: 204 });
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Cambiar contraseña' })));
  expect(screen.queryByLabelText('Nueva contraseña')).toBeNull(); expect(screen.getByText(/Contraseña actualizada/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Volver al login' })); expect(back).toHaveBeenCalledWith(true);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ email: 'synthetic@example.test', resetToken: token, password: 'Abcdefg!' }));
});
it('código incorrecto no abre nueva contraseña y el reenvío está bloqueado inicialmente', async () => {
  mount(); await requestCode(); expect(screen.getByRole('button', { name: 'Reenviar código' }).props.accessibilityState.disabled).toBe(true);
  fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { code: 'INVALID_RECOVERY_CODE' } }) });
  fireEvent.changeText(screen.getByLabelText('Código de ocho dígitos'), '99999999'); fireEvent.press(screen.getByRole('button', { name: 'Verificar código' }));
  await screen.findByText(/Código inválido o vencido/); expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
  expect(screen.getByLabelText('Código de ocho dígitos').props.value).toBe('');
});
it('segundo plano borra código y pase, vuelve a la solicitud y no reintenta', async () => {
  const handlers = new Set<(state: AppStateStatus) => void>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { handlers.add(listener); return { remove: () => { handlers.delete(listener); } }; });
  mount(); await requestCode(); await verifyCode();
  fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'Abcdefg!');
  act(() => { [...handlers].forEach(handler => handler('background')); });
  await screen.findByLabelText('Correo registrado'); expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
  expect(screen.getByLabelText('Correo registrado').props.value).toBe(''); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('volver desde solicitud no envía correo ni presenta éxito', () => {
  const back = mount(); fireEvent.press(screen.getByRole('button', { name: 'Volver al login' })); expect(back).toHaveBeenCalledWith(false); expect(fetchMock).not.toHaveBeenCalled();
});
it('POP de nueva contraseña limpia campos y conserva solo pase privado; sin secretos en rutas', async () => {
  const ref=createNavigationContainerRef();
  render(<SafeAreaProvider><NavigationContainer ref={ref}><PasswordRecoveryScreen onBack={()=>{}} /></NavigationContainer></SafeAreaProvider>);
  await requestCode(); await verifyCode(); fireEvent.changeText(screen.getByLabelText('Nueva contraseña'),'Abcdefg!');
  act(()=>ref.goBack());
  expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Continuar con nueva contraseña'}));
  expect(screen.getByLabelText('Nueva contraseña').props.value).toBe('');
  expect(JSON.stringify(ref.getRootState())).not.toContain(token);
  expect(JSON.stringify(ref.getRootState())).not.toContain('synthetic@example.test');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
