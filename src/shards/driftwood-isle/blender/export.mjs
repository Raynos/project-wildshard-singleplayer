import SHORE from '../data/shoreBoulders.generated.json' with {type:'json'};
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
  const { lowPolyGroundColor } = await imp('src/shards/driftwood-isle/generators/groundColor.ts');
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

export async function layout({ THREE, imp, def, addObject, tryBuild }) {
  const island = await imp('src/shards/driftwood-isle/world/sites.ts');
  const terrainLayout = (await imp('src/shards/driftwood-isle/data/layout.json')).default;
  // ── layout specs (desktop tier, as the bake's reference) ──
  const { originalTrailside } = await imp('src/shards/driftwood-isle/generators/driftwoodTrailside.mjs');
  const { islandTrailsideSpec } = await imp('src/shards/driftwood-isle/generators/trailsideLayout.ts');
  const { originalPiers } = await imp('src/shards/driftwood-isle/generators/driftwoodPiers.ts');
  const { originalHut } = await imp('src/shards/driftwood-isle/generators/driftwoodHut.mjs');
  const { HUT } = island;
  if (FOLIAGE.seed !== def.seed) throw new Error('Foliage placements require their authored seed');
  const palms = FOLIAGE.tiers.desktop.palms.specs;
  if (SHORE.seed !== def.seed) throw new Error('Shore placements require their authored seed');
  const rocks = structuredClone(SHORE.specs);
  const bushes = FOLIAGE.tiers.desktop.bushes.specs;
  const trailside = islandTrailsideSpec();

  // ── structures kept in blender mode, as bake occluders ──
  const madePiers = originalPiers(), site = madePiers.rows[0];
  if (!site?.world) throw new Error('South pier is missing from the author bake');
  const pier = { ...site.world, colliders: site.world.boxes, group: new THREE.Group() };
  pier.group.position.set(site.world.x, site.world.deckY, site.world.z);
  for (const part of ['deck', 'cloth']) { const geometry = madePiers.geometry.get(`pier-world-0-${part}`); if (geometry) pier.group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }))); }
  addObject(pier.group);
  tryBuild('hut', () => { const row = originalHut(), group = new THREE.Group(), material = new THREE.MeshBasicMaterial({ vertexColors: true }); group.position.copy(row.layout.origin); group.add(new THREE.Mesh(row.kit, material), new THREE.Mesh(row.flames, material)); return group; });
  tryBuild('trailside', () => new THREE.Mesh(originalTrailside().geometry, new THREE.MeshBasicMaterial({ vertexColors: true })));

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
