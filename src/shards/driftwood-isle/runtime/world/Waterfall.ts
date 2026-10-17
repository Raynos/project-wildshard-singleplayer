import { driftwoodRows } from '../boot/rows';
/**
 * Waterfall v3 (E150) — Driftwood's toon cascade, a stepped faceted curtain in the Wind Waker / Sea of Thieves manner.
 * It replaced the soft, blurred v2 curtain (DRIFTWOOD-REMASTER W5), which went in E162. SHARD-PLATFORM C2: its geometry
 * is baked with the cove's fixed draws (generators/cascade.ts, boot/fixedGeometry.ts); Driftwood's programs are material
 * graphs as data (data/waterfallLook.ts, W2 C2): three toon bands down each drop, a crisp white line at every brink, a
 * scalloped foam band where each step lands, bright streak dashes scrolling down; faceted foam rings on the pool; foam
 * puffs toon-lit in two bands.
 *
 *   const fall = waterfall();   // after loadFixedGeometry and the runtime's lendLooks; each call draws its own copies (SF63 rebuilds)
 *   scene.add(fall);
 */
import * as THREE from 'three';
import { lentLook } from '@wildshard/sdk/looks/lentLooks';
import { fixedDraw } from '../boot/blobAssets';

/** the toon cascade (E150): the baked curtain, pool rings and foam puffs on their lent graphs (data/waterfallLook.ts), drawn
 *  after the sea */
export function waterfall(): THREE.Group {
  const looks = { curtain: lentLook(driftwoodRows('custom/fixedLayouts').nativeView.CASCADE_LOOKS.curtain), pool: lentLook(driftwoodRows('custom/fixedLayouts').nativeView.CASCADE_LOOKS.pool), puffs: lentLook(driftwoodRows('custom/fixedLayouts').nativeView.CASCADE_LOOKS.puffs) };
  const group = new THREE.Group();
  const draw = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, order: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.renderOrder = order;
    group.add(mesh);
    return mesh;
  };
  draw('waterfall-sheet', fixedDraw('waterfallSheet').copy(), looks.curtain, 5);
  draw('waterfall-rings', fixedDraw('waterfallRings').copy(), looks.pool, 6);
  // a puff's vertices are its unit ball; the graph moves each to its `aCentre`, so the cull sphere is round the centres,
  // grown by the cascade's width and the spray's reach
  const puffs = draw('waterfall-puffs', fixedDraw('waterfallPuffs').copy(), looks.puffs, 7).geometry, centres = puffs.getAttribute('aCentre');
  if (!(centres instanceof THREE.BufferAttribute)) throw new Error('Driftwood: the baked cascade puffs lack their centres');
  const sphere = new THREE.Box3().setFromBufferAttribute(centres).getBoundingSphere(new THREE.Sphere());
  sphere.radius += 6.2;
  puffs.boundingSphere = sphere;
  return group;
}
