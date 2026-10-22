import type { Credential, RecentSpec, SpecSource, Theme } from '../types';
import { getStorageBridge } from './gm';

const KEYS = {
  theme: 'oneswagger.theme',
  source: 'oneswagger.source',
  recent: 'oneswagger.recent',
  auth: 'oneswagger.auth',
  server: 'oneswagger.server',
  composer: 'oneswagger.composer',
};

export function hashKey(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function readRaw(key: string): string | null {
  const bridge = getStorageBridge();
  if (bridge) {
    try {
      return bridge.get(key);
    } catch {
      /* fall back to localStorage */
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  const bridge = getStorageBridge();
  if (bridge) {
    try {
      bridge.set(key, value);
      return;
    } catch {
      /* fall back to localStorage */
    }
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage full or unavailable */
  }
}

function removeRaw(key: string): void {
  const bridge = getStorageBridge();
  if (bridge) {
    try {
      bridge.remove(key);
      return;
    } catch {
      /* fall back to localStorage */
    }
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = readRaw(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  writeRaw(key, JSON.stringify(value));
}

export function loadTheme(): Theme {
  try {
    const raw = readRaw(KEYS.theme);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    // Tolerate an older build that stored the value as JSON.
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed === 'light' || parsed === 'dark' || parsed === 'system') return parsed;
    }
  } catch {
    /* ignore */
  }
  return 'system';
}

export function saveTheme(theme: Theme): void {
  writeRaw(KEYS.theme, theme);
}

export function loadSource(): SpecSource | null {
  const source = read<SpecSource | null>(KEYS.source, null);
  if (!source || source.kind !== 'url' || !source.value) return null;
  return source;
}

export function saveSource(source: SpecSource | null): void {
  if (!source) {
    removeRaw(KEYS.source);
    return;
  }
  if (source.kind === 'url') {
    write(KEYS.source, { kind: 'url', value: source.value, label: source.label, url: source.url });
  } else {
    // File and pasted specs are intentionally session-only.
    removeRaw(KEYS.source);
  }
}

export function loadRecent(): RecentSpec[] {
  return read<RecentSpec[]>(KEYS.recent, []);
}

export function addRecent(spec: RecentSpec): RecentSpec[] {
  const current = loadRecent().filter((item) => item.url !== spec.url);
  const next = [spec, ...current].slice(0, 8);
  write(KEYS.recent, next);
  return next;
}

export function removeRecent(url: string): RecentSpec[] {
  const next = loadRecent().filter((item) => item.url !== url);
  write(KEYS.recent, next);
  return next;
}

export function loadCredentials(specKey: string): Record<string, Credential> {
  const all = read<Record<string, Record<string, Credential>>>(KEYS.auth, {});
  return all[hashKey(specKey)] || {};
}

export function saveCredentials(specKey: string, credentials: Record<string, Credential>): void {
  const all = read<Record<string, Record<string, Credential>>>(KEYS.auth, {});
  if (Object.keys(credentials).length === 0) delete all[hashKey(specKey)];
  else all[hashKey(specKey)] = credentials;
  write(KEYS.auth, all);
}

export function loadServerOverride(specKey: string): string | null {
  const all = read<Record<string, string>>(KEYS.server, {});
  return all[hashKey(specKey)] || null;
}

export function saveServerOverride(specKey: string, url: string | null): void {
  const all = read<Record<string, string>>(KEYS.server, {});
  if (!url) delete all[hashKey(specKey)];
  else all[hashKey(specKey)] = url;
  write(KEYS.server, all);
}

export function loadComposer<T>(fallback: T): T {
  return read<T>(KEYS.composer, fallback);
}

export function saveComposer(value: unknown): void {
  write(KEYS.composer, value);
}
