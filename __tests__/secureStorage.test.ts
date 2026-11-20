import * as SecureStore from 'expo-secure-store';
import { secureStorage } from '../src/auth/secureStorage';
// Módulo nativo simulado: estas pruebas NO acreditan cifrado/Keychain/Keystore real.
jest.mock('expo-secure-store', () => ({ isAvailableAsync: jest.fn(), getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7 }));
beforeEach(() => { jest.resetAllMocks(); jest.mocked(SecureStore.isAvailableAsync).mockResolvedValue(true); });
it('usa misma clave y accesibilidad, guarda solo refresh', async () => {
  await secureStorage.write('a'.repeat(43)); await secureStorage.read(); await secureStorage.clear();
  const options = { keychainAccessible: 7 };
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('whatscommerceec.refresh.v1', 'a'.repeat(43), options);
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith('whatscommerceec.refresh.v1', options);
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('whatscommerceec.refresh.v1', options);
});
it('no degrada a almacenamiento inseguro si no está disponible', async () => {
  jest.mocked(SecureStore.isAvailableAsync).mockResolvedValue(false);
  await expect(secureStorage.write('a'.repeat(43))).rejects.toThrow(); await expect(secureStorage.read()).rejects.toThrow();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});
it('propaga fallo nativo para que sesión falle cerrada', async () => {
  jest.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error('fixture native failure'));
  await expect(secureStorage.write('a'.repeat(43))).rejects.toThrow();
});
