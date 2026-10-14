import { InstancedMesh, Mesh, type Group } from 'three';
import { CROWN, DAIS } from '../data/layout';
import { hdMaterial, skyHd } from './meshes';
import { skyMappedLook } from './looks';
import STONES from '../data/crownInstances.generated.json' with { type: 'json' };
import { WORLD } from './baked';

/**
 * The arena (loop 4, mockup D), in world space (add it to the level root): the modelled standing stones with cut spiral
 * runes and the carved compass dais (top-10 row 7, art/far-reach/round-28-crown/; undrawn when a model did not load), and
 * the pennant ropes and flags, built offline (`generators/crown.ts` → `baked/crown.glb`); its colliders are the rows'
 * (the dais and each stone).
 */
export function crownArena(): { group: Group; colliders: ReturnType<typeof WORLD.piece>['colliders'] } {
  const baked = WORLD.piece('crown'), group = baked.root; group.name = 'far.crown.arena';
  group.add(...carvedSet());
  return { group, colliders: baked.colliders };
}

/** The modelled stones (two models, alternating) and dais; none when one failed to load. */
function carvedSet(): Mesh[] {
  const a = skyHd('crown-stone'), b = skyHd('crown-stone-b'), d = skyHd('crown-dais');
  if (a === null || b === null || d === null) return [];
  const out: Mesh[] = [];
  for (const [k, made] of [a, b].entries()) {
    const matrices = STONES[k];
    if (matrices === undefined) throw new Error('Missing crown instance rows');
    const g = made.geometry;
    const mesh = new InstancedMesh(g, hdMaterial(made.map), matrices.length / 16); mesh.name = `far.crown.stone-${k}`;
    mesh.instanceMatrix.array.set(matrices);
    mesh.computeBoundingSphere(); out.push(mesh);
  }
  const dg = d.geometry;
  // the paint came out red-brown; mockup D's dais is weathered grey stone with a warm cast (data/paintLook.ts)
  const dais = new Mesh(dg, skyMappedLook('crown-dais', d.map)); dais.name = 'far.crown.dais'; dais.position.set(DAIS.x, CROWN.y - 0.08, DAIS.z);
  out.push(dais);
  return out;
}
