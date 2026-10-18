import { parseLightEmitters } from '@wildshard/format/lightEmitters';
import rest from '../data/restScenes.generated.json' with { type: 'json' };
import { FIRE_GRAPH_IDS } from './rows/fire';
import { signalEmberBuffer } from './emberBuffers';

const rows: unknown[] = [];
const material = (program: string): string => {
  const id = new Map(Object.entries(FIRE_GRAPH_IDS)).get(program); if (id === undefined) throw new Error('Undeclared emitter graph'); return id;
};
/** The original draw order, geometry, scales and seeds; only construction ownership changes. */
for (const [id, source] of [
  ['tower', rest.bindings.tower], ['caravan', rest.bindings.caravan],
  ...rest.bindings.braziers.map((row, index) => [`brazier.${String(index)}`, row] as const),
] as const) {
  for (const [index, effect] of [...source.lamps, ...source.fires].entries()) {
    const draws: unknown[] = [];
    const cards = (group: { readonly name: string; readonly order: number; readonly cards: readonly { readonly program: string; readonly quad: string; readonly scale: number | readonly number[]; readonly at?: readonly number[]; readonly order?: number }[] }): void => {
      for (const card of group.cards) draws.push({ kind: 'card', name: group.name, order: card.order ?? group.order, material: material(card.program),
        geometry: { library: 'models', model: `fire-${card.quad}` }, scale: card.scale, at: card.at ?? [0, 0, 0] });
    };
    if ('fire' in effect.rows) {
      cards(effect.rows.fire);
      const embers = effect.rows.embers;
      draws.push({ kind: 'buffered', file: signalEmberBuffer(embers.count, embers.name), scale: embers.scale, y: embers.y, material: FIRE_GRAPH_IDS.embers });
      cards(effect.rows.smoke);
    } else cards(effect.rows.halo);
    if (effect.pool !== null) draws.push({ kind: 'pool', geometry: { library: 'models', model: effect.pool }, material: FIRE_GRAPH_IDS.pool });
    const switchId = id.startsWith('brazier.') ? id : id === 'tower' && effect.part === 'live.fire' ? 'signal' : `${id}.fx.${String(index)}`;
    rows.push({ id: switchId, parent: `${id}.${effect.part}`, draws, initially: switchId !== 'signal' && !id.startsWith('brazier.'),
      ...(id.startsWith('brazier.') ? { at: { point: `${id}.glow-at` }, pool: { slot: Number(id.slice(-1)), gain: 1 },
        emissive: { collection: `${id}.embers`, gain: 1.1 },
        light: { at: { point: `${id}.bowl-at`, offset: [0, 0.5, 0] }, colour: 0xff7a30, gain: 9, distance: 10, decay: 2, shared: true, waves: [[11, 0, 0.07], [23, 1, 0.05]] },
      } : switchId === 'signal' ? { light: { part: 'tower.light', at: { point: 'tower.brazier-at', offset: [0, 1, 0] }, colour: 0xff8a3a, gain: 14, distance: 40, decay: 1.6, shared: false, waves: [[13, 0, 0.06], [29, 1.3, 0.04]] } } : {}),
    });
  }
}
rows.push({ id: 'caravan.pool', parent: 'caravan.live.lamp', at: { point: 'caravan.lamp-at' }, pool: { slot: 3, gain: 0.22 }, initially: true, draws: [],
  light: { at: { point: 'caravan.lamp-at' }, colour: 0xffd27a, gain: 5, distance: 10, decay: 2, shared: true, waves: [[11, 0, 0.07], [23, 1, 0.05]] } });
export const SIGNAL_EMITTERS = parseLightEmitters({ version: 1, input: 'firelights', clock: 'firetime', rows });
