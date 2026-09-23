// src/ui/Settings.ts — persisted player toggles + sliders (localStorage 'ws.settings.v1'); the menu's Settings tab (src/ui/Menu.ts) writes here.
//
//   getSetting('aimAssist')                          → boolean (default true)
//   setSetting('tracers', false)                     → persists + notifies subscribers
//   const off = onSetting('aimAssist', (v) => …)     → unsubscribe; fn is NOT called immediately
//   getNumber('volume') / setNumber('volume', 0.8) / onNumber('volume', fn)   → the sliders, clamped to NUM_RANGE: 0..1 volumes
//   (master, 'music' = the score's bus) and the 0.5..2× look multipliers ('look' = touch drag + mouse, 'swingLook' = extra
//   factor while a sword swing is running — TouchControls / Player.ts read them per event, nothing to subscribe)
//
// localStorage is wrapped in try/catch (iOS private mode throws on write) — the in-memory copy is the truth for the session.
export type SettingKey = 'aimAssist' | 'tracers' | 'haptics' | 'huntersEye';
export type NumberKey = 'volume' | 'music' | 'look' | 'swingLook';

const STORE = 'ws.settings.v1';
// huntersEye: the bow's dotted drop arc while drawing (Nalati, src/player/Bow.ts) — on by default on touch, off with a mouse
const DEFAULTS: Record<SettingKey, boolean> = { aimAssist: true, tracers: true, haptics: true, huntersEye: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches };
const NUM_DEFAULTS: Record<NumberKey, number> = { volume: 0.8, music: 0.7, look: 1, swingLook: 0.7 };
export const NUM_RANGE: Record<NumberKey, readonly [number, number]> = { volume: [0, 1], music: [0, 1], look: [0.5, 2], swingLook: [0.5, 2] };
const clampNum = (k: NumberKey, v: number) => Math.min(NUM_RANGE[k][1], Math.max(NUM_RANGE[k][0], v));

function load(): { bools: Record<SettingKey, boolean>; nums: Record<NumberKey, number> } {
  const bools = { ...DEFAULTS }, nums = { ...NUM_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
      for (const k of Object.keys(DEFAULTS) as SettingKey[]) if (typeof parsed[k] === 'boolean') bools[k] = parsed[k];
      for (const k of Object.keys(NUM_DEFAULTS) as NumberKey[]) { const v = parsed[k]; if (typeof v === 'number' && Number.isFinite(v)) nums[k] = clampNum(k, v); }
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
export function setNumber(k: NumberKey, raw: number): void {
  const v = clampNum(k, raw);
  if (nums[k] === v) return;
  nums[k] = v;
  persist();
  numListeners.get(k)?.forEach((fn) => fn(v));
}
export function onNumber(k: NumberKey, fn: (v: number) => void): () => void {
  let set = numListeners.get(k);
  if (!set) { set = new Set(); numListeners.set(k, set); }
  set.add(fn);
  const s = set;
  return () => { s.delete(fn); };
}

export function onSetting(k: SettingKey, fn: (v: boolean) => void): () => void {
  let set = listeners.get(k);
  if (!set) { set = new Set(); listeners.set(k, set); }
  set.add(fn);
  const s = set;
  return () => { s.delete(fn); };
}
