import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { AppState } from 'react-native';
import { checkHealth, type HealthResponse } from '../src/api/health';

// Health, almacenamiento y áreas seguras simulados; no ejecución nativa/API real.
jest.mock('../src/api/health');
jest.mock('../src/auth/secureStorage', () => ({ secureStorage: { read: jest.fn(), write: jest.fn(), clear: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
const checkMock = jest.mocked(checkHealth);
beforeEach(() => jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }));
afterEach(() => jest.resetAllMocks());
it('no restaura ni solicita health automáticamente', () => {
  render(<App />);
  expect(screen.getByText('Backend sin comprobar.')).toBeTruthy();
  expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  expect(checkMock).not.toHaveBeenCalled();
});
it('health conserva carga y protección contra doble envío', async () => {
  let resolve!: (value: HealthResponse) => void;
  checkMock.mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<App />);
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
  fireEvent.press(screen.getByRole('button', { name: 'Comprobar backend' }));
  expect(await screen.findByText('No se pudo comprobar el backend. Revisa la conexión y la configuración pública.')).toBeTruthy();
  expect(screen.queryByText('detalle privado simulado')).toBeNull();
  checkMock.mockResolvedValueOnce({ status: 'ok', service: 'whatscommerceec-backend' });
  fireEvent.press(screen.getByRole('button', { name: 'Comprobar backend' }));
  expect(await screen.findByText('Backend disponible en la última comprobación.')).toBeTruthy();
});
