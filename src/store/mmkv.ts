// Falls back to in-memory storage when native SecureStore isn't available (e.g. Expo Go).
const mem = new Map<string, string>();

async function getItem(key: string): Promise<string | null> {
  try {
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync(key);
  } catch {
    return mem.get(key) ?? null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  } catch {
    mem.set(key, value);
  }
}

export const Store = {
  getLastOpenedNoteId: () => getItem('lastOpenedNoteId'),
  setLastOpenedNoteId: (id: string) => setItem('lastOpenedNoteId', id),

  getTheme: () => getItem('theme'),
  setTheme: (t: string) => setItem('theme', t),

  isProUser: () => true,

  getSyncPassphrase: () => getItem('syncPassphrase'),
  setSyncPassphrase: (p: string) => setItem('syncPassphrase', p),

  getLastSyncAt: async () => {
    const val = await getItem('lastSyncAt');
    return val ? Number(val) : null;
  },
  setLastSyncAt: (ts: number) => setItem('lastSyncAt', String(ts)),

  getResurfaceNoteId: () => getItem('resurfaceNoteId'),
  setResurfaceNoteId: (id: string) => setItem('resurfaceNoteId', id),
};
