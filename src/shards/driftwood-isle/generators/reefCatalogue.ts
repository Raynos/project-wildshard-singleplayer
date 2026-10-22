import { REEF_SPECIMENS } from './reefSpecimenRows';
import { REEF_FILES } from './reefFiles';
import type { WorldSceneModels } from '@wildshard/format/worldSceneModels';
import assets from '../data/reefBlobs.generated.json' with { type: 'json' };

/** Fixed authored shapes use Z2's existing owned-geometry and model-choice data. */
export function reefCatalogue(): WorldSceneModels['models'] {
  const cards = { coral: { id: 'coral', name: 'Coral clump' }, weed: { id: 'seaweed', name: 'Seaweed bed' }, star: { id: 'reef-starfish', name: 'Reef starfish' } };
  return (['coral', 'weed', 'star'] as const).map(kind => {
    const row = REEF_SPECIMENS[kind], card = cards[kind], seen = new Set<string>();
    const choices = [{ id: 'default', params: row.defaults }, ...row.variants.map(variant => ({ id: variant.id, params: { ...row.defaults, ...variant.params } }))]
      .filter(choice => { const key = JSON.stringify(Object.entries(choice.params).sort(([a], [b]) => a.localeCompare(b))); if (seen.has(key)) return false; seen.add(key); return true; })
      .map(choice => ({ id: choice.id, params: choice.params, size: [...row.size] as [number, number, number],
        draws: [{ id: 'mesh', library: 'reef-specimens', model: `${kind}-${choice.id}`, material: 'reef', castShadow: false, receiveShadow: true, renderOrder: 0 }], colliders: [], lods: [] }));
    return { key: card.id, id: `driftwood-isle/${card.id}`, name: card.name, file: 'src/shards/driftwood-isle/generators/reefCatalogue.ts',
      category: 'nature', pipeline: 'code', defaults: row.defaults, variants: [...row.variants], assembly: 'objects', choices };
  });
}

/** Use admitted asset names; keep the baked sway attribute and every authored choice. */
export const REEF_SCENE_LIBRARY = { id: 'reef-specimens', kind: 'owned' as const,
  models: (['coral', 'weed', 'star'] as const).flatMap(kind => Object.entries(REEF_FILES[kind]).map(([id, url]) => {
    const names: Readonly<Record<string, string>> = assets.byUrl, file = names[url];
    if (file === undefined) throw new Error(`Missing reef specimen: ${kind}/${id}`);
    return { id: `${kind}-${id}`, file, attributes: { _sway: 'aSway' } };
  })) };
