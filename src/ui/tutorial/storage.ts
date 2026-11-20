/**
 * A tiny key-value store for UI preferences (the "tutorial done" flag). Uses
 * AsyncStorage on devices and web (localStorage there); falls back to memory when the
 * native module is missing (tests, an Expo Go without it) or a call fails, so a storage
 * problem can never surface as an error.
 */

export interface KeyValueBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const memory = new Map<string, string>();

const memoryBackend: KeyValueBackend = {
  getItem: async (key) => memory.get(key) ?? null,
  setItem: async (key, value) => {
    memory.set(key, value);
  },
  removeItem: async (key) => {
    memory.delete(key);
  },
};

let backend: KeyValueBackend | null | undefined;

function underJest(): boolean {
  return typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;
}

function resolveBackend(): KeyValueBackend | null {
  if (backend !== undefined) return backend;
  backend = null;
  if (underJest()) return backend;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage');
    const store = (mod?.default ?? mod) as Partial<KeyValueBackend> | undefined;
    if (store && typeof store.getItem === 'function' && typeof store.setItem === 'function' && typeof store.removeItem === 'function') backend = store as KeyValueBackend;
  } catch {
    backend = null;
  }
  return backend;
}

/** Tests: use this backend (or null for memory only). */
export function setStorageBackend(next: KeyValueBackend | null): void {
  backend = next;
  memory.clear();
}

export async function readValue(key: string): Promise<string | null> {
  const b = resolveBackend();
  if (b) {
    try {
      const v = await b.getItem(key);
      if (v !== null && v !== undefined) return v;
    } catch {
      // fall through to memory
    }
  }
  return memoryBackend.getItem(key);
}

export async function writeValue(key: string, value: string | null): Promise<void> {
  if (value === null) await memoryBackend.removeItem(key);
  else await memoryBackend.setItem(key, value);
  const b = resolveBackend();
  if (!b) return;
  try {
    if (value === null) await b.removeItem(key);
    else await b.setItem(key, value);
  } catch {
    // memory keeps it for this session
  }
}
