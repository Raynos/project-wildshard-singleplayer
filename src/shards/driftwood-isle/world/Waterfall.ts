/**
 * Waterfall v3 (E150) — Driftwood's toon cascade, a stepped faceted curtain in the Wind Waker / Sea of Thieves manner.
 * It replaced the soft, blurred v2 curtain (DRIFTWOOD-REMASTER W5), which went in E162. SHARD-PLATFORM C2: its geometry
 * is baked with the cove's fixed draws (generators/cascade.ts, boot/fixedGeometry.ts); Driftwood's programs are material
 * graphs as data (data/waterfallLook.ts, W2 C2): three toon bands down each drop, a crisp white line at every brink, a
 * scalloped foam band where each step lands, bright streak dashes scrolling down; faceted foam rings on the pool; foam
 * puffs toon-lit in two bands.
 *
 *   const fall = waterfall();   // after loadFixedGeometry and setWaterfallLooks; each call draws its own copies (SF63 rebuilds)
 *   scene.add(fall);
 */
import * as THREE from 'three';
import { CASCADE_LOOKS } from '../data/waterfallLook';
import { WATERFALL_PUFFS_GEOMETRY, WATERFALL_RINGS_GEOMETRY, WATERFALL_SHEET_GEOMETRY } from '../boot/fixedGeometry';

/** the compiled graphs the three draws wear */
interface CascadeMaterials { readonly curtain: THREE.Material; readonly pool: THREE.Material; readonly puffs: THREE.Material }

let looks: CascadeMaterials | null = null;
/** hand the cascade its compiled graphs (look.materials, data/waterfallLook.ts) before the world builds */
export function setWaterfallLooks(materials: ReadonlyMap<string, THREE.Material>): void {
  const curtain = materials.get(CASCADE_LOOKS.curtain), pool = materials.get(CASCADE_LOOKS.pool), puffs = materials.get(CASCADE_LOOKS.puffs);
  if (curtain === undefined || pool === undefined || puffs === undefined) throw new Error('Driftwood: look.materials lacks the cascade graphs');
  looks = { curtain, pool, puffs };
}

/** the toon cascade (E150): the baked curtain, pool rings and foam puffs on their graphs, drawn after the sea */
export function waterfall(): THREE.Group {
  if (looks === null) throw new Error('Driftwood: the cascade graphs were not compiled before the world build');
  const group = new THREE.Group();
  const draw = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, order: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.renderOrder = order;
    group.add(mesh);
    return mesh;
  };
  draw('waterfall-sheet', WATERFALL_SHEET_GEOMETRY.copy(), looks.curtain, 5);
  draw('waterfall-rings', WATERFALL_RINGS_GEOMETRY.copy(), looks.pool, 6);
  // a puff's vertices are its unit ball; the graph moves each to its `aCentre`, so the cull sphere is round the centres,
  // grown by the cascade's width and the spray's reach
  const puffs = draw('waterfall-puffs', WATERFALL_PUFFS_GEOMETRY.copy(), looks.puffs, 7).geometry, centres = puffs.getAttribute('aCentre');
  if (!(centres instanceof THREE.BufferAttribute)) throw new Error('Driftwood: the baked cascade puffs lack their centres');
  const sphere = new THREE.Box3().setFromBufferAttribute(centres).getBoundingSphere(new THREE.Sphere());
  sphere.radius += 6.2;
  puffs.boundingSphere = sphere;
  return group;
}
