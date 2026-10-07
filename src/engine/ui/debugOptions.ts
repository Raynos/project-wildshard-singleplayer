import { currentProbe } from '../app/identity';
import { authoredRows } from './authoredDebugRows';
import { uiScope } from './ownership';
import { engineString } from '../strings';
import { app } from '../app/runtime';
/**
 * The DEBUG menu's registry (E162, Jake 2026-09-25: "we are going to have an ungodly amount of toggles and we need to
 * organize them"). Every variant, taste toggle and developer aid the game has is declared here ONCE — its group, label,
 * choices, whether it applies live or reloads the page, the shards it applies to and a one-line note with its ask id.
 * pause ▸ Settings ▸ Debug (src/engine/ui/DebugMenu.ts) renders it: one collapsible section per group, only the rows that apply to
 * the shard you are in, a filter box on top. There are no URL switches (AGENTS.md "No URL switches, ever").
 *
 *   opt('weather', 'sky', 'Weather', [['live', 'Live'], ['rain', 'Rain']], { ask: 'E162', reviewBy: '2026-12-30', note: 'E162: aiming aid.' })
 *   action('clearDownloads', 'loading', 'Downloads', 'Clear', () => …, { ask: 'E172', reviewBy: '2026-12-30', note: 'E172 …' })   // a button row, not a pick
 *   DEBUG_READOUTS        → a live readout under a row, by row id (E172: Shards in memory's; both menus show it)
 *   DEBUG_ROWS            → every row, in menu order within its group
 *   DEBUG_GROUPS          → the groups, in menu order (never add one without need: a row belongs in an existing group)
 *
 * A row reads a saved option (src/engine/ui/Settings.ts OPTION_VALUES / OPTION_SPECS with `params: []`): the game reads it with
 * `setting(key)` (at load for a `reload` row) and `onSettingChange(key, fn)` (a live row).
 */
import type { LevelSpec } from '../level/spec';
import { jsonSlot } from '../saves/slots';
import { texMode } from '../boot/gpuFiles';
import { clearDownloads, freedBytes, lastClear, mbText, storageUsed } from '../boot/clearDownloads';
import { RELOAD_PARAM } from '../core/GpuRecovery';
import { lastEndLine, markUnload } from '../boot/lastEnd';
import { onSettingChange, saveSetting, setting, settingsReloadUrl, type OptionKey, type OptionValue } from './Settings';
import { MOBILE_DEVICE } from '../core/tier';
import { tierPickLine } from '../render/tierBoot';
import type { DebugRowSpec } from '../level/context';
import { isDev, onDev } from '../core/devMode';

const scope = uiScope('debugOptions', app.engineScope);

/** what "applies" reads: the shard you are in and the weapons you hold (re-read every time the menu opens) */
export interface DebugCtx { chunk: LevelSpec; weapons: ReadonlySet<string> }
type When = (c: DebugCtx) => boolean;

export type DebugGroupId = 'look' | 'cover' | 'sky' | 'audio' | 'combat' | 'creatures' | 'perf' | 'loading' | 'tools';
export interface DebugGroup { id: DebugGroupId; label: string; note?: string }
/** the groups, in menu order. Never add a group without need: put a new row in the group whose domain it is (lighting,
 *  shadows and post go in Look; water in Look too). Empty groups are hidden until an authored row uses them. */
export const DEBUG_GROUPS: readonly DebugGroup[] = [
  { id: 'look', label: engineString('s_a0de5719f595') },
  { id: 'sky', label: engineString('s_5672356bb3b5') },
  { id: 'audio', label: engineString('s_bc1b88907d3b') },
  { id: 'combat', label: engineString('s_6cb4be24e5ce') },
  { id: 'creatures', label: engineString('s_c57f1e7056cf') },
  { id: 'perf', label: engineString('s_442aded87a55') },
  { id: 'loading', label: engineString('s_f6d2705a823f') },
  { id: 'tools', label: engineString('s_96f0c06bbcb7') },
];

export interface DebugChoice { v: string; text: string }
export interface DebugRow {
  /** Diagnostic controls belong in Settings Developer, separately from comparison flags. */
  purpose?: 'developer';
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

/** A level owns its debug choices and their inverse; menus resolve the live catalog when opened. */
export function registerLevelDebugRow(spec: DebugRowSpec, levelId: string): () => void {
  const saved = jsonSlot(`debug.plugin.${levelId}.${spec.id}`, 'device');
  const value = saved.read();
  const read = (): string => {
    if (spec.purpose === 'developer' && !isDev()) return spec.initial;
    const next = saved.read();
    return typeof next === 'string' && spec.choices.some((choice) => choice.value === next) ? next : spec.initial;
  };
  let current = spec.purpose === 'developer' && !isDev() ? spec.initial
    : typeof value === 'string' && spec.choices.some((choice) => choice.value === value) ? value : spec.initial;
  let live = true;
  const listeners = new Set<() => void>();
  const row: DebugRow = { ...(spec.purpose === undefined ? {} : { purpose: spec.purpose }), id: spec.id, group: spec.group, label: spec.label, note: spec.note, ask: spec.ask, reviewBy: spec.reviewBy, reload: spec.reload ?? false,
    choices: () => spec.choices.map((choice) => ({ v: choice.value, text: choice.text })), get: () => current,
    set: (next) => {
      if (!live || (spec.purpose === 'developer' && !isDev()) || !spec.choices.some((choice) => choice.value === next)) return;
      current = next; saved.write(next); spec.change(next); for (const listener of listeners) listener();
    }, on: (listener) => { if (live) listeners.add(listener); }, when: (ctx) => ctx.chunk.id === levelId };
  authoredRows.add(row);
  if (current !== spec.initial) spec.change(current);
  const off = spec.purpose === 'developer' && typeof window !== 'undefined' ? onDev(() => {
    if (!live) return;
    const next = read(); if (next === current) return;
    current = next; spec.change(next); for (const listener of listeners) listener();
  }) : () => undefined;
  return () => { live = false; off(); authoredRows.delete(row); listeners.clear(); };
}

// Authored levels opt into each core option independently.
const always: When = () => true;

interface RowOpts { purpose?: 'developer'; reload?: boolean; when?: When; note: string; ask: `E${number}`; reviewBy: string }
/** a row over a saved option (Settings.ts OPTION_VALUES): `choices` pairs each value with its button text */
export function opt<K extends OptionKey>(key: K, group: DebugGroupId, label: string, choices: readonly (readonly [OptionValue<K>, string])[], o: RowOpts): DebugRow {
  const list = choices.map(([v, text]) => ({ v, text }));
  return {
    ...(o.purpose === undefined ? {} : { purpose: o.purpose }), id: key, group, label, choices: () => list, reload: o.reload ?? false, when: o.when ?? always, note: o.note, ask: o.ask, reviewBy: o.reviewBy,
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
    ...(o.purpose === undefined ? {} : { purpose: o.purpose }), id, group, label, choices: () => [], reload: o.reload ?? false, when: o.when ?? always, note: o.note, ask: o.ask, reviewBy: o.reviewBy,
    get: () => '', set: () => undefined, on: () => undefined, action: { text, run: (say) => o.purpose === 'developer' && !isDev() ? undefined : run(say), ...more },
  };
}
const ON_OFF = [['on', 'On'], ['off', 'Off']] as const;

/** params that skip the title (dev / deep links): a reload meant to land on the title drops them (the title's Apply &
 *  reload, src/engine/ui/BootSettings.ts; Clear downloads) */
export const TITLE_SKIPPERS = ['skipintro', 'tour', 'explore', 'cam', 'model', 'at', RELOAD_PARAM, 'v'];

/** E172 (the user: "I need a button to nuke the cache so i can test it"): every downloaded file gone, the saves kept
 *  (src/engine/boot/clearDownloads.ts), then a reload to the title like a fresh launch — the running shard's ?chunk= stays */
const CLEAR_IDLE = engineString('s_e94f3b418bf5');
const clearDownloadsRow = action('clearDownloads', 'loading', engineString('s_59cb301bb126'), engineString('s_59cb301bb126'), async (say) => {
  say('Clearing…', CLEAR_IDLE);
  const r = await clearDownloads();
  const freed = freedBytes(r);
  say(freed === null ? 'Cleared · reloading' : `Freed ${mbText(freed)} · reloading`,
    `${mbText(freed)} of downloads · ${r.caches} caches and ${r.workers} worker${r.workers === 1 ? '' : 's'} removed${r.httpCache ? ', HTTP cache cleared' : ''}. Reloading as a first visit.`);
  scope.timeout(1500, () => { markUnload('debug: clear downloads'); location.replace(settingsReloadUrl(location.href, TITLE_SKIPPERS)); });
}, { purpose: 'developer', ask: 'E172', reviewBy: '2026-12-30', note: engineString('s_510ecf1f03f4') }, {
  confirm: async () => { const used = await storageUsed(); return used === null ? 'Tap again to clear' : `Tap again to clear ~${mbText(used)}`; },
  status: () => {
    const last = lastClear(); // this page is the reload the last clear made: say what it freed
    return last === null ? CLEAR_IDLE : `Last clear freed ${mbText(freedBytes(last))} (${last.caches} caches, ${last.workers} worker${last.workers === 1 ? '' : 's'}). ${CLEAR_IDLE}`;
  },
});
const TIMES = [['live', 'Live'], ['midday', 'Midday'], ['golden', 'Golden'], ['sunset', 'Sunset'], ['night', 'Night']] as const;


export const DEBUG_ROWS: readonly DebugRow[] = [
  // ── Look ──
  opt('graphMaterials', 'look', engineString('s_graph_materials'), [['off', engineString('s_ca7981b46ecf')], ['on', engineString('s_130011756125')]], { reload: true, ask: 'E435', reviewBy: '2026-12-30', note: engineString('s_graph_materials_note') }),

  // ── Sky & weather ──
  // Authored clocks and weather opt in through level mechanisms.
  opt('time', 'sky', engineString('s_318fb174f5eb'), TIMES, { purpose: 'developer', when: (c) => c.chunk.mechanisms.includes('dayCycle'), ask: 'E55', reviewBy: '2026-12-30', note: engineString('s_f42607c7d703') }),
  opt('weather', 'sky', engineString('s_a0bba6381246'), [['live', engineString('s_b64ac05f17e6')], ['clear', engineString('s_83b12c2216ef')], ['fog', engineString('s_14394e978d84')], ['rain', engineString('s_a6d20aa6a4c7')]], { purpose: 'developer', when: (c) => c.chunk.mechanisms.includes('weather'), ask: 'E357', reviewBy: '2026-12-30', note: engineString('s_a931181d0abf') }),

  // ── Combat & weapons ──

  // ── Creatures & NPCs ──

  // ── Performance ──
  opt('fps', 'perf', engineString('s_5f5c99339841'), [['auto', engineString('s_0286249762f7')], ['30', engineString('s_624b60c58c9d')], ['60', engineString('s_c1fe790a9f07')]], { purpose: 'developer', when: () => !MOBILE_DEVICE, ask: 'E193', reviewBy: '2026-12-30', note: engineString('s_d56f59162f05') }),

  // ── Loading & memory ──
  {
    ...opt('tex', 'loading', engineString('s_334a93884d13'), [['auto', engineString('s_0286249762f7')], ['ktx2', engineString('s_66270d61a105')], ['img', engineString('s_be7e2f201293')]], { reload: true, ask: 'E157', reviewBy: '2026-12-30', note: engineString('s_5c0f164512c8') }),
    choices: () => [{ v: 'auto', text: engineString('s_7dc1f00169b6', [texMode() === 'ktx2' ? engineString('s_66270d61a105') : engineString('s_be7e2f201293')]) }, { v: 'ktx2', text: engineString('s_66270d61a105') }, { v: 'img', text: engineString('s_be7e2f201293') }],
  },
  opt('memorySaver', 'loading', engineString('s_memory_saver'), [['off', engineString('s_ca7981b46ecf')], ['on', engineString('s_130011756125')]], { reload: true, ask: 'E435', reviewBy: '2026-12-30', note: engineString('s_memory_saver_note') }),
  opt('bootPack', 'loading', engineString('s_4cd17de104b7'), ON_OFF, { purpose: 'developer', reload: true, ask: 'E162', reviewBy: '2026-12-30', note: engineString('s_f72e67795ca9') }),
  { purpose: 'developer', id: 'storage', group: 'loading', label: engineString('s_a69c4dece144'), choices: () => [], get: () => '', set: () => undefined, on: () => undefined, reload: false, when: always, ask: 'E357', reviewBy: '2026-12-30', note: engineString('s_281936523768') },
  clearDownloadsRow,

  // ── Developer tools ──
  { ...action('calibrate', 'tools', engineString('s_252526ecd431'), engineString('s_e6539473d9a0'), () => { saveSetting('calibrate', 'run'); location.reload(); }, { purpose: 'developer', ask: 'E357', reviewBy: '2026-12-30', note: engineString('s_7d857a36f6c1') }), choices: () => [{ v: 'off', text: engineString('s_ab0171ca0494') }, { v: 'run', text: engineString('s_00d60e31a4e6') }] },
  action('budgetReadout', 'perf', engineString('s_2461f265574b'), engineString('s_eff6d457bfb5'), (say) => {
    const probe = currentProbe();
    if (probe === undefined) { say('READ BUDGETS', 'Enter a level to read its budgets.'); return; }
    const rows = probe.budgets(['current']);
    const measured = probe.world.game.lastFrame;
    say('READ BUDGETS', `${tierPickLine()}\nMeasured ${measured.calls} draws / ${measured.triangles} tris\n${Object.entries(rows).map(([pose, row]) => `${pose}: derived ${JSON.stringify(row.derived)} / ceiling ${JSON.stringify(row.ceiling)} · ${row.formula.assumption}`).join('\n')}`);
  }, { purpose: 'developer', ask: 'E357', reviewBy: '2026-12-30', note: engineString('s_2ed7f7dcebc2') }),
];

/** Shards in memory's readout (E155 / E159): the resident shards, their texture estimate, the JS heap, the device's
 *  memory and the last reload's cause (E179) — read on the device (the iPhone has no dev tools) */
function memoryReadout(): string {
  const m = app.levelAdapters.residentMemory?.() ?? null;
  // Chrome's performance.memory / navigator.deviceMemory: absent on iOS (and not in the DOM typings)
  const pm: unknown = Reflect.get(performance, 'memory'), used: unknown = typeof pm === 'object' && pm !== null ? Reflect.get(pm, 'usedJSHeapSize') : undefined;
  const dm: unknown = Reflect.get(navigator, 'deviceMemory');
  const heap = typeof used === 'number' ? `${Math.round(used / 1e6)} MB` : 'n/a';
  const levels = m === null ? [`no ${engineString('s_level_word_lower')} host`] : m.levels.map((x, i) => `${i + 1}. ${x.id}${x.running ? ' (playing)' : ''} · textures ~${Math.round(x.textureMB)} MB`);
  // E179: why the page last reloaded (src/engine/boot/lastEnd.ts: the reason the game gave, or "ended unexpectedly")
  return [`Resident (oldest first, keeps ${m?.cap ?? '?'}):`, ...levels, `JS heap: ${heap} · device memory: ${typeof dm === 'number' ? `${dm} GB` : 'n/a'}`, lastEndLine()].join('\n');
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
  return engineString('s_eb6d1d4e42ba', [jsonSlot('storage.persisted', 'device').read() === true ? engineString('s_8a798890fe93') : engineString('s_9390298f3fb0'), storageEstimate]);
}

export function levelDebugRows(): readonly DebugRow[] { return [...DEBUG_ROWS, ...authoredRows]; }
