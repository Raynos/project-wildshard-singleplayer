// Driftwood Isle's half of scripts/blender/export-scene.mjs (DRIFTWOOD-REMASTER X2, E52): the game's low-poly ground
// colour, and the cove's layout specs + bake occluders. Moved here unchanged from export-scene.mjs (PH-0.3): the exported
// scene is byte-for-byte what it was.
//
// A shard module exports:
//   groundColor(ctx) → (c: THREE.Color, x, z, y, ny, td) => void   the area grid's colour at a vertex (linear)
//   layout(ctx)      → { scene: {...}, summary: string }            scene.json's shard keys (after area / sea / chunk);
//                                                                    structures go to ctx.addObject / ctx.tryBuild

export async function groundColor({ THREE, imp, hf, def }) {
  const { lowPolyGroundColor } = await imp('src/world/Terrain.ts');
  const wl = def.ocean.level;
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
  const island = await imp('src/chunks/driftwood-isle.ts');
  const wl = def.ocean.level;
  // ── layout specs (desktop tier, as the bake's reference) ──
  const { Palms } = await imp('src/world/Palms.ts');
  const { Boulders } = await imp('src/world/Boulders.ts');
  const { Bushes } = await imp('src/world/Bushes.ts');
  const { Trailside } = await imp('src/world/Trailside.ts');
  const { Pier } = await imp('src/world/Pier.ts');
  const { Hut } = await imp('src/world/Hut.ts');
  const { HUT, LOOKOUT, SHRINE, WRECK } = island;
  const AVOID = [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }];
  const palms = Palms.scatterIsland(def.seed, undefined, AVOID);
  const rocks = Boulders.scatterShore(def.seed);
  const bushes = Bushes.scatterIsland(def.seed, undefined, AVOID);
  const trailside = Trailside.forIsland();

  // ── structures kept in blender mode, as bake occluders ──
  const sky = { setupMaterial() { /* no CSM in Node */ }, viewCamera: new THREE.PerspectiveCamera() };
  const pier = new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: wl + 1.2, landing: true }).build();
  addObject(pier.group);
  tryBuild('hut', () => new Hut(sky, HUT).build().group);
  tryBuild('trailside', () => new Trailside(sky).build(trailside).mesh);

  return {
    scene: {
      palms, rocks, bushes,
      trailside: { steps: trailside.steps ?? null, fences: trailside.fences ?? null, signs: trailside.signs ?? null },
      pier: { posts: pier.posts, bollards: pier.bollards, deckY: pier.deckY, colliders: pier.colliders },
      paths: island.PATHS, plateau: island.PLATEAU, hut: HUT,
    },
    summary: `palms ${palms.length}, rocks ${rocks.length}, bushes ${bushes.length}`,
  };
}
