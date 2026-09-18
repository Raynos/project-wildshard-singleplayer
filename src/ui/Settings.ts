// src/ui/Settings.ts — persisted player toggles + sliders (localStorage 'ws.settings.v1'); the menu's Settings tab (src/ui/Menu.ts) writes here.
//
//   getSetting('aimAssist')                          → boolean (default true)
//   setSetting('tracers', false)                     → persists + notifies subscribers
//   const off = onSetting('aimAssist', (v) => …)     → unsubscribe; fn is NOT called immediately
//   getNumber('volume') / setNumber('volume', 0.8) / onNumber('volume', fn)   → the 0..1 sliders (master volume, 'music' = the score's bus)
//
// localStorage is wrapped in try/catch (iOS private mode throws on write) — the in-memory copy is the truth for the session.
export type SettingKey = 'aimAssist' | 'tracers';
export type NumberKey = 'volume' | 'music';

const STORE = 'ws.settings.v1';
const DEFAULTS: Record<SettingKey, boolean> = { aimAssist: true, tracers: true };
const NUM_DEFAULTS: Record<NumberKey, number> = { volume: 0.8, music: 0.7 };

function load(): { bools: Record<SettingKey, boolean>; nums: Record<NumberKey, number> } {
  const bools = { ...DEFAULTS }, nums = { ...NUM_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
      for (const k of Object.keys(DEFAULTS) as SettingKey[]) if (typeof parsed[k] === 'boolean') bools[k] = parsed[k] as boolean;
      for (const k of Object.keys(NUM_DEFAULTS) as NumberKey[]) if (typeof parsed[k] === 'number') nums[k] = parsed[k] as number;
    }
  } catch { /* private mode / disabled storage: defaults */ }
  return { bools, nums };
}

const { bools: state, nums } = load();
const listeners = new Map<SettingKey, Set<(v: boolean) => void>>();
const numListeners = new Map<NumberKey, Set<(v: number) => void>>();
function persist() { try { localStorage.setItem(STORE, JSON.stringify({ ...state, ...nums })); } catch { /* not persisted this session */ } }

export function getSetting(k: SettingKey): boolean { return state[k]; }

export function setSetting(k: SettingKey, v: boolean): void {
  if (state[k] === v) return;
  state[k] = v;
  persist();
  listeners.get(k)?.forEach((fn) => fn(v));
}

export function getNumber(k: NumberKey): number { return nums[k]; }
export function setNumber(k: NumberKey, v: number): void {
  v = Math.min(1, Math.max(0, v));
  if (nums[k] === v) return;
  nums[k] = v;
  persist();
  numListeners.get(k)?.forEach((fn) => fn(v));
}
export function onNumber(k: NumberKey, fn: (v: number) => void): () => void {
  let set = numListeners.get(k);
  if (!set) { set = new Set(); numListeners.set(k, set); }
  set.add(fn);
  return () => { set!.delete(fn); };
}

export function onSetting(k: SettingKey, fn: (v: boolean) => void): () => void {
  let set = listeners.get(k);
  if (!set) { set = new Set(); listeners.set(k, set); }
  set.add(fn);
  return () => { set!.delete(fn); };
}
