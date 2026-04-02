import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV();

export const Store = {
  getLastOpenedNoteId: () => storage.getString('lastOpenedNoteId'),
  setLastOpenedNoteId: (id: string) => storage.set('lastOpenedNoteId', id),

  getTheme: () => storage.getString('theme') ?? 'dark',
  setTheme: (t: string) => storage.set('theme', t),

  // All features are free — always returns true
  isProUser: () => true,

  getSyncPassphrase: () => storage.getString('syncPassphrase'),
  setSyncPassphrase: (p: string) => storage.set('syncPassphrase', p),

  getLastSyncAt: () => storage.getNumber('lastSyncAt'),
  setLastSyncAt: (ts: number) => storage.set('lastSyncAt', ts),

  getResurfaceNoteId: () => storage.getString('resurfaceNoteId'),
  setResurfaceNoteId: (id: string) => storage.set('resurfaceNoteId', id),
};
