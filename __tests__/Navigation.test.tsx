import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';
import App from '../App';
import { Session } from '../src/auth/session';
import type { Routes } from '../src/navigation/AppNavigator';
import type { Transport } from '../src/api/client';

// Actual native-stack JS router, with native views/SafeArea/storage/API simulated.
// POP actions are not physical Android/iOS gestures.
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/auth/secureStorage', () => ({ secureStorage: { read: jest.fn(), write: jest.fn(), clear: jest.fn() } }));
const id = '11111111-1111-4111-8111-111111111111';
const password = 'SyntheticPassword!';
const email = 'synthetic@example.test';
const user = { id, email, platformRole: null };
const tokens = () => ({ accessToken: 'e30.e30.fixture', tokenType: 'Bearer', expiresIn: 900,
  refreshToken: 'a'.repeat(43), refreshExpiresAt: '2027-01-01T00:00:00.000Z', user });
function setup(login?: () => Promise<unknown>) {
  const storage = { read: jest.fn(async (): Promise<string | null> => null), write: jest.fn(async () => {}), clear: jest.fn(async () => {}) };
  const transport = jest.fn<ReturnType<Transport>, Parameters<Transport>>().mockImplementation(async path => {
    if (path === '/auth/login') return login ? login() : tokens();
    if (path === '/me/companies') return { items: [{ companyId: id, tradeName: 'Empresa sintética', status: 'ACTIVE', role: 'SELLER' }], nextCursor: null };
    if (path === `/companies/${id}`) return { representation: 'BASIC', id, tradeName: 'Empresa sintética', status: 'ACTIVE' };
    return undefined;
  });
  const session = new Session(storage, transport); const ref = createNavigationContainerRef<Routes>();
  render(<App session={session} navigationRef={ref} />);
  fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));
  return { session, storage, transport, ref };
}
function fill() {
  fireEvent.changeText(screen.getByLabelText('Correo electrónico'), email);
  fireEvent.changeText(screen.getByLabelText('Contraseña'), password);
}
beforeEach(() => jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }));
afterEach(() => jest.restoreAllMocks());

it('retrocede recuperación→login→bienvenida sin conservar correo/contraseña ni secretos en rutas', () => {
  const { ref, transport, storage } = setup(); fill();
  fireEvent.press(screen.getByRole('button', { name: 'Mostrar contraseña' }));
  fireEvent.press(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
  expect(ref.getCurrentRoute()?.name).toBe('RecoveryEmail');
  expect(screen.getByLabelText('Correo registrado')).toBeTruthy();
  act(() => ref.goBack());
  expect(ref.getCurrentRoute()?.name).toBe('Login');
  expect(screen.getByLabelText('Contraseña').props.value).toBe('');
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Correo electrónico').props.value).toBe('');
  fill(); act(() => ref.goBack());
  expect(ref.getCurrentRoute()?.name).toBe('Welcome');
  fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));
  expect(screen.getByLabelText('Contraseña').props.value).toBe('');
  fireEvent.press(screen.getByRole('button', { name: 'Volver a bienvenida' }));
  expect(ref.getCurrentRoute()?.name).toBe('Welcome');
  expect(JSON.stringify(ref.getRootState())).not.toContain(password);
  expect(JSON.stringify(ref.getRootState())).not.toContain(email);
  expect(transport).not.toHaveBeenCalled(); expect(storage.read).not.toHaveBeenCalled();
});
it('diagnóstico separado no conserva el formulario al regresar ni activa invitaciones', () => {
  const { ref, transport } = setup(); fill();
  fireEvent.press(screen.getByRole('button', { name: 'Comprobar conexión' }));
  expect(screen.getByRole('button', { name: 'Comprobar backend' })).toBeTruthy();
  act(() => ref.goBack());
  expect(screen.getByLabelText('Contraseña').props.value).toBe('');
  expect(screen.queryByRole('button', { name: /invitación|Registr|Google|Restaurar sesión/i })).toBeNull();
  expect(transport).not.toHaveBeenCalled();
});
it('login sustituye historial público; retroceso de empresa limpia contexto y logout elimina historial privado', async () => {
  const { session, ref, storage } = setup(); fill();
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('button', { name: 'Abrir Empresa sintética' });
  expect(ref.getRootState()?.routes.map(route => route.name)).toEqual(['Workspace']);
  expect(ref.canGoBack()).toBe(false);
  fireEvent.press(screen.getByRole('button', { name: 'Abrir Empresa sintética' }));
  await screen.findByText('Vista básica autorizada por servidor');
  expect(ref.getCurrentRoute()?.name).toBe('Company');
  act(() => ref.goBack());
  expect(ref.getCurrentRoute()?.name).toBe('Workspace');
  expect(session.getSnapshot().company).toBeNull();
  expect(screen.queryByText('Vista básica autorizada por servidor')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión y borrar acceso local' }));
  await waitFor(() => expect(session.getSnapshot().busy).toBe(false));
  expect(ref.getCurrentRoute()?.name).toBe('Login');
  expect(ref.getRootState()?.routes.map(route => route.name)).toEqual(['Login']);
  expect(ref.canGoBack()).toBe(false);
  expect(storage.clear).toHaveBeenCalled();
  expect(screen.getByLabelText('Contraseña').props.value).toBe('');
});
it('login en curso bloquea POP y doble envío; permite sustituir la ruta al confirmar sesión', async () => {
  let finish!: (value: unknown) => void;
  const { ref, transport } = setup(() => new Promise(resolve => { finish = resolve; })); fill();
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  act(() => ref.goBack());
  expect(ref.getCurrentRoute()?.name).toBe('Login');
  expect(transport.mock.calls.filter(([path]) => path === '/auth/login')).toHaveLength(1);
  expect(screen.getByLabelText('Contraseña').props.value).toBe('');
  await act(async () => finish(tokens()));
  expect(ref.getCurrentRoute()?.name).toBe('Workspace');
});
it('fallo de red no inicia sesión ni conserva la contraseña', async () => {
  const { ref } = setup(async () => { throw new Error('synthetic-private-diagnostic'); }); fill();
  fireEvent.press(screen.getByRole('button', { name: 'Mostrar contraseña' }));
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByText(/No se pudo completar la operación de forma segura/);
  expect(ref.getCurrentRoute()?.name).toBe('Login');
  expect(screen.getByLabelText('Contraseña').props.value).toBe('');
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  expect(screen.queryByText('synthetic-private-diagnostic')).toBeNull();
});
it('salir de una empresa por logout no libera el bloqueo mientras se borra el almacén seguro', async () => {
  const { session, storage } = setup(); fill();
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('button', { name: 'Abrir Empresa sintética' });
  fireEvent.press(screen.getByRole('button', { name: 'Abrir Empresa sintética' }));
  await screen.findByText('Vista básica autorizada por servidor');
  let cleared!: () => void;
  storage.clear.mockImplementation(() => new Promise(resolve => { cleared = resolve; }));
  fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión y borrar acceso local' }));
  await waitFor(() => expect(storage.clear).toHaveBeenCalled());
  expect(session.getSnapshot().user).toBeNull(); expect(session.getSnapshot().busy).toBe(true);
  expect(screen.getByRole('button', { name: 'Ingresar' }).props.accessibilityState.disabled).toBe(true);
  await act(async () => cleared());
  await waitFor(() => expect(session.getSnapshot().busy).toBe(false));
});
