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
//   getSfxSet() / setSfxSet('synth') / onSfxSet(fn)   → the sound effects: 'best' (the generated set, public/assets/sfx/best/
//   sfx.json — per sound the better take of MOSS-SoundEffect v2 and Stable Audio 3 Medium, AGENTS.md "Audio engines") | 'synth'
//   (every sound synthesised); default 'best'. A saved set that no longer exists (moss, sa3-medium, ezaudio) reads as 'best'.
//   Neither has a URL override (E162): pause ▸ Settings ▸ Debug ▸ Audio picks them.
//
//
// The OPTIONS (E55) — every player-facing toggle that used to be a query param, one lookup for all of them:
//   setting('tier')                    → the value THIS page runs with: the URL's param when present (the agents' screenshot
//                                        harnesses depend on it), else the saved pick, else the default
//   savedSetting('tier') / saveSetting('tier', 'phone') / onSettingChange('time', fn)
//   BOOT_OPTIONS (quality tier, touch) are read once while the page loads: saving one changes only the
//   saved pick — main menu ▸ Settings (src/ui/BootSettings.ts) shows them with APPLY & RELOAD (settingsReloadUrl drops
//   the overriding params so the reload builds the saved pick). The rest are LIVE (pause menu ▸ Settings, src/ui/Menu.ts):
//   saving one changes setting() at once and notifies (main.ts hands it to DayNight.setTime).
//   The Look Lab switches the user has picked a winner for are gone (E136: island, edge, lighting, sky, post, lut, matte):
//   a value a player saved for one before is never read, and the next save drops it from localStorage.
//
// localStorage is wrapped in try/catch (iOS private mode throws on write) — the in-memory copy is the truth for the session.
//
// A listener a resident shard adds while it builds or runs is removed when that shard is evicted (src/core/shardScope.ts).
import { onScopeDispose } from '../core/shardScope';

export type SettingKey = 'aimAssist' | 'tracers' | 'haptics' | 'autoLock' | 'huntersEye';
export type NumberKey = 'volume' | 'music' | 'look' | 'swingLook' | 'lockCam';
export const MUSIC_STYLES = ['piano', 'orchestral', 'folk', 'synth'] as const;
export type MusicStyle = (typeof MUSIC_STYLES)[number];
export const SFX_SETS = ['best', 'synth'] as const;
export type SfxSet = (typeof SFX_SETS)[number];

const STORE = 'ws.settings.v1';
// autoLock: a kill re-locks the next enemy (E50); huntersEye: the bow's dotted drop arc while drawing (Nalati, src/player/Bow.ts) — on by default on touch, off with a mouse
const DEFAULTS: Record<SettingKey, boolean> = { aimAssist: true, tracers: true, haptics: true, autoLock: true, huntersEye: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches };
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
  on(fn: (v: T) => void): () => void { this.listeners.add(fn); const off = (): void => { this.listeners.delete(fn); }; onScopeDispose(off); return off; }
}
// no URL override (E162): the Debug ▸ Audio rows pick them; a script saves musicStyle / sfxSet in ws.settings.v1
const musicStyle = new Choice<MusicStyle>('musicStyle', MUSIC_STYLES, 'piano', () => null);
const sfxSet = new Choice<SfxSet>('sfxSet', SFX_SETS, 'best', () => null);

// ── the OPTIONS (E55): the player-facing toggles that were query params — see the header ──
export const OPTION_VALUES = {
  tier: ['auto', 'phone', 'desktop'],                  // quality tier (src/core/tier.ts); auto = phone on a mobile UA
  touch: ['auto', 'on'],                               // on-screen controls (main.ts → TouchControls): auto = coarse pointer
  time: ['live', 'midday', 'golden', 'sunset', 'night'], // the day / night clock (src/world/DayNight.ts) — live
  weather: ['live', 'clear', 'fog', 'rain'],           // Pine Hollow: the weather (PH-L10, src/pinehollow/weather.ts) — live: dawn fog + showers; clear = none (the before); fog / rain hold one — live
  fps: ['auto', '30', '60'],                           // frame cap (Game.start, tier.ts frameCapFps): mobile is locked at 30 whatever the pick (E193); desktop: auto = the display's rate — live
  // Driftwood's ground cover (E156, pause ▸ Settings ▸ Debug ▸ Ground cover; no URL switch — Jake: never): the far ground wearing
  // the cover's colour (coverTint.ts) · plants on slopes kept further out · far plants fading into the ground's colour (E117) — all
  // live · the far stand-ins (a reload: their meshes and caps are built once)
  coverTint: ['on', 'off'],
  coverReach: ['on', 'off'],
  coverBlend: ['on', 'off'],
  coverFar: ['on', 'off', 'far'],
  // E158: download the other shards' files in the background once this one is playable (src/boot/shardPrefetch.ts) — the
  // debug menu only (no URL switch); the bench scripts turn it off through the saved settings
  prefetch: ['on', 'off'],
  // E157: the textures — GPU-compressed KTX2 (ASTC / BC7, src/boot/gpuFiles.ts) or the JPEG / WebP images; 'auto' = images until the shard's KTX2 set is cached, then KTX2 (E157 B).
  // A load-time pick (pause ▸ Settings ▸ Debug saves and reloads); no URL switch (Jake: never) — the A/B scripts set it in
  // the saved settings
  tex: ['auto', 'ktx2', 'img'],
  // E155 / E159: how many built shards stay in memory (src/shard/ShardHost.ts; the user: two) — 1 on a phone that runs short;
  // live: lowering it evicts down at once. The debug menu only (no URL switch)
  shardCap: ['2', '1'],
  // ── E162: the old URL switches, now pause ▸ Settings ▸ Debug rows only (declared with their group in src/ui/debugOptions.ts).
  // The first value is the default. A test / capture script sets one in the saved settings before the page loads ──
  loadProfile: ['off', 'on'],                          // load-path shader instrumentation (src/boot/perflog.ts) — a reload
  bootPack: ['on', 'off'],                             // the shard's boot files as one pack (src/boot/pack.ts); off = one by one (the KTX2 record run) — a reload
  learnedLut: ['on', 'off'],
  cragView: ['shaded', 'ao', 'sun', 'wet', 'normal', 'albedo'], // Pine Hollow's crags drawn as one channel (src/world/PineCrags.ts) — live
  creatures: ['models', 'proc'],                       // Pine Hollow + Nalati: the rigged GLB creatures or the procedural ones (the rig bakes need proc) — a reload
  pineLife: ['on', 'off'],                             // Pine Hollow's birds, hares, ravens and the skinning beat (src/pinehollow/life/) — a reload
  pineScore: ['auto', 'night', 'boss', 'boss-2', 'boss-3', 'dawn'], // Pine Hollow's music held on a scene / boss phase / the dawn sting (src/audio/Music.ts) — a reload
  aimRing: ['off', 'on'],                              // the aim-assist bubble drawn on screen (src/player/AimAssist.ts) — live
  balbals: ['auto', 'wake', 'off'],                    // Nalati's balbal warriors: wake at dusk / at load / never — a reload
  ghosts: ['auto', 'line', 'off'],                     // Nalati's ghost riders: at night / a line at any hour / never — a reload
  clockSpeed: ['1', '10', '60'],                       // Nalati's day clock speed — live                                  // the learned LUT (src/world/lut.ts); off = the captures scripts/fit-lut.py fits from — a reload
  // E174: Driftwood's phone shadow maps (src/world/shadowVariants.ts; debugOptions.ts 'look') — a Today · b Depth only ·
  // c 16-bit depth · d Lean; live. Default c (the user's pick, 2026-09-25)
  dwShadows: ['a', 'b', 'c', 'd'],
} as const;
export type OptionKey = keyof typeof OPTION_VALUES;
export type OptionValue<K extends OptionKey> = (typeof OPTION_VALUES)[K][number];
/** read once while the page loads: main menu ▸ Settings, APPLY & RELOAD. Every other option applies live (pause menu). */
export const BOOT_OPTIONS: readonly OptionKey[] = ['tier', 'touch'];
/** a debug-menu-only option (E162): no URL override; its default is its first value */
const DEBUG_ONLY = { def: null, params: [], url: (): null => null } as const;
/** per option: the default, the URL params that override it (dropped by settingsReloadUrl) and how they read */
const OPTION_SPECS: { [K in OptionKey]: { def: OptionValue<K> | null; params: readonly string[]; url: (q: URLSearchParams) => string | null } } = {
  tier: { def: 'auto', params: ['tier'], url: (q) => q.get('tier') },
  touch: { def: 'auto', params: ['touch'], url: (q) => (q.has('touch') ? 'on' : null) },               // ?touch (any value) forces them, as before
  time: { def: 'live', params: ['tod', 'clock'], url: (q) => (q.has('tod') || q.has('clock') ? 'live' : null) }, // ?tod= / ?clock= run the clock from the URL's phase / speed
  weather: { def: 'live', params: ['weather'], url: (q) => q.get('weather') },                         // ?weather=rain: a held shower (captures)
  fps: { def: 'auto', params: ['fps'], url: (q) => q.get('fps') },                                       // ?fps=60: the phone uncapped (a test); ?fps=30 caps any tier
  coverTint: { def: 'on', params: [], url: () => null }, coverReach: { def: 'on', params: [], url: () => null }, // the debug menu only
  coverBlend: { def: 'on', params: [], url: () => null }, coverFar: { def: 'on', params: [], url: () => null },
  prefetch: { def: 'on', params: [], url: () => null },
  tex: { def: 'auto', params: [], url: () => null },
  shardCap: { def: '1', params: [], url: () => null }, // the user 2026-09-25: 1 by default — iOS evicts a 2-resident page (E179); 2 stays a Debug pick
  loadProfile: DEBUG_ONLY, bootPack: DEBUG_ONLY, learnedLut: DEBUG_ONLY, cragView: DEBUG_ONLY,
  creatures: DEBUG_ONLY, pineLife: DEBUG_ONLY, pineScore: DEBUG_ONLY,
  aimRing: DEBUG_ONLY, balbals: DEBUG_ONLY, ghosts: DEBUG_ONLY, clockSpeed: DEBUG_ONLY,
  dwShadows: { def: 'c', params: [], url: () => null }, // E174: the user picked C (16-bit depth, −120 MB of Driftwood's phone shadow maps)
};
const option = <K extends OptionKey>(k: K): Choice<OptionValue<K>> => {
  const values: readonly OptionValue<K>[] = OPTION_VALUES[k];
  const def = OPTION_SPECS[k].def ?? values[0];
  if (def === undefined) throw new Error(`Settings: option ${k} has no values`);
  return new Choice<OptionValue<K>>(k, values, def, OPTION_SPECS[k].url, BOOT_OPTIONS.includes(k));
};
const options: { [K in OptionKey]: Choice<OptionValue<K>> } = {
  tier: option('tier'), touch: option('touch'), time: option('time'),
  weather: option('weather'), fps: option('fps'),
  coverTint: option('coverTint'), coverReach: option('coverReach'), coverBlend: option('coverBlend'), coverFar: option('coverFar'),
  prefetch: option('prefetch'),
  tex: option('tex'),
  shardCap: option('shardCap'),
  loadProfile: option('loadProfile'), bootPack: option('bootPack'), learnedLut: option('learnedLut'), cragView: option('cragView'),
  creatures: option('creatures'), pineLife: option('pineLife'), pineScore: option('pineScore'),
  aimRing: option('aimRing'), balbals: option('balbals'), ghosts: option('ghosts'), clockSpeed: option('clockSpeed'),
  dwShadows: option('dwShadows'),
};
const OPTION_KEYS = Object.keys(OPTION_VALUES) as OptionKey[];

/** the value this page runs with: the URL's param if present, else the saved pick, else the default */
export function setting<K extends OptionKey>(k: K): OptionValue<K> { return options[k].value; }
/** the player's saved pick (what the next load builds when the URL does not override it) */
export function savedSetting<K extends OptionKey>(k: K): OptionValue<K> { return options[k].stored; }
/** save a pick: a live option applies at once (subscribers fire), a boot option only on the next load */
export function saveSetting<K extends OptionKey>(k: K, v: OptionValue<K>): void { options[k].set(v); }
/**
 * A live option's value for this page only, never saved (src/ui/perfProbe.ts uncaps the frame for its rows); `null`
 * returns it to the saved pick. Subscribers fire on a change.
 */
export function overrideSetting<K extends OptionKey>(k: K, v: OptionValue<K> | null): void {
  const o = options[k];
  if (o.boot) return;
  const next = v ?? o.stored;
  if (o.value === next) return;
  o.value = next;
  o.listeners.forEach((fn) => fn(next));
}
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
  for (const p of [...OPTION_KEYS.flatMap((k) => OPTION_SPECS[k].params), ...extra]) u.searchParams.delete(p);
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
  const off = (): void => { s.delete(fn); };
  onScopeDispose(off);
  return off;
}

export function onSetting(k: SettingKey, fn: (v: boolean) => void): () => void {
  let set = listeners.get(k);
  if (!set) { set = new Set(); listeners.set(k, set); }
  set.add(fn);
  const s = set;
  const off = (): void => { s.delete(fn); };
  onScopeDispose(off);
  return off;
}

export function getMusicStyle(): MusicStyle { return musicStyle.value; }
export function setMusicStyle(v: MusicStyle): void { musicStyle.set(v); }
export function onMusicStyle(fn: (v: MusicStyle) => void): () => void { return musicStyle.on(fn); }
export function getSfxSet(): SfxSet { return sfxSet.value; }
export function setSfxSet(v: SfxSet): void { sfxSet.set(v); }
export function onSfxSet(fn: (v: SfxSet) => void): () => void { return sfxSet.on(fn); }
