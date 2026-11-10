import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { Session } from '../src/auth/session';
import { AccessScreen } from '../src/screens/AccessScreen';
import type { Transport } from '../src/api/client';

// Componentes con API y almacenamiento simulados, sin dispositivo ni servidor.
const id = '11111111-1111-4111-8111-111111111111';
const user = { id, email: 'synthetic@example.test', platformRole: null };
function setup() {
  const transport = jest.fn<ReturnType<Transport>, Parameters<Transport>>().mockImplementation(async path => {
    if (path === '/auth/login') return { accessToken: 'e30.e30.fixture', tokenType: 'Bearer', expiresIn: 900, refreshToken: 'a'.repeat(43), refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(), user };
    if (path === '/me/companies') return { items: [{ companyId: id, tradeName: 'Empresa sintética', status: 'ACTIVE', role: 'SELLER' }], nextCursor: null };
    if (path === `/companies/${id}`) return { representation: 'BASIC', id, tradeName: 'Empresa sintética', status: 'ACTIVE' };
    return undefined;
  });
  const storage = { read: jest.fn(async (): Promise<string | null> => null), write: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) };
  const session = new Session(storage, transport); return { session, transport, storage };
}
beforeEach(() => jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }));
afterEach(() => jest.restoreAllMocks());
it('abre recuperación desde login, limpia contraseña y permite volver', () => {
  const { session, transport } = setup(); render(<AccessScreen session={session} />);
  fireEvent.changeText(screen.getByLabelText('Contraseña'), 'SyntheticSecret!');
  fireEvent.press(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
  expect(screen.getByLabelText('Correo registrado')).toBeTruthy();
  expect(screen.queryByLabelText('Contraseña')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Volver al login' }));
  expect(screen.getByLabelText('Contraseña').props.value).toBe('');
  expect(transport).not.toHaveBeenCalled();
});
it('campos etiquetados y protegidos; validación local no envía vacío', () => {
  const { session, transport } = setup(); render(<AccessScreen session={session} />);
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Correo electrónico').props.autoCapitalize).toBe('none');
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  expect(screen.getByRole('alert').props.children.join('')).toContain('Completa correo');
  expect(transport).not.toHaveBeenCalled();
});
it('envía password sin transformar, lo vacía y permite selección BASIC y logout', async () => {
  const { session, transport, storage } = setup(); render(<AccessScreen session={session} />);
  fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'synthetic@example.test');
  fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Password!Con Espacio');
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  expect(screen.getByLabelText('Contraseña').props.value).toBe('');
  await screen.findByRole('button', { name: 'Abrir Empresa sintética' });
  expect(transport).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ method: 'POST', body: { email: 'synthetic@example.test', password: 'Password!Con Espacio' } }));
  fireEvent.press(screen.getByRole('button', { name: 'Abrir Empresa sintética' }));
  expect(await screen.findByText('Vista básica autorizada por servidor')).toBeTruthy();
  expect(screen.queryByText(/RUC:/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión y borrar acceso local' }));
  await waitFor(() => expect(session.getSnapshot().busy).toBe(false));
  expect(storage.clear).toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
  expect(screen.getByLabelText('Correo electrónico').props.value).toBe('');
});
it('limpia contexto al perder foco y revalida al volver', async () => {
  const { session, transport } = setup(); await session.login('synthetic@example.test', 'Synthetic!'); await session.selectCompany(id);
  let handler!: (next: 'active' | 'background') => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { handler = listener; return { remove: jest.fn() }; });
  render(<AccessScreen session={session} />);
  act(() => handler('background')); expect(screen.queryByText('Vista básica autorizada por servidor')).toBeNull();
  await act(async () => handler('active'));
  expect(await screen.findByText('Vista básica autorizada por servidor')).toBeTruthy();
  expect(transport.mock.calls.filter(([path]) => path === `/companies/${id}`)).toHaveLength(2);
});
it('admite contraseña con números y la envía intacta sin persistirla', async () => {
  const { session, transport, storage } = setup(); render(<AccessScreen session={session} />);
  const password = 'Abc1234567890!x'; // Fixture sintético, no credencial real.
  fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'synthetic@example.test');
  fireEvent.changeText(screen.getByLabelText('Contraseña'), password);
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Ingresar' }));
  await screen.findByRole('button', { name: 'Abrir Empresa sintética' });
  expect(transport).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ body: { email: 'synthetic@example.test', password } }));
  expect(storage.write).not.toHaveBeenCalledWith(password);
  expect(JSON.stringify(session.getSnapshot()).includes(password)).toBe(false);
});
