import type { WorldSceneModels } from '@wildshard/format/worldSceneModels';
import wreck from '../data/wreckBake.json' with { type: 'json' };

/** Every original card and live wreck copy retains its exact parameter choice. */
export const CARGO_CARDS: ({ key: string; id: string; name: string; defaults: { lying: boolean; size?: never; broken?: never; r?: never; }; variants: ({ id: string; label: string; params: { lying?: never; }; } | { id: string; label: string; params: { lying: boolean; }; })[]; params: { lying: boolean; }[]; } | { key: string; id: string; name: string; defaults: { size: number; broken: boolean; lying?: never; r?: never; }; variants: ({ id: string; label: string; params: { size?: never; broken?: never; }; } | { id: string; label: string; params: { size: number; broken?: never; }; } | { id: string; label: string; params: { size: number; broken: boolean; }; })[]; params: { size: number; broken: boolean; }[]; } | { key: string; id: string; name: string; defaults: { r: number; lying?: never; size?: never; broken?: never; }; variants: never[]; params: { r: number; }[]; })[] = [
  { key: 'barrel', id: 'barrel', name: 'Barrel', defaults: { lying: false }, variants: [
    { id: 'standing', label: 'Standing', params: {} }, { id: 'lying', label: 'Lying', params: { lying: true } }],
    params: wreck.catalogue.barrels.placements.map(row => ({ lying: row.variant === 'lying' })) },
  { key: 'crate', id: 'crate', name: 'Crate', defaults: { size: 0.8, broken: false }, variants: [
    { id: 'big', label: 'Big', params: {} }, { id: 'small', label: 'Small', params: { size: 0.55 } },
    { id: 'broken', label: 'Broken', params: { size: 0.7, broken: true } }],
    params: wreck.catalogue.crates.placements.map(row => row.params) },
  { key: 'ropeCoil', id: 'rope-coil', name: 'Rope coil', defaults: { r: 0.3 }, variants: [],
    params: wreck.catalogue.coils.placements.map(row => row.params) },
];

/** The existing Z2 model host consumes only choices and named geometry. */
export function cargoModels(): WorldSceneModels['models'] {
  return CARGO_CARDS.map(row => {
    const seen = new Set<string>();
    const choices = [row.defaults, ...row.variants.map(variant => ({ ...row.defaults, ...variant.params })), ...row.params]
      .filter(params => { const key = JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b))); if (seen.has(key)) return false; seen.add(key); return true; })
      .map((params, i) => ({ id: String(i), params, size: [1, 1, 1] as [number, number, number],
        draws: [{ id: 'mesh', library: 'cargo', model: `${row.key}-${i}`, material: 'still', castShadow: true, receiveShadow: true, renderOrder: 0 }], colliders: [], lods: [] }));
    return { key: row.key, id: `driftwood-isle/${row.id}`, name: row.name, file: 'src/shards/driftwood-isle/generators/cargoCatalogue.ts',
      category: 'props', pipeline: 'code', surface: 'wood', defaults: row.defaults, variants: row.variants, assembly: 'parts', choices };
  });
}
