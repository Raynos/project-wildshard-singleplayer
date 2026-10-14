import { defineShard } from '@wildshard/game/shard/manifest';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { createBakedTerrainField } from '@wildshard/engine/world/bakedTerrainField';
import { SIGNAL_MANIFEST } from './data/manifest';
import { SEED, TRAIL } from './data/layout';

const terrain = createBakedTerrainField({ key: 'sunscar-dunes', seed: SEED },
  buildTerrain(SEED, { landscape: () => 0, trails: TRAIL, cabinSites: [] }));
export const SUNSCAR_DUNES = defineShard(SIGNAL_MANIFEST, {
  ground: { paths: 'plugin', terrain },
  render: async () => (await import('./look/render')).signalDunesLook(),
  roster: async () => (await import('./roster')).roster(), load: () => import('./plugin'),
});
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SUNSCAR_DUNES;
