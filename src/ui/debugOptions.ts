/**
 * The DEBUG menu's registry (E162, Jake 2026-09-25: "we are going to have an ungodly amount of toggles and we need to
 * organize them"). Every variant, taste toggle and developer aid the game has is declared here ONCE — its group, label,
 * choices, whether it applies live or reloads the page, the shards it applies to and a one-line note with its ask id.
 * pause ▸ Settings ▸ Debug (src/ui/DebugMenu.ts) renders it: one collapsible section per group, only the rows that apply to
 * the shard you are in, a filter box on top. There are no URL switches (AGENTS.md "No URL switches, ever").
 *
 *   opt('coverFar', 'cover', 'Far stand-ins', [['on', 'On'], ['off', 'Off'], ['far', 'Far']], { reload: true, when: driftwood, note: 'E156 …' })
 *   action('clearDownloads', 'loading', 'Downloads', 'Clear', () => …, { note: 'E172 …' })   // a button row, not a pick
 *   DEBUG_ROWS            → every row, in menu order within its group
 *   DEBUG_GROUPS          → the groups, in menu order (never add one without need: a row belongs in an existing group)
 *
 * A row reads a saved option (src/ui/Settings.ts OPTION_VALUES / OPTION_SPECS with `params: []`): the game reads it with
 * `setting(key)` (at load for a `reload` row) and `onSettingChange(key, fn)` (a live row).
 */
import type { ChunkDef } from '../chunks/ChunkDef';
import { texMode } from '../boot/gpuFiles';
import { getMusicStyle, getSfxSet, onMusicStyle, onSettingChange, onSfxSet, saveSetting, setMusicStyle, setSfxSet, setting, MUSIC_STYLES, SFX_SETS, type MusicStyle, type OptionKey, type OptionValue, type SfxSet } from './Settings';

/** what "applies" reads: the shard you are in and the weapons you hold (re-read every time the menu opens) */
export interface DebugCtx { chunk: ChunkDef; weapons: ReadonlySet<string> }
type When = (c: DebugCtx) => boolean;

export type DebugGroupId = 'look' | 'cover' | 'sky' | 'audio' | 'combat' | 'creatures' | 'perf' | 'loading' | 'tools';
export interface DebugGroup { id: DebugGroupId; label: string; note?: string }
/** the groups, in menu order. Never add a group without need: put a new row in the group whose domain it is (lighting,
 *  shadows and post go in Look; water in Look too). A group with no row fails test/debug-options.test.ts. */
export const DEBUG_GROUPS: readonly DebugGroup[] = [
  { id: 'look', label: 'Look' },
  {
    id: 'cover', label: 'Ground cover & foliage',
    note: 'Ground tint: far ground takes the plants\' colour. Slope reach: plants on slopes stay drawn 1.7× further. Far colour blend: far plants fade into the ground\'s colour. Foliage range 500 m: every plant in view to 500 m (full plants near, their stand-ins far). Foliage range and Far stand-ins reload the page.',
  },
  { id: 'sky', label: 'Sky & weather' },
  { id: 'audio', label: 'Audio' },
  { id: 'combat', label: 'Combat & weapons' },
  { id: 'creatures', label: 'Creatures & NPCs' },
  { id: 'perf', label: 'Performance' },
  { id: 'loading', label: 'Loading & memory', note: 'Renderer, quality and render scale: Exit to main menu ▸ Settings.' },
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
  /** a button row (a one-shot: clear a cache, spawn something) instead of a pick; `choices` is empty */
  action?: { text: string; run: () => void | Promise<void> };
}

// ── the shards ──
const driftwood: When = (c) => c.chunk.style === 'lowpoly';
const pineHollow: When = (c) => c.chunk.slug === 'pine-hollow';
const nalati: When = (c) => c.chunk.slug === 'nalati-grasslands';
const always: When = () => true;

interface RowOpts { reload?: boolean; when?: When; note: string }
/** a row over a saved option (Settings.ts OPTION_VALUES): `choices` pairs each value with its button text */
export function opt<K extends OptionKey>(key: K, group: DebugGroupId, label: string, choices: readonly (readonly [OptionValue<K>, string])[], o: RowOpts): DebugRow {
  const list = choices.map(([v, text]) => ({ v, text }));
  return {
    id: key, group, label, choices: () => list, reload: o.reload ?? false, when: o.when ?? always, note: o.note,
    get: () => setting(key),
    set: (s) => { const hit = choices.find(([v]) => v === s); if (hit) saveSetting(key, hit[0]); },
    on: (fn) => { onSettingChange(key, () => { fn(); }); },
  };
}
/** a button row: `text` on the button, `run` on a tap (the button disables until a returned promise settles) */
export function action(id: string, group: DebugGroupId, label: string, text: string, run: () => void | Promise<void>, o: RowOpts): DebugRow {
  return {
    id, group, label, choices: () => [], reload: o.reload ?? false, when: o.when ?? always, note: o.note,
    get: () => '', set: () => undefined, on: () => undefined, action: { text, run },
  };
}
const ON_OFF = [['on', 'On'], ['off', 'Off']] as const;
const TIMES = [['live', 'Live'], ['midday', 'Midday'], ['golden', 'Golden'], ['sunset', 'Sunset'], ['night', 'Night']] as const;

const MUSIC_TEXT: Record<MusicStyle, string> = { piano: 'Piano', orchestral: 'Orchestral', folk: 'Folk', synth: 'Synth' };
const SFX_TEXT: Record<SfxSet, string> = { best: 'Generated', synth: 'Synth' };

export const DEBUG_ROWS: readonly DebugRow[] = [
  // ── Look ──
  opt('learnedLut', 'look', 'Learned LUT', ON_OFF, { reload: true, note: 'E85 · off = the captures scripts/fit-lut.py fits from (was ?nolut)' }),

  // ── Ground cover & foliage: Driftwood (E156; src/world/GroundCover.ts, coverTint.ts) ──
  opt('coverRange', 'cover', 'Foliage range', [['normal', 'Normal'], ['500', '500 m']], { reload: true, when: driftwood, note: 'E156 · every plant in view to 500 m' }),
  opt('coverTint', 'cover', 'Ground tint', ON_OFF, { when: driftwood, note: 'E156 · far ground wears the cover\'s colour' }),
  opt('coverReach', 'cover', 'Slope reach', ON_OFF, { when: driftwood, note: 'E156 · slope plants drawn 1.7× further' }),
  opt('coverBlend', 'cover', 'Far colour blend', ON_OFF, { when: driftwood, note: 'E117 / E156 · far plants fade into the ground' }),
  opt('coverFar', 'cover', 'Far stand-ins', [['on', 'On'], ['off', 'Off'], ['far', 'Far']], { reload: true, when: driftwood, note: 'E156 · the far stand-in meshes' }),

  // ── Sky & weather ──
  // the shards with a day clock: Driftwood's DayNight, Nalati's DayClock, Pine Hollow's PineDayNight
  opt('time', 'sky', 'Time of day', TIMES, { when: (c) => c.chunk.style === 'lowpoly' || c.chunk.style === 'painterly' || pineHollow(c), note: 'E55 · hold the day clock at one time' }),
  opt('weather', 'sky', 'Weather', [['live', 'Live'], ['clear', 'Clear'], ['fog', 'Fog'], ['rain', 'Rain']], { when: pineHollow, note: 'PH-L10 · live = dawn fog + showers; clear = the look before' }),
  opt('clockSpeed', 'sky', 'Clock speed', [['1', '1×'], ['10', '10×'], ['60', '60×']], { when: nalati, note: 'Nalati\'s day clock (was ?timescale)' }),

  // ── Audio: the score's source and the sound effects (Settings musicStyle / sfxSet) ──
  {
    id: 'musicStyle', group: 'audio', label: 'Music style', reload: false, when: always, note: 'music v3 · the MiniMax-Music3 scores or the v1 synth',
    choices: () => MUSIC_STYLES.map((v) => ({ v, text: MUSIC_TEXT[v] })), get: getMusicStyle,
    set: (s) => { const v = MUSIC_STYLES.find((x) => x === s); if (v) setMusicStyle(v); }, on: (fn) => { onMusicStyle(() => { fn(); }); },
  },
  {
    id: 'sfxSet', group: 'audio', label: 'Sound effects', reload: false, when: always, note: 'the generated set (MOSS v2 + Stable Audio 3) or all synth',
    choices: () => SFX_SETS.map((v) => ({ v, text: SFX_TEXT[v] })), get: getSfxSet,
    set: (s) => { const v = SFX_SETS.find((x) => x === s); if (v) setSfxSet(v); }, on: (fn) => { onSfxSet(() => { fn(); }); },
  },

  opt('pineScore', 'audio', 'Pine Hollow score', [['auto', 'Auto'], ['night', 'Night'], ['boss', 'Boss I'], ['boss-2', 'Boss II'], ['boss-3', 'Boss III'], ['dawn', 'Dawn']], { reload: true, when: pineHollow, note: 'PH-A1 · hold a scene / boss phase, or the dawn sting (was ?music=pine-*)' }),

  // ── Combat & weapons ──
  opt('aimRing', 'combat', 'Aim assist ring', [['off', 'Off'], ['on', 'On']], { note: 'the aim-assist bubble on screen, with its angle and snap (was ?aimdebug)' }),
  opt('longbowArc', 'combat', 'Longbow drop arc', [['aim', 'With aim'], ['always', 'Always'], ['never', 'Never']], { when: (c) => pineHollow(c) && c.weapons.has('bow'), note: 'PH-C11 · undecided: when the drop arc shows while drawn (was ?arc)' }),

  // ── Creatures & NPCs ──
  opt('creatures', 'creatures', 'Creatures', [['models', 'Models'], ['proc', 'Procedural']], { reload: true, when: (c) => pineHollow(c) || nalati(c), note: 'PH-U11 / E136 · models picked; procedural = what the rig bakes need' }),
  opt('birds', 'creatures', 'Pine Hollow birds', [['models', 'Models'], ['proc', 'Procedural']], { reload: true, when: pineHollow, note: 'polish lane · undecided (was ?birds)' }),
  opt('npcs', 'creatures', 'Pine Hollow people', [['models', 'Models'], ['proc', 'Stand-ins']], { reload: true, when: pineHollow, note: 'PH-M4 · undecided (was ?npcs)' }),
  opt('knife', 'creatures', 'Skinning knife', [['model', 'Model'], ['proc', 'Stand-in']], { reload: true, when: pineHollow, note: 'polish lane · undecided (was ?knife)' }),
  opt('pineLife', 'creatures', 'Pine Hollow life', ON_OFF, { reload: true, when: pineHollow, note: 'birds, hares, ravens, the skinning beat (was ?life=0)' }),
  opt('balbals', 'creatures', 'Balbal warriors', [['auto', 'At dusk'], ['wake', 'Wake now'], ['off', 'Never']], { reload: true, when: nalati, note: 'B11 · the statues that wake at night (was ?balbals)' }),
  opt('ghosts', 'creatures', 'Ghost riders', [['auto', 'At night'], ['line', 'Any hour'], ['off', 'Never']], { reload: true, when: nalati, note: 'B11 · the night riders (was ?ghosts)' }),

  // ── Performance ──
  opt('fps', 'perf', 'Frame cap', [['auto', 'Auto'], ['30', '30'], ['60', 'Uncapped']], { note: 'PH-P1 · auto = Pine Hollow\'s phone tier at 30, else the display\'s rate' }),
  opt('loadProfile', 'perf', 'Load profiling', [['off', 'Off'], ['on', 'On']], { reload: true, note: 'load-perf · logs every shader program the load builds (window.__perfload)' }),

  // ── Loading & memory ──
  {
    ...opt('tex', 'loading', 'GPU textures', [['auto', 'Auto'], ['ktx2', 'KTX2'], ['img', 'Images']], { reload: true, note: 'E157 · KTX2 stays compressed on the GPU; auto = images until the set is cached' }),
    choices: () => [{ v: 'auto', text: `Auto · now ${texMode() === 'ktx2' ? 'KTX2' : 'Images'}` }, { v: 'ktx2', text: 'KTX2' }, { v: 'img', text: 'Images' }],
  },
  opt('prefetch', 'loading', 'Download in background', ON_OFF, { note: 'E158 · the other shards\' files, once this one is playable' }),
  opt('shardCap', 'loading', 'Shards in memory', [['2', '2'], ['1', '1']], { note: 'E155 / E159 · lowering it evicts at once' }),
  opt('bootPack', 'loading', 'Boot pack', ON_OFF, { reload: true, note: 'boot files as one pack; off = one by one (the KTX2 record run)' }),

  // ── Developer tools ──
  opt('cragView', 'tools', 'Crag channel', [['shaded', 'Shaded'], ['ao', 'AO'], ['sun', 'Sun'], ['wet', 'Wet'], ['normal', 'Normal'], ['albedo', 'Albedo']], { when: pineHollow, note: 'PH-U31 · the crags drawn as one channel (was ?cragdebug)' }),
];
