import * as v from 'valibot';
import { CELL_ABOVE, CELL_BELOW, CHUNK_HALF } from '@wildshard/engine/core/config';

/** The most declarations one shardfile's `ui` section may hold. */
export const UI_DECLARATIONS_MAX = 64;
const ICONS = ['lock', 'check', 'poi', 'you', 'map', 'pack', 'star', 'book', 'heart', 'pin', 'laurel'] as const; // the engine's IconId (test/declared-ui.test.ts holds the shapes equal)
const SPOTS = ['r0', 'r1', 'r2', 'r3', 'aim', 'up0', 'lean-l', 'lean-r', 'edge-r', 'edge-l', 'lock', 'jump'] as const; // the engine's DiscSpot
const natural = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const finite = v.pipe(v.number(), v.finite());
const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(64));
const label = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const at = v.pipe(v.tuple([finite, finite, finite]), v.check(([x, y, z]) => Math.abs(x) <= CHUNK_HALF && Math.abs(z) <= CHUNK_HALF && y >= -CELL_BELOW && y <= CELL_ABOVE, 'marker inside the cell'));
const marker = v.strictObject({ kind: v.literal('marker'), id, label, at });
const counter = v.pipe(v.strictObject({ kind: v.literal('counter'), id, label, band: v.picklist(['band.2', 'band.3', 'band.4', 'band.5']), order: v.pipe(natural, v.maxValue(999)), min: finite, max: finite, field: id }), v.check((c) => c.min < c.max, 'counter range'));
const bagPanel = v.strictObject({ kind: v.literal('bagPanel'), id,
  tab: v.strictObject({ id, title: label, icon: v.picklist(ICONS), order: v.pipe(natural, v.maxValue(999)) }),
  order: v.pipe(natural, v.maxValue(999)), paragraphs: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(1024))), v.minLength(1), v.maxLength(16)) });
const bossPanel = v.strictObject({ kind: v.literal('bossPanel'), id, encounter: id, name: label, title: label, retry: label });
const relabel = v.strictObject({ kind: v.literal('relabel'), id, spot: v.picklist(SPOTS), label, icon: v.nullable(v.picklist(ICONS)) });
/** The declared UI kinds of shardfile v0: plain data the platform draws in its own HUD style and slots. */
export const UiSchema = v.pipe(v.array(v.variant('kind', [marker, counter, bagPanel, bossPanel, relabel])), v.maxLength(UI_DECLARATIONS_MAX));
/** a validated `ui` section */
export type ShardUi = v.InferOutput<typeof UiSchema>;
/** one validated UI declaration */
export type ShardUiDeclaration = ShardUi[number];

interface StateField { name: string; type: 'bool' | 'i32' | 'f64' | 'string' }
/** Reference rules: unique ids, counters read a declared numeric field, one boss panel per encounter, one relabel per disc, one spec per bag tab. */
export function uiRules(ui: ShardUi, state: { shared: readonly StateField[]; player: readonly StateField[] }): string[] {
  const errors: string[] = [];
  if (new Set(ui.map((d) => d.id)).size !== ui.length) errors.push('unique ui ids');
  const numeric = new Set([...state.shared, ...state.player].filter((f) => f.type === 'i32' || f.type === 'f64').map((f) => f.name));
  for (const d of ui) if (d.kind === 'counter' && !numeric.has(d.field)) errors.push(`counter field ${d.field}`);
  const bosses = ui.flatMap((d) => d.kind === 'bossPanel' ? [d.encounter] : []), spots = ui.flatMap((d) => d.kind === 'relabel' ? [d.spot] : []);
  if (new Set(bosses).size !== bosses.length) errors.push('one boss panel per encounter');
  if (new Set(spots).size !== spots.length) errors.push('one relabel per disc');
  const tabs = new Map<string, string>();
  for (const d of ui) if (d.kind === 'bagPanel') {
    const spec = JSON.stringify([d.tab.title, d.tab.icon, d.tab.order]);
    if ((tabs.get(d.tab.id) ?? spec) !== spec) errors.push(`bag tab ${d.tab.id} declared twice differently`);
    tabs.set(d.tab.id, spec);
  }
  return errors;
}
