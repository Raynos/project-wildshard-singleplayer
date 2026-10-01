/**
 * The DEBUG menu's registry (E162, Jake 2026-09-25: "we are going to have an ungodly amount of toggles and we need to
 * organize them"). Every variant, taste toggle and developer aid the game has is declared here ONCE — its group, label,
 * choices, whether it applies live or reloads the page, the shards it applies to and a one-line note with its ask id.
 * pause ▸ Settings ▸ Debug (src/engine/ui/DebugMenu.ts) renders it: one collapsible section per group, only the rows that apply to
 * the shard you are in, a filter box on top. There are no URL switches (AGENTS.md "No URL switches, ever").
 *
 *   opt('pineLife', 'creatures', 'Pine Hollow life', ON_OFF, { reload: true, when: pineHollow, ask: 'E162', reviewBy: '2026-12-30', note: 'birds, hares …' })
 *   action('clearDownloads', 'loading', 'Downloads', 'Clear', () => …, { ask: 'E172', reviewBy: '2026-12-30', note: 'E172 …' })   // a button row, not a pick
 *   DEBUG_READOUTS        → a live readout under a row, by row id (E172: Shards in memory's; both menus show it)
 *   DEBUG_ROWS            → every row, in menu order within its group
 *   DEBUG_GROUPS          → the groups, in menu order (never add one without need: a row belongs in an existing group)
 *
 * A row reads a saved option (src/engine/ui/Settings.ts OPTION_VALUES / OPTION_SPECS with `params: []`): the game reads it with
 * `setting(key)` (at load for a `reload` row) and `onSettingChange(key, fn)` (a live row).
 */
import type { ShardManifest } from '#game/shard/manifest';
import { jsonSlot } from '../saves/slots';
import { texMode } from '../boot/gpuFiles';
import { clearDownloads, freedBytes, lastClear, mbText, storageUsed } from '../boot/clearDownloads';
import { RELOAD_PARAM } from '../core/GpuRecovery';
import { shardMemory } from '#game';
import { lastEndLine, markUnload } from '../boot/lastEnd';
import { getMusicStyle, getSfxSet, onMusicStyle, onSettingChange, onSfxSet, saveSetting, setMusicStyle, setSfxSet, setting, settingsReloadUrl, MUSIC_STYLES, SFX_SETS, type MusicStyle, type OptionKey, type OptionValue, type SfxSet } from './Settings';
import { MOBILE_DEVICE } from '../core/tier';
import type { DebugRowSpec } from '../level/context';

/** what "applies" reads: the shard you are in and the weapons you hold (re-read every time the menu opens) */
export interface DebugCtx { chunk: ShardManifest; weapons: ReadonlySet<string> }
type When = (c: DebugCtx) => boolean;

export type DebugGroupId = 'look' | 'cover' | 'sky' | 'audio' | 'combat' | 'creatures' | 'perf' | 'loading' | 'tools';
export interface DebugGroup { id: DebugGroupId; label: string; note?: string }
/** the groups, in menu order. Never add a group without need: put a new row in the group whose domain it is (lighting,
 *  shadows and post go in Look; water in Look too). A group with no row fails test/debug-options.test.ts. */
export const DEBUG_GROUPS: readonly DebugGroup[] = [
  { id: 'look', label: 'Look' },
  { id: 'sky', label: 'Sky & weather' },
  { id: 'audio', label: 'Audio' },
  { id: 'combat', label: 'Combat & weapons' },
  { id: 'creatures', label: 'Creatures & NPCs' },
  { id: 'perf', label: 'Performance' },
  { id: 'loading', label: 'Loading & memory' },
  { id: 'tools', label: 'Developer tools' },
];

export interface DebugChoice { v: string; text: string }
export interface DebugRow {
  /** unique; the option key for an option row */
  id: string;
  group: DebugGroupId;
  label: string;
  /** a function: a choice's text may say what is live now (GPU textures: "Auto · now KTX2") */
  choices: () => readonly DebugChoice[];
  get: () => string;
  set: (v: string) => void;
  /** subscribe to outside changes (repaints the row); may do nothing */
  on: (fn: () => void) => void;
  /** a pick saves, then reloads the page (the thing is built once) */
  reload: boolean;
  /** shown only where this holds (the shard, the weapons) */
  when: When;
  /** one line: what it switches and the ask it came from */
  note: string;
  ask: `E${number}`;
  reviewBy: string;
  /** a button row (a one-shot: clear a cache, spawn something) instead of a pick; `choices` is empty */
  action?: DebugActionSpec;
}

const authoredRows = new Set<DebugRow>();
/** A level owns its debug choices and their inverse; menus resolve the live catalog when opened. */
export function registerLevelDebugRow(spec: DebugRowSpec, slug: string): () => void {
  const saved = jsonSlot(`debug.plugin.${slug}.${spec.id}`, 'device');
  const value = saved.read();
  let current = typeof value === 'string' && spec.choices.some((choice) => choice.value === value) ? value : spec.initial;
  let live = true;
  const listeners = new Set<() => void>();
  const row: DebugRow = { id: spec.id, group: spec.group, label: spec.label, note: spec.note, ask: spec.ask, reviewBy: spec.reviewBy, reload: spec.reload ?? false,
    choices: () => spec.choices.map((choice) => ({ v: choice.value, text: choice.text })), get: () => current,
    set: (next) => {
      if (!live || !spec.choices.some((choice) => choice.value === next)) return;
      current = next; saved.write(next); spec.change(next); for (const listener of listeners) listener();
    }, on: (listener) => { if (live) listeners.add(listener); }, when: (ctx) => ctx.chunk.slug === slug };
  authoredRows.add(row);
  if (current !== spec.initial) spec.change(current);
  return () => { live = false; authoredRows.delete(row); listeners.clear(); };
}

// ── the shards ──
const pineHollow: When = (c) => c.chunk.slug === 'pine-hollow';
const nalati: When = (c) => c.chunk.slug === 'nalati-grasslands';
const always: When = () => true;

interface RowOpts { reload?: boolean; when?: When; note: string; ask: `E${number}`; reviewBy: string }
/** a row over a saved option (Settings.ts OPTION_VALUES): `choices` pairs each value with its button text */
export function opt<K extends OptionKey>(key: K, group: DebugGroupId, label: string, choices: readonly (readonly [OptionValue<K>, string])[], o: RowOpts): DebugRow {
  const list = choices.map(([v, text]) => ({ v, text }));
  return {
    id: key, group, label, choices: () => list, reload: o.reload ?? false, when: o.when ?? always, note: o.note, ask: o.ask, reviewBy: o.reviewBy,
    get: () => setting(key),
    set: (s) => { const hit = choices.find(([v]) => v === s); if (hit) saveSetting(key, hit[0]); },
    on: (fn) => { onSettingChange(key, () => { fn(); }); },
  };
}
/**
 * A button row's action. `run` may report through `say(button, status)` (the button's text, the line under the row).
 * E172: `confirm` makes it two taps — the first shows what `confirm()` returns ("Tap again to clear ~158 MB", it may
 * measure first), a second within a few seconds runs it, else it disarms; `status()` is the line under the row at rest.
 */
export interface DebugActionSpec {
  text: string;
  run: (say: (button: string, status: string) => void) => void | Promise<void>;
  confirm?: () => Promise<string>;
  status?: () => string;
}
/** a button row: `text` on the button, `run` on a tap (the button disables until a returned promise settles); `more`:
 *  the two-tap confirm and the status line (E172) */
export function action(id: string, group: DebugGroupId, label: string, text: string, run: DebugActionSpec['run'], o: RowOpts, more: Pick<DebugActionSpec, 'confirm' | 'status'> = {}): DebugRow {
  return {
    id, group, label, choices: () => [], reload: o.reload ?? false, when: o.when ?? always, note: o.note, ask: o.ask, reviewBy: o.reviewBy,
    get: () => '', set: () => undefined, on: () => undefined, action: { text, run, ...more },
  };
}
const ON_OFF = [['on', 'On'], ['off', 'Off']] as const;

/** params that skip the title (dev / deep links): a reload meant to land on the title drops them (the title's Apply &
 *  reload, src/engine/ui/BootSettings.ts; Clear downloads) */
export const TITLE_SKIPPERS = ['skipintro', 'tour', 'explore', 'cam', 'model', 'at', RELOAD_PARAM, 'v'];

/** E172 (the user: "I need a button to nuke the cache so i can test it"): every downloaded file gone, the saves kept
 *  (src/engine/boot/clearDownloads.ts), then a reload to the title like a fresh launch — the running shard's ?chunk= stays */
const CLEAR_IDLE = 'Deletes the downloaded game files (every cache and the service worker) so the next load is a first visit. Keeps saves, settings and the review login.';
const clearDownloadsRow = action('clearDownloads', 'loading', 'Clear downloads', 'Clear downloads', async (say) => {
  say('Clearing…', CLEAR_IDLE);
  const r = await clearDownloads();
  const freed = freedBytes(r);
  say(freed === null ? 'Cleared · reloading' : `Freed ${mbText(freed)} · reloading`,
    `${mbText(freed)} of downloads · ${r.caches} caches and ${r.workers} worker${r.workers === 1 ? '' : 's'} removed${r.httpCache ? ', HTTP cache cleared' : ''}. Reloading as a first visit.`);
  window.setTimeout(() => { markUnload('debug: clear downloads'); location.replace(settingsReloadUrl(location.href, TITLE_SKIPPERS)); }, 1500);
}, { ask: 'E172', reviewBy: '2026-12-30', note: 'E172 · the next load is a true cold load (bytes as a first visit)' }, {
  confirm: async () => { const used = await storageUsed(); return used === null ? 'Tap again to clear' : `Tap again to clear ~${mbText(used)}`; },
  status: () => {
    const last = lastClear(); // this page is the reload the last clear made: say what it freed
    return last === null ? CLEAR_IDLE : `Last clear freed ${mbText(freedBytes(last))} (${last.caches} caches, ${last.workers} worker${last.workers === 1 ? '' : 's'}). ${CLEAR_IDLE}`;
  },
});
const TIMES = [['live', 'Live'], ['midday', 'Midday'], ['golden', 'Golden'], ['sunset', 'Sunset'], ['night', 'Night']] as const;

const MUSIC_TEXT: Record<MusicStyle, string> = { piano: 'Piano', orchestral: 'Orchestral', folk: 'Folk', synth: 'Synth' };
const SFX_TEXT: Record<SfxSet, string> = { best: 'Generated', synth: 'Synth' };

export const DEBUG_ROWS: readonly DebugRow[] = [
  // ── Look ──
  opt('titleSummary', 'look', 'Title progress summary', [['a', 'A · ledger'], ['b', 'B · split ledger']], { ask: 'E357', reviewBy: '2026-12-30', note: 'E357 X9 · title-deck Wildshard summary; Look board A / B' }),
  opt('learnedLut', 'look', 'Learned LUT', ON_OFF, { reload: true, ask: 'E85', reviewBy: '2026-12-30', note: 'E85 · off = the captures scripts/fit-lut.py fits from (was ?nolut)' }),

  // ── Sky & weather ──
  // Authored clocks and weather opt in through level mechanisms.
  opt('time', 'sky', 'Time of day', TIMES, { when: (c) => c.chunk.uses?.includes('dayCycle') === true, ask: 'E55', reviewBy: '2026-12-30', note: 'E55 · hold the day clock at one time' }),
  opt('weather', 'sky', 'Weather', [['live', 'Live'], ['clear', 'Clear'], ['fog', 'Fog'], ['rain', 'Rain']], { when: (c) => c.chunk.uses?.includes('weather') === true, ask: 'E357', reviewBy: '2026-12-30', note: 'E357 S2.4 · live = authored weather; clear = dry; fog / rain hold a phase' }),
  opt('clockSpeed', 'sky', 'Clock speed', [['1', '1×'], ['10', '10×'], ['60', '60×']], { when: nalati, ask: 'E162', reviewBy: '2026-12-30', note: 'Nalati\'s day clock (was ?timescale)' }),

  // ── Audio: the score's source and the sound effects (Settings musicStyle / sfxSet) ──
  {
    id: 'musicStyle', group: 'audio', label: 'Music style', reload: false, when: always, ask: 'E5', reviewBy: '2026-12-30', note: 'music v3 · the MiniMax-Music3 scores or the v1 synth',
    choices: () => MUSIC_STYLES.map((v) => ({ v, text: MUSIC_TEXT[v] })), get: getMusicStyle,
    set: (s) => { const v = MUSIC_STYLES.find((x) => x === s); if (v) setMusicStyle(v); }, on: (fn) => { onMusicStyle(() => { fn(); }); },
  },
  {
    id: 'sfxSet', group: 'audio', label: 'Sound effects', reload: false, when: always, ask: 'E5', reviewBy: '2026-12-30', note: 'the generated set (MOSS v2 + Stable Audio 3) or all synth',
    choices: () => SFX_SETS.map((v) => ({ v, text: SFX_TEXT[v] })), get: getSfxSet,
    set: (s) => { const v = SFX_SETS.find((x) => x === s); if (v) setSfxSet(v); }, on: (fn) => { onSfxSet(() => { fn(); }); },
  },

  opt('pineScore', 'audio', 'Pine Hollow score', [['auto', 'Auto'], ['night', 'Night'], ['boss', 'Boss I'], ['boss-2', 'Boss II'], ['boss-3', 'Boss III'], ['dawn', 'Dawn']], { reload: true, when: pineHollow, ask: 'E5', reviewBy: '2026-12-30', note: 'PH-A1 · hold a scene / boss phase, or the dawn sting (was ?music=pine-*)' }),

  // ── Combat & weapons ──
  opt('aimRing', 'combat', 'Aim assist ring', [['off', 'Off'], ['on', 'On']], { ask: 'E162', reviewBy: '2026-12-30', note: 'the aim-assist bubble on screen, with its angle and snap (was ?aimdebug)' }),

  // ── Creatures & NPCs ──
  opt('creatures', 'creatures', 'Creatures', [['models', 'Models'], ['proc', 'Procedural']], { reload: true, when: (c) => pineHollow(c) || nalati(c), ask: 'E136', reviewBy: '2026-12-30', note: 'PH-U11 / E136 · models picked; procedural = what the rig bakes need' }),
  opt('pineLife', 'creatures', 'Pine Hollow life', ON_OFF, { reload: true, when: pineHollow, ask: 'E162', reviewBy: '2026-12-30', note: 'birds, hares, ravens, the skinning beat (was ?life=0)' }),
  opt('balbals', 'creatures', 'Balbal warriors', [['auto', 'At dusk'], ['wake', 'Wake now'], ['off', 'Never']], { reload: true, when: nalati, ask: 'E162', reviewBy: '2026-12-30', note: 'B11 · the statues that wake at night (was ?balbals)' }),
  opt('ghosts', 'creatures', 'Ghost riders', [['auto', 'At night'], ['line', 'Any hour'], ['off', 'Never']], { reload: true, when: nalati, ask: 'E162', reviewBy: '2026-12-30', note: 'B11 · the night riders (was ?ghosts)' }),

  // ── Performance ──
  opt('fps', 'perf', 'Frame cap', [['auto', 'Auto'], ['30', '30'], ['60', 'Uncapped']], { when: () => !MOBILE_DEVICE, ask: 'E193', reviewBy: '2026-12-30', note: 'E193 · desktop only: mobile is locked at 30 · auto = the display\'s rate' }),
  opt('showHiddenShards', 'tools', 'Hidden shards', ON_OFF, { ask: 'E357', reviewBy: '2026-12-30', note: 'E357 F9 · show hidden manifest cards' }),
  opt('loadProfile', 'perf', 'Load profiling', [['off', 'Off'], ['on', 'On']], { reload: true, ask: 'E162', reviewBy: '2026-12-30', note: 'load-perf · logs every shader program the load builds (window.__perfload)' }),

  // ── Loading & memory ──
  {
    ...opt('tex', 'loading', 'GPU textures', [['auto', 'Auto'], ['ktx2', 'KTX2'], ['img', 'Images']], { reload: true, ask: 'E157', reviewBy: '2026-12-30', note: 'E157 · KTX2 stays compressed on the GPU; auto = images until the set is cached' }),
    choices: () => [{ v: 'auto', text: `Auto · now ${texMode() === 'ktx2' ? 'KTX2' : 'Images'}` }, { v: 'ktx2', text: 'KTX2' }, { v: 'img', text: 'Images' }],
  },
  opt('prefetch', 'loading', 'Download in background', ON_OFF, { ask: 'E158', reviewBy: '2026-12-30', note: 'E158 · the other shards\' files, once this one is playable' }),
  opt('bootPack', 'loading', 'Boot pack', ON_OFF, { reload: true, ask: 'E162', reviewBy: '2026-12-30', note: 'boot files as one pack; off = one by one (the KTX2 record run)' }),
  { id: 'storage', group: 'loading', label: 'Storage', choices: () => [], get: () => '', set: () => undefined, on: () => undefined, reload: false, when: always, ask: 'E357', reviewBy: '2026-12-30', note: 'E357 F10 · persistent storage and origin usage' },
  clearDownloadsRow,

  // ── Developer tools ──
  { ...action('calibrate', 'tools', 'Calibration', 'RUN CALIBRATION', () => { saveSetting('calibrate', 'run'); location.reload(); }, { ask: 'E357', reviewBy: '2026-12-30', note: 'E357 S1.6 · synthetic M5 unit costs; consumes the one-shot setting at entry' }), choices: () => [{ v: 'off', text: 'Idle' }, { v: 'run', text: 'Run' }] },
  action('budgetReadout', 'perf', 'Calibrated budgets', 'READ BUDGETS', (say) => {
    if (!Object.hasOwn(window, '__wildshard')) { say('READ BUDGETS', 'Enter a level to read its budgets.'); return; }
    const rows = window.__wildshard.budgets(['current']), current = rows['current'];
    say('READ BUDGETS', current ? `${JSON.stringify(current.derived ?? current.ceiling)} · ${current.formula.assumption}` : 'F2 ceilings and stable M5 calibration are not published yet.');
  }, { ask: 'E357', reviewBy: '2026-12-30', note: 'E357 S1.6 · derived targets, current enforced ceilings and the phone:M5 assumption' }),
  opt('cragView', 'tools', 'Crag channel', [['shaded', 'Shaded'], ['ao', 'AO'], ['sun', 'Sun'], ['wet', 'Wet'], ['normal', 'Normal'], ['albedo', 'Albedo']], { when: pineHollow, ask: 'E162', reviewBy: '2026-12-30', note: 'PH-U31 · the crags drawn as one channel (was ?cragdebug)' }),
];

/** Shards in memory's readout (E155 / E159): the resident shards, their texture estimate, the JS heap, the device's
 *  memory and the last reload's cause (E179) — read on the device (the iPhone has no dev tools) */
function memoryReadout(): string {
  const m = shardMemory();
  // Chrome's performance.memory / navigator.deviceMemory: absent on iOS (and not in the DOM typings)
  const pm: unknown = Reflect.get(performance, 'memory'), used: unknown = typeof pm === 'object' && pm !== null ? Reflect.get(pm, 'usedJSHeapSize') : undefined;
  const dm: unknown = Reflect.get(navigator, 'deviceMemory');
  const heap = typeof used === 'number' ? `${Math.round(used / 1e6)} MB` : 'n/a';
  const shards = m === null ? ['no shard host'] : m.shards.map((x, i) => `${i + 1}. ${x.slug}${x.running ? ' (playing)' : ''} · textures ~${Math.round(x.textureMB)} MB`);
  // E179: why the page last reloaded (src/engine/boot/lastEnd.ts: the reason the game gave, or "ended unexpectedly")
  return [`Resident (oldest first, keeps ${m?.cap ?? '?'}):`, ...shards, `JS heap: ${heap} · device memory: ${typeof dm === 'number' ? `${dm} GB` : 'n/a'}`, lastEndLine()].join('\n');
}
/** E172: a few live lines under a row (by row id), re-read while the row can be seen — in both menus */
export const DEBUG_READOUTS: Readonly<Partial<Record<string, () => string>>> = { tex: memoryReadout, storage: storageReadout };

let storageEstimate = 'usage / quota: checking';
let estimateAt = 0;
function storageReadout(): string {
  if (Date.now() - estimateAt > 10_000) {
    estimateAt = Date.now();
    try { void navigator.storage.estimate().then((value) => { storageEstimate = `${mbText(value.usage ?? null)} / ${mbText(value.quota ?? null)}`; return undefined; }).catch(() => { storageEstimate = 'usage / quota: unavailable'; }); }
    catch { storageEstimate = 'usage / quota: unavailable'; }
  }
  return `Persisted: ${jsonSlot('storage.persisted', 'device').read() === true ? 'yes' : 'no'} · ${storageEstimate}`;
}

export function levelDebugRows(): readonly DebugRow[] { return [...DEBUG_ROWS, ...authoredRows]; }
