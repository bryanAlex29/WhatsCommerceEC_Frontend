import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TechnicalScreen } from '../src/screens/TechnicalScreen';
import { checkHealth, HealthCheckError } from '../src/api/health';

jest.mock('../src/api/health', () => ({ ...jest.requireActual('../src/api/health'), checkHealth: jest.fn() }));
const check = jest.mocked(checkHealth);
const originalUrl = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => { process.env.EXPO_PUBLIC_API_URL = 'http://192.168.100.5:3000'; check.mockReset(); });
afterAll(() => { if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = originalUrl; });
it('muestra la URL pública efectiva sin solicitar health al montar', () => {
  render(<TechnicalScreen />);
  expect(screen.getByText('API configurada: http://192.168.100.5:3000')).toBeTruthy();
  expect(check).not.toHaveBeenCalled();
});
it('no muestra credenciales de una URL inválida', () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://private-user:private-password@example.test:3000';
  render(<TechnicalScreen />);
  expect(screen.getByText('API configurada: Configuración pública ausente o inválida')).toBeTruthy();
  expect(screen.queryByText(/private-password/)).toBeNull();
});
it.each([
  ['NETWORK', 'Expo Go no pudo conectar'], ['TIMEOUT', 'agotó el tiempo de espera'],
  ['CONFIGURATION', 'no está configurada correctamente'], ['RESPONSE', 'no con el JSON esperado'],
] as const)('distingue %s sin mostrar errores de plataforma', async (code, text) => {
  check.mockRejectedValue(new HealthCheckError(code, 'detalle privado simulado'));
  render(<TechnicalScreen />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Comprobar backend' })); });
  expect(screen.getByText(new RegExp(text))).toBeTruthy();
  expect(screen.queryByText(/detalle privado/)).toBeNull();
});
