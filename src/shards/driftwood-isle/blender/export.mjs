import FOLIAGE from '../data/foliagePlacements.generated.json' with {type:'json'};
// Driftwood Isle's half of scripts/blender/lib/export-scene.mjs (DRIFTWOOD-REMASTER X2, E52): the game's low-poly ground
// colour, and the cove's layout specs + bake occluders. Moved here unchanged from export-scene.mjs (PH-0.3): the exported
// scene is byte-for-byte what it was.
//
// A shard module exports:
//   groundColor(ctx) → (c: THREE.Color, x, z, y, ny, td) => void   the area grid's colour at a vertex (linear)
//   layout(ctx)      → { scene: {...}, summary: string }            scene.json's shard keys (after area / sea / chunk);
//                                                                    structures go to ctx.addObject / ctx.tryBuild

export async function groundColor({ THREE, imp, hf, def }) {
  const { lowPolyGroundColor } = await imp('src/shards/driftwood-isle/look/groundColor.ts');
  const wl = def.ocean.level - (def.ground.terrain?.datum ?? 0); // the authored frame of the raw bake (G164's datum undone)
  const pathC = new THREE.Color('#d6bd84');
  const ss = THREE.MathUtils.smoothstep;
  const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
  return (c, x, z, y, ny, td) => {
    let lip = 0;
    if (ny < 0.8) { const hi = Math.max(hf.heightAt(x + 2.5, z), hf.heightAt(x - 2.5, z), hf.heightAt(x, z + 2.5), hf.heightAt(x, z - 2.5)); lip = 1 - ss(hi - y, 0.4, 1.4); }
    lowPolyGroundColor(c, y - wl, 1 - ny, x, z, lip);
    if (y - wl > 1.5 && td < 4.5) { pathC.set('#d6bd84').multiplyScalar(0.94 + hash2(x, z) * 0.12); c.lerp(pathC, 1 - ss(td, 2.2, 4.5)); }
  };
}

export async function layout({ THREE, imp, def, addObject, tryBuild, CHUNK_HALF, ROAD_LENGTH }) {
  const island = await imp('src/shards/driftwood-isle/world/sites.ts');
  const terrainLayout = await imp('src/shards/driftwood-isle/data/layout.ts');
  const wl = def.ocean.level - (def.ground.terrain?.datum ?? 0); // the authored frame of the raw bake (G164's datum undone)
  // ── layout specs (desktop tier, as the bake's reference) ──
  const { scatterShoreBoulders } = await imp('src/shards/driftwood-isle/world/Boulders.ts');
  const { buildTrailside } = await imp('src/shards/driftwood-isle/world/Trailside.ts');
  const { islandTrailsideSpec } = await imp('src/shards/driftwood-isle/world/trailsideLayout.ts');
  const { Pier } = await imp('src/shards/driftwood-isle/world/Pier.ts');
  const { hut, hutOrigin, hutLayout } = await imp('src/shards/driftwood-isle/runtime/models/hut.ts');
  const { modelContext } = await imp('src/engine/models/model.ts');
  const { placeModelSite } = await imp('src/engine/models/place.ts');
  const { HUT } = island;
  if (FOLIAGE.seed !== def.seed) throw new Error('Foliage placements require their authored seed');
  const palms = FOLIAGE.tiers.desktop.palms.specs;
  const rocks = scatterShoreBoulders(def.seed);
  const bushes = FOLIAGE.tiers.desktop.bushes.specs;
  const trailside = islandTrailsideSpec();

  // ── structures kept in blender mode, as bake occluders ──
  const sky = { setupMaterial() { /* no CSM in Node */ }, viewCamera: new THREE.PerspectiveCamera() };
  const pier = new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: wl + 1.2, landing: true }).build();
  addObject(pier.group);
  tryBuild('hut', () => placeModelSite(hut, hutOrigin(HUT), hutLayout(HUT), { ctx: modelContext(sky), registry: null }).group);
  tryBuild('trailside', () => buildTrailside(sky, trailside).mesh);

  return {
    scene: {
      palms, rocks, bushes,
      trailside: { steps: trailside.steps ?? null, fences: trailside.fences ?? null, signs: trailside.signs ?? null },
      pier: { posts: pier.posts, bollards: pier.bollards, deckY: pier.deckY, colliders: pier.colliders },
      paths: terrainLayout.PATHS, plateau: terrainLayout.PLATEAU, hut: HUT,
    },
    summary: `palms ${palms.length}, rocks ${rocks.length}, bushes ${bushes.length}`,
  };
}
