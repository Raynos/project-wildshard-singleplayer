// src/ui/Settings.ts — persisted player toggles + sliders (localStorage 'ws.settings.v1'); the menu's Settings tab (src/ui/Menu.ts) writes here.
//
//   getSetting('aimAssist')                          → boolean (default true)
//   setSetting('tracers', false)                     → persists + notifies subscribers
//   const off = onSetting('aimAssist', (v) => …)     → unsubscribe; fn is NOT called immediately
//   getNumber('volume') / setNumber('volume', 0.8) / onNumber('volume', fn)   → the sliders, clamped to NUM_RANGE: 0..1 volumes
//   (master, 'music' = the score's bus) and the 0.5..2× look multipliers ('look' = touch drag + mouse, 'swingLook' = extra
//   factor while a sword swing is running — TouchControls / Player.ts read them per event, nothing to subscribe)
//   getMusicStyle() / setMusicStyle('orchestral') / onMusicStyle(fn)   → the score's source (project/archive/2026-09-23-music.md v3):
//   'piano' | 'orchestral' | 'folk' (MiniMax-Music3 stems) | 'synth' (the v1 WebAudio score); default 'piano'.
//   `?music=<style>` in the URL overrides it for the page's life without persisting it.
//   getSfxSet() / setSfxSet('synth') / onSfxSet(fn)   → the sound effects: 'best' (the generated set, public/assets/sfx/best/
//   sfx.json — per sound the better take of MOSS-SoundEffect v2 and Stable Audio 3 Medium, AGENTS.md "Audio engines") | 'synth'
//   (every sound synthesised); default 'best'. A saved set that no longer exists (moss, sa3-medium, ezaudio) reads as 'best';
//   `?sfx=synth` overrides like ?music=.
//
//
// The OPTIONS (E55) — every player-facing toggle that used to be a query param, one lookup for all of them:
//   setting('island')                  → the value THIS page runs with: the URL's param when present (the agents' screenshot
//                                        harnesses depend on it), else the saved pick, else the default
//   savedSetting('island') / saveSetting('island', 'blender') / onSettingChange('matte', fn)
//   BOOT_OPTIONS (renderer, island, quality tier, touch) are read once while the page loads: saving one changes only the
//   saved pick — main menu ▸ Settings (src/ui/BootSettings.ts) shows them with APPLY & RELOAD (settingsReloadUrl drops
//   the overriding params so the reload builds the saved pick). The rest are LIVE (pause menu ▸ Settings, src/ui/Menu.ts):
//   saving one changes setting() at once and notifies (main.ts hands it to HorizonMatte.setShown / DayNight.setTime).
//
// localStorage is wrapped in try/catch (iOS private mode throws on write) — the in-memory copy is the truth for the session.
export type SettingKey = 'aimAssist' | 'tracers' | 'haptics' | 'autoLock';
export type NumberKey = 'volume' | 'music' | 'look' | 'swingLook' | 'lockCam';
export const MUSIC_STYLES = ['piano', 'orchestral', 'folk', 'synth'] as const;
export type MusicStyle = (typeof MUSIC_STYLES)[number];
export const SFX_SETS = ['best', 'synth'] as const;
export type SfxSet = (typeof SFX_SETS)[number];

const STORE = 'ws.settings.v1';
const DEFAULTS: Record<SettingKey, boolean> = { aimAssist: true, tracers: true, haptics: true, autoLock: true }; // autoLock: a kill re-locks the next enemy (E50)
const NUM_DEFAULTS: Record<NumberKey, number> = { volume: 0.8, music: 0.7, look: 1, swingLook: 0.7, lockCam: 0.5 }; // lockCam: the lock-on camera, Follow 1 / Gentle 0.5 / Off 0 (E50: Jake picked Gentle)
export const NUM_RANGE: Record<NumberKey, readonly [number, number]> = { volume: [0, 1], music: [0, 1], look: [0.5, 2], swingLook: [0.5, 2], lockCam: [0, 1] };
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

/** a pick among fixed strings (the music style, the sfx set, the OPTIONS): saved under `key`, overridable by the URL for the
 *  page's life — the URL value wins until the player picks in the menu, and is never persisted on its own. A `boot` pick
 *  only changes what is saved: `value` stays what the page was built with until the reload. */
class Choice<T extends string> {
  value: T; stored: T;
  /** the URL set `value` for this load */
  readonly fromUrl: boolean;
  readonly listeners = new Set<(v: T) => void>();
  // plain fields, not constructor parameter properties: node's type stripping (the boot-pack bake imports this module
  // through the boot manifest) can't load parameter properties
  readonly key: string;
  readonly values: readonly T[];
  readonly boot: boolean;
  constructor(key: string, values: readonly T[], fallback: T, url: (q: URLSearchParams) => string | null, boot = false) {
    this.key = key; this.values = values; this.boot = boot;
    this.stored = this.valid(saved[key]) ?? fallback;
    let u: T | undefined;
    try { u = this.valid(url(new URLSearchParams(location.search))); } catch { u = undefined; }
    this.fromUrl = u !== undefined;
    this.value = u ?? this.stored;
  }
  valid(v: unknown): T | undefined { return this.values.find((x) => x === v); }
  set(v: T): void {
    if (this.valid(v) === undefined) return;
    if (this.boot) {
      if (this.stored === v) return;
      this.stored = v;
      persist();
      this.listeners.forEach((fn) => fn(v));
      return;
    }
    if (this.value === v && this.stored === v) return;
    const changed = this.value !== v;
    this.value = v; this.stored = v;
    persist();
    if (changed) this.listeners.forEach((fn) => fn(v));
  }
  on(fn: (v: T) => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
}
const musicStyle = new Choice<MusicStyle>('musicStyle', MUSIC_STYLES, 'piano', (q) => q.get('music'));
const sfxSet = new Choice<SfxSet>('sfxSet', SFX_SETS, 'best', (q) => q.get('sfx'));

// ── the OPTIONS (E55): the player-facing toggles that were query params — see the header ──
export const OPTION_VALUES = {
  gpu: ['webgl', 'webgpu', 'webgpu-gl'],               // renderer (src/gpu/flag.ts) — experimental
  island: ['procedural', 'blender'],                   // Driftwood's spawn cove (src/world/blenderArea.ts) — experimental
  tier: ['auto', 'phone', 'desktop'],                  // quality tier (src/core/tier.ts); auto = phone on a mobile UA
  touch: ['auto', 'on'],                               // on-screen controls (main.ts → TouchControls): auto = coarse pointer
  matte: ['on', 'off'],                                // the painted horizon (src/world/HorizonMatte.ts) — locked on (E78): only ?matte=0 reads it
  time: ['live', 'midday', 'golden', 'sunset', 'night'], // the day / night clock (src/world/DayNight.ts) — live
  lut: ['on', 'off'],                                  // the learned colour LUT (src/world/lut.ts, Game.buildComposer) — locked on (E85): only ?nolut reads it
  // Look Lab (E65): the remaster's TASTE axes, each keeping the pre-remaster look selectable — the user picks, not us
  lighting: ['toon', 'standard'],                      // Driftwood: the toon ramp (src/world/stylize.ts, L1) — locked in (E87, the user's pick); only ?lighting=standard reads it
  sky: ['stylized', 'hdri'],                           // Driftwood: the gradient dome + faceted cumulus (L2) — locked in (E83, the user's pick); only ?sky=hdri reads it
  post: ['clean', 'cinematic'],                        // Driftwood: the clean low-poly post (L5) — locked in (E88, the user's pick); only ?post=cinematic reads it
  pinesky: ['clock', 'sunset'],                        // Pine Hollow: the day / night clock (PH-L2, src/world/PineDayNight.ts) or the pre-remaster fixed HDRI sunset — Jake picks (a reload)
} as const;
export type OptionKey = keyof typeof OPTION_VALUES;
export type OptionValue<K extends OptionKey> = (typeof OPTION_VALUES)[K][number];
/** read once while the page loads: main menu ▸ Settings, APPLY & RELOAD. Every other option applies live (pause menu). */
export const BOOT_OPTIONS: readonly OptionKey[] = ['gpu', 'island', 'tier', 'touch'];
const onOff = (v: string | null): 'on' | 'off' | null => (v === null ? null : v === '0' || v === 'off' || v === 'false' ? 'off' : 'on');
/** per option: the default, the URL params that override it (dropped by settingsReloadUrl) and how they read */
const OPTION_SPECS: { [K in OptionKey]: { def: OptionValue<K>; params: readonly string[]; url: (q: URLSearchParams) => string | null } } = {
  gpu: { def: 'webgl', params: ['gpu'], url: (q) => { const v = q.get('gpu'); return v === null ? null : v === 'webgpu' || v === 'webgpu-gl' ? v : 'webgl'; } },
  island: { def: 'blender', params: ['island'], url: (q) => q.get('island') },              // the user's pick for v0.2 (E7): the Blender cove by default
  tier: { def: 'auto', params: ['tier'], url: (q) => q.get('tier') },
  touch: { def: 'auto', params: ['touch'], url: (q) => (q.has('touch') ? 'on' : null) },               // ?touch (any value) forces them, as before
  matte: { def: 'on', params: ['matte'], url: (q) => onOff(q.get('matte')) },                           // ?matte=0: the before / after captures
  time: { def: 'live', params: ['tod', 'clock'], url: (q) => (q.has('tod') || q.has('clock') ? 'live' : null) }, // ?tod= / ?clock= run the clock from the URL's phase / speed
  lut: { def: 'on', params: ['nolut'], url: (q) => (q.has('nolut') ? 'off' : null) },                   // ?nolut: the LUT fit's own captures (scripts/fit-lut.py)
  lighting: { def: 'toon', params: ['lighting'], url: (q) => q.get('lighting') },
  sky: { def: 'stylized', params: ['sky'], url: (q) => q.get('sky') },
  post: { def: 'clean', params: ['post'], url: (q) => q.get('post') },
  pinesky: { def: 'clock', params: ['pinesky'], url: (q) => (q.get('tod') === 'sunset-fixed' ? 'sunset' : q.get('pinesky')) }, // ?tod=sunset-fixed: the before shots
};
// Settings ▸ Graphics ▸ Island (X2) saved under its own key before E55: carried over once
if (saved['island'] === undefined) { try { const legacy = localStorage.getItem('ws.island.v1'); if (legacy !== null) saved['island'] = legacy; } catch { /* private mode */ } }
const option = <K extends OptionKey>(k: K): Choice<OptionValue<K>> => new Choice<OptionValue<K>>(k, OPTION_VALUES[k], OPTION_SPECS[k].def, OPTION_SPECS[k].url, BOOT_OPTIONS.includes(k));
const options: { [K in OptionKey]: Choice<OptionValue<K>> } = {
  gpu: option('gpu'), island: option('island'), tier: option('tier'), touch: option('touch'), matte: option('matte'), time: option('time'), lut: option('lut'),
  lighting: option('lighting'), sky: option('sky'), post: option('post'), pinesky: option('pinesky'),
};
const OPTION_KEYS = Object.keys(OPTION_VALUES) as OptionKey[];

/** the value this page runs with: the URL's param if present, else the saved pick, else the default */
export function setting<K extends OptionKey>(k: K): OptionValue<K> { return options[k].value; }
/** the player's saved pick (what the next load builds when the URL does not override it) */
export function savedSetting<K extends OptionKey>(k: K): OptionValue<K> { return options[k].stored; }
/** save a pick: a live option applies at once (subscribers fire), a boot option only on the next load */
export function saveSetting<K extends OptionKey>(k: K, v: OptionValue<K>): void { options[k].set(v); }
/** fires on a live option's change, and with the new saved pick for a boot option; not called immediately */
export function onSettingChange<K extends OptionKey>(k: K, fn: (v: OptionValue<K>) => void): () => void { return options[k].on(fn); }
/** the URL overrides this option for this load (the menus say so) */
export function settingFromUrl(k: OptionKey): boolean { return options[k].fromUrl; }
/** the URL params that override option `k` */
export function settingParams(k: OptionKey): readonly string[] { return OPTION_SPECS[k].params; }
/** boot options whose saved pick differs from what this page was built with */
export function pendingReload(): OptionKey[] { return BOOT_OPTIONS.filter((k) => options[k].stored !== options[k].value); }
/** `href` without any param that overrides an option (and the music / sfx picks) nor the `extra` ones: APPLY & RELOAD
 *  loads this, so the saved picks win (the chunk and every other dev param stay) */
export function settingsReloadUrl(href: string, extra: readonly string[] = []): string {
  const u = new URL(href);
  for (const p of [...OPTION_KEYS.flatMap((k) => OPTION_SPECS[k].params), 'music', 'sfx', ...extra]) u.searchParams.delete(p);
  return u.toString();
}
const listeners = new Map<SettingKey, Set<(v: boolean) => void>>();
const numListeners = new Map<NumberKey, Set<(v: number) => void>>();
function persist() {
  const picks: Partial<Record<string, string>> = {};
  for (const k of OPTION_KEYS) picks[k] = options[k].stored;
  try { localStorage.setItem(STORE, JSON.stringify({ ...state, ...nums, musicStyle: musicStyle.stored, sfxSet: sfxSet.stored, ...picks })); } catch { /* not persisted this session */ }
}

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
