import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { AppState } from 'react-native';
import { checkHealth, type HealthResponse } from '../src/api/health';
import { secureStorage } from '../src/auth/secureStorage';

// Health, almacenamiento y áreas seguras simulados; no ejecución nativa/API real.
jest.mock('../src/api/health');
jest.mock('../src/auth/secureStorage', () => ({ secureStorage: { read: jest.fn(), write: jest.fn(), clear: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
const checkMock = jest.mocked(checkHealth);
beforeEach(() => { checkMock.mockReset(); jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); });
afterEach(() => { jest.clearAllMocks(); jest.restoreAllMocks(); });
it('abre bienvenida sin formularios, restauración ni comprobaciones automáticas', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: 'Comenzar' })).toBeTruthy();
  expect(screen.getByLabelText('Logo oficial de WhatsCommerce EC')).toBeTruthy();
  expect(screen.getByText('Automatiza tus ventas y la atención por WhatsApp')).toBeTruthy();
  expect(screen.queryByLabelText('Contraseña')).toBeNull();
  expect(screen.queryByText('Backend sin comprobar.')).toBeNull();
  expect(secureStorage.read).not.toHaveBeenCalled();
  expect(checkMock).not.toHaveBeenCalled();
});
it('Comenzar abre el acceso existente sin restaurar ni solicitar health automáticamente', () => {
  render(<App />);
  fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));
  expect(screen.queryByRole('button', { name: 'Comenzar' })).toBeNull();
  expect(screen.queryByText('Backend sin comprobar.')).toBeNull();
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  expect(checkMock).not.toHaveBeenCalled();
  expect(secureStorage.read).not.toHaveBeenCalled();
});
it('health conserva carga y protección contra doble envío', async () => {
  let resolve!: (value: HealthResponse) => void;
  checkMock.mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<App />);
  fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));
  fireEvent.press(screen.getByRole('button', { name: 'Comprobar conexión' }));
  const button = screen.getByRole('button', { name: 'Comprobar backend' });
  fireEvent.press(button); fireEvent.press(button);
  expect(screen.getByText('Comprobando backend…')).toBeTruthy();
  expect(button.props.accessibilityState.disabled).toBe(true);
  expect(checkMock).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ status: 'ok', service: 'whatscommerceec-backend' }));
  expect(screen.getByText('Backend disponible en la última comprobación.')).toBeTruthy();
});
it('health oculta errores crudos y permite reintento', async () => {
  checkMock.mockRejectedValueOnce(new Error('detalle privado simulado'));
  render(<App />);
  fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));
  fireEvent.press(screen.getByRole('button', { name: 'Comprobar conexión' }));
  fireEvent.press(screen.getByRole('button', { name: 'Comprobar backend' }));
  expect(await screen.findByText('No se pudo comprobar el backend. Revisa la conexión y la configuración pública.')).toBeTruthy();
  expect(screen.queryByText('detalle privado simulado')).toBeNull();
  checkMock.mockResolvedValueOnce({ status: 'ok', service: 'whatscommerceec-backend' });
  fireEvent.press(screen.getByRole('button', { name: 'Comprobar backend' }));
  expect(await screen.findByText('Backend disponible en la última comprobación.')).toBeTruthy();
});
