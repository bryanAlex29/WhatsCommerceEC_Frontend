import * as SecureStore from 'expo-secure-store';
export interface SecureStorage { read(): Promise<string | null>; write(token: string): Promise<void>; clear(): Promise<void> }
const key = 'whatscommerceec.refresh.v1';
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export const secureStorage: SecureStorage = {
  async read() { if (!await SecureStore.isAvailableAsync()) throw new Error('SecureStore no disponible'); return SecureStore.getItemAsync(key, options); },
  async write(token) { if (!await SecureStore.isAvailableAsync()) throw new Error('SecureStore no disponible'); await SecureStore.setItemAsync(key, token, options); },
  async clear() { await SecureStore.deleteItemAsync(key, options); },
};
