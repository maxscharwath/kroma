// The synchronous key/value store @kroma/core's per-device preferences (the
// theme mode, subtitle appearance, the audio filter) read through. React Native
// has no `localStorage`, so without this every one of those writes is a silent
// no-op and every read answers "never chosen".
//
// Backed by one JSON file, mirrored in memory. The accounts and the prefs in
// storage.ts stay in SecureStore: those hold credentials, these are choices.

import { type SessionStorage, setSessionStorage } from '@kroma/core';
import { Directory, File, Paths } from 'expo-file-system';
import { z } from 'zod';

const FILE_NAME = 'kroma-prefs.json';

const STORED = z.record(z.string(), z.string());

function open(): File | null {
  try {
    const dir = new Directory(Paths.document, 'kroma');
    if (!dir.exists) dir.create({ intermediates: true });
    const file = new File(dir, FILE_NAME);
    if (!file.exists) file.write('{}');
    return file;
  } catch {
    // A device that refuses the location keeps the in-memory copy.
    return null;
  }
}

class DeviceStore implements SessionStorage {
  private readonly file = open();
  private data = read(this.file);

  getItem(key: string): string | null {
    return this.data[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.data[key] = value;
    this.flush();
  }

  removeItem(key: string): void {
    delete this.data[key];
    this.flush();
  }

  private flush(): void {
    try {
      this.file?.write(JSON.stringify(this.data));
    } catch (cause) {
      console.warn('[kroma] preference store write failed:', cause);
    }
  }
}

function read(file: File | null): Record<string, string> {
  if (!file) return {};
  try {
    const parsed = STORED.safeParse(JSON.parse(file.textSync()));
    return parsed.success ? parsed.data : {};
  } catch {
    // A truncated or hand-edited file must not stop the app from starting.
    return {};
  }
}

/** Installs the store, synchronously. Call it before the first read — the theme
 *  mode is applied at module scope, ahead of the first render. */
export function installDeviceStore(): void {
  setSessionStorage(new DeviceStore());
}
