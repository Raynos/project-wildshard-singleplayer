// src/ui/Settings.ts — persisted player toggles + sliders (localStorage 'ws.settings.v1'); the menu's Settings tab (src/ui/Menu.ts) writes here.
//
//   getSetting('aimAssist')                          → boolean (default true)
//   setSetting('tracers', false)                     → persists + notifies subscribers
//   const off = onSetting('aimAssist', (v) => …)     → unsubscribe; fn is NOT called immediately
//   getNumber('volume') / setNumber('volume', 0.8) / onNumber('volume', fn)   → the sliders, clamped to NUM_RANGE: 0..1 volumes
//   (master, 'music' = the score's bus) and the 0.5..2× look multipliers ('look' = touch drag + mouse, 'swingLook' = extra
//   factor while a sword swing is running — TouchControls / Player.ts read them per event, nothing to subscribe)
//   getMusicStyle() / setMusicStyle('orchestral') / onMusicStyle(fn)   → the score's source (docs/plans/MUSIC.md v3):
//   'piano' | 'orchestral' | 'folk' (MiniMax-Music3 stems) | 'synth' (the v1 WebAudio score); default 'piano'.
//   `?music=<style>` in the URL overrides it for the page's life without persisting it.
//   getSfxSet() / setSfxSet('ezaudio') / onSfxSet(fn) → the sound-effect samples: 'moss' (MOSS-SoundEffect v2.0) | 'sa3-medium'
//   (Stable Audio 3 Medium) | 'ezaudio' (EzAudio-XL) (public/assets/sfx/<set>/sfx.json) | 'synth' (every sound synthesised);
//   default 'moss' (best CLAP coverage of the three, SFX round 2); `?sfx=<set>` overrides like ?music=.
//
// localStorage is wrapped in try/catch (iOS private mode throws on write) — the in-memory copy is the truth for the session.
export type SettingKey = 'aimAssist' | 'tracers' | 'haptics';
export type NumberKey = 'volume' | 'music' | 'look' | 'swingLook';
export const MUSIC_STYLES = ['piano', 'orchestral', 'folk', 'synth'] as const;
export type MusicStyle = (typeof MUSIC_STYLES)[number];
export const SFX_SETS = ['moss', 'sa3-medium', 'ezaudio', 'synth'] as const;
export type SfxSet = (typeof SFX_SETS)[number];

const STORE = 'ws.settings.v1';
const DEFAULTS: Record<SettingKey, boolean> = { aimAssist: true, tracers: true, haptics: true };
const NUM_DEFAULTS: Record<NumberKey, number> = { volume: 0.8, music: 0.7, look: 1, swingLook: 0.7 };
export const NUM_RANGE: Record<NumberKey, readonly [number, number]> = { volume: [0, 1], music: [0, 1], look: [0.5, 2], swingLook: [0.5, 2] };
const clampNum = (k: NumberKey, v: number) => Math.min(NUM_RANGE[k][1], Math.max(NUM_RANGE[k][0], v));

function load(): { bools: Record<SettingKey, boolean>; nums: Record<NumberKey, number>; parsed: Partial<Record<string, unknown>> } {
  const bools = { ...DEFAULTS }, nums = { ...NUM_DEFAULTS };
  let parsed: Partial<Record<string, unknown>> = {};
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
      for (const k of Object.keys(DEFAULTS) as SettingKey[]) if (typeof parsed[k] === 'boolean') bools[k] = parsed[k];
      for (const k of Object.keys(NUM_DEFAULTS) as NumberKey[]) { const v = parsed[k]; if (typeof v === 'number' && Number.isFinite(v)) nums[k] = clampNum(k, v); }
    }
  } catch { /* private mode / disabled storage: defaults */ }
  return { bools, nums, parsed };
}

const { bools: state, nums, parsed: saved } = load();

/** a pick among fixed strings (the music style, the sfx set): saved under `key`, overridable by `?<param>=` for the page's
 *  life — the URL value wins until the player picks in the menu, and is never persisted on its own */
class Choice<T extends string> {
  value: T; stored: T;
  readonly listeners = new Set<(v: T) => void>();
  constructor(readonly key: string, readonly values: readonly T[], fallback: T, param: string) {
    this.stored = this.valid(saved[key]) ?? fallback;
    let url: T | undefined;
    try { url = this.valid(new URLSearchParams(location.search).get(param)); } catch { url = undefined; }
    this.value = url ?? this.stored;
  }
  valid(v: unknown): T | undefined { return this.values.find((x) => x === v); }
  set(v: T): void {
    if (this.valid(v) === undefined || (this.value === v && this.stored === v)) return;
    const changed = this.value !== v;
    this.value = v; this.stored = v;
    persist();
    if (changed) this.listeners.forEach((fn) => fn(v));
  }
  on(fn: (v: T) => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
}
const musicStyle = new Choice<MusicStyle>('musicStyle', MUSIC_STYLES, 'piano', 'music');
const sfxSet = new Choice<SfxSet>('sfxSet', SFX_SETS, 'moss', 'sfx');
const listeners = new Map<SettingKey, Set<(v: boolean) => void>>();
const numListeners = new Map<NumberKey, Set<(v: number) => void>>();
function persist() { try { localStorage.setItem(STORE, JSON.stringify({ ...state, ...nums, musicStyle: musicStyle.stored, sfxSet: sfxSet.stored })); } catch { /* not persisted this session */ } }

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

export function getMusicStyle(): MusicStyle { return musicStyle.value; }
export function setMusicStyle(v: MusicStyle): void { musicStyle.set(v); }
export function onMusicStyle(fn: (v: MusicStyle) => void): () => void { return musicStyle.on(fn); }
export function getSfxSet(): SfxSet { return sfxSet.value; }
export function setSfxSet(v: SfxSet): void { sfxSet.set(v); }
export function onSfxSet(fn: (v: SfxSet) => void): () => void { return sfxSet.on(fn); }
