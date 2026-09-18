// src/ui/Settings.ts — persisted player toggles (localStorage 'ws.settings.v1'); pause-menu switches write here.
//
//   getSetting('aimAssist')                          → boolean (default true)
//   setSetting('tracers', false)                     → persists + notifies subscribers
//   const off = onSetting('aimAssist', (v) => …)     → unsubscribe; fn is NOT called immediately
//
// localStorage is wrapped in try/catch (iOS private mode throws on write) — the in-memory copy is the truth for the session.
export type SettingKey = 'aimAssist' | 'tracers';

const STORE = 'ws.settings.v1';
const DEFAULTS: Record<SettingKey, boolean> = { aimAssist: true, tracers: true };

function load(): Record<SettingKey, boolean> {
  const out = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<SettingKey, unknown>>;
      for (const k of Object.keys(DEFAULTS) as SettingKey[]) if (typeof parsed[k] === 'boolean') out[k] = parsed[k] as boolean;
    }
  } catch { /* private mode / disabled storage: defaults */ }
  return out;
}

const state = load();
const listeners = new Map<SettingKey, Set<(v: boolean) => void>>();

export function getSetting(k: SettingKey): boolean { return state[k]; }

export function setSetting(k: SettingKey, v: boolean): void {
  if (state[k] === v) return;
  state[k] = v;
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* not persisted this session */ }
  listeners.get(k)?.forEach((fn) => fn(v));
}

export function onSetting(k: SettingKey, fn: (v: boolean) => void): () => void {
  let set = listeners.get(k);
  if (!set) { set = new Set(); listeners.set(k, set); }
  set.add(fn);
  return () => { set!.delete(fn); };
}
