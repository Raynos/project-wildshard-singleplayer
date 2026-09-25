// Dev entry: the Nalati spruce (src/world/Spruce.ts) planted by the engine Forest with the gully mask
// (src/world/spruceMask.ts).
//   http://127.0.0.1:5188/dev/nalati-spruce.html?chunk=nalati-grasslands&nolock=1        → the real shard
//   http://127.0.0.1:5188/dev/nalati-spruce.html?chunk=spruce-testbed&nolock=1&nobake=1  → a stand-in escarpment (PBR look)
// Poses: valley → gully  &x=-60&z=178&yaw=0&pitch=0.12 · rim → gully  &x=-60&z=-40&yaw=3.1416&pitch=-0.2
// window.__world = { ...bootstrap(), factory }, window.__spruce() → { trees, lodTris, calls, triangles, fps }
//
// Without the real shard this registers a stand-in def, `spruce-testbed`: Pine Hollow's look on a Nalati-shaped
// field — valley floor −8 in the north, a 40 m north-facing escarpment carved by the three map-01 gullies, the
// plateau at +32 in the south — so the trees can be judged on the slope they are made for.
import { smoothstep, clamp, lerp } from '../core/noise';
import { CHUNK_HALF, ROAD_LENGTH, _applyChunkConstants } from '../core/config';
import { buildTerrain } from '../chunks/terrain';
import { CHUNKS, findChunk, chunkSlugFromUrl } from '../chunks/registry';
import { PINE_HOLLOW } from '../chunks/pine-hollow';
import type { ChunkDef } from '../chunks/ChunkDef';
import { spruceMask, NALATI_GULLIES } from '../world/spruceMask';
import { bootstrap } from '../core/bootstrap';
import { SpruceFactory } from '../world/Spruce';
import { updatePainterly } from '../world/painterly';

const TESTBED = 'spruce-testbed';
const SEED = 0x5a7c;

function testbed(): ChunkDef {
  const terrain = buildTerrain(SEED, {
    landscape(x, z, { n, n2 }) {
      const climb = smoothstep(148, -32, z);                          // valley (north, +z) → plateau (south)
      let h = lerp(-8, 32, climb);
      for (const g of NALATI_GULLIES) {
        const cx = g.x + n.get(z * 0.011, g.x * 0.01) * (g.wobble ?? 0);
        const across = Math.exp(-(((x - cx) / (g.width * 0.42)) ** 2));
        const along = Math.sin(Math.PI * clamp((z - g.zBottom + 12) / (g.zTop - g.zBottom + 12), 0, 1));
        h -= 11 * across * along;
      }
      h += n.fbm(x * 0.008, z * 0.008, 4) * 3 * (0.4 + climb) + n2.fbm(x * 0.04, z * 0.04, 3) * 0.6;
      return h;
    },
    trails: [
      [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH], [0, 150], [22, 110], [-6, 70], [26, 30], [4, -10], [0, -60]],
      [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH], [0, -60]],
      [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0], [-200, -40], [0, -60]],
      [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0], [200, -40], [0, -60]],
    ],
    cabinSites: [],
    splat(x, z, t, { n }) {
      const [, ny] = t.normalAt(x, z, 1.0);
      const slope = 1 - ny;
      const rock = smoothstep(0.2, 0.4, slope);
      const trail = smoothstep(5.5, 1.5, t.trailDistance(x, z));
      const grass = clamp(0.8 + n.get(x * 0.02, z * 0.02) * 0.3, 0, 1);
      return [0.15, grass * (1 - rock) * (1 - trail), rock * (1 - trail), trail];
    },
  });
  return {
    ...PINE_HOLLOW,
    id: `chunk://local/${TESTBED}`, slug: TESTBED, displayName: 'Spruce testbed', seed: SEED, treeCount: 1400,
    terrain,
    trees: { factory: 'spruce', bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'spruces' },
    forest: {
      spacing: 4.6, densityFreq: 0.02, clearings: [-0.7, -0.2], maxSlope: 0.6,
      tintHue: 0.4, tintHueJitter: [-0.04, 0.05], tintSat: [0.05, 0.22], tintLight: [0.82, 0.96],
      largeVariantChance: 0.18,
      mask: spruceMask({ gullies: NALATI_GULLIES, normalAt: terrain.normalAt, seed: SEED }),
    },
    fauna: [],
    spawn: { x: 0, z: 232, yaw: 0 },
  };
}

const params = new URLSearchParams(location.search);
const wanted = chunkSlugFromUrl();
const real = findChunk(wanted);
const isNalati = real?.slug === 'nalati-grasslands';
if (real && isNalati && real.trees.factory !== 'spruce') {
  // the real shard before its def switches to spruce: plant them here the way the def should
  real.trees = { ...real.trees, factory: 'spruce', noun: 'spruces' };
  real.treeCount = 1600;
  real.forest = {
    ...real.forest, spacing: 4.2,
    tintHue: 0.3, tintHueJitter: [-0.06, 0.06], tintSat: [0.05, 0.25], tintLight: [0.8, 0.95],
    mask: spruceMask({ gullies: NALATI_GULLIES, normalAt: real.terrain.normalAt, seed: real.seed }),
  };
  _applyChunkConstants(real); // TREE_COUNT is a live binding of the def's treeCount, read at registry init
}
if (!isNalati) {
  CHUNKS.push(testbed());
  if (wanted !== TESTBED) { params.set('chunk', TESTBED); history.replaceState(null, '', `${location.pathname}?${params.toString()}`); }
}
const world = await bootstrap();
const spruce = await new SpruceFactory(world.game.renderer, world.sky).build(); // a second copy, for its triangle counts only
Object.assign(window, { __world: { ...world, factory: spruce } });
Object.assign(window, { __spruce: () => ({
  trees: world.forest.trees.length,
  path: world.forest.path,
  lodTris: spruce.lodTris,
  calls: world.game.lastFrame.calls,
  triangles: world.game.lastFrame.triangles,
  fps: world.game.stats.fps,
}) });
console.info('[spruce] %d spruces (%s path), tris/LOD %s', world.forest.trees.length, world.forest.path, JSON.stringify(spruce.lodTris));
world.game.onUpdate((dt) => updatePainterly(dt));
world.game.buildComposer();
world.game.start();
