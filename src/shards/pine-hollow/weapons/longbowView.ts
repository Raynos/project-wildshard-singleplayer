import * as THREE from 'three';
import type { ProjectileKind } from '@wildshard/engine/combat/view/projectile';
import { fixIBL, viewmodelMaterial } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { BowView } from '@wildshard/sdk/weapons/bowProfile';
import { arrowGeometry, bowPoses, staveBowSpecimen, staveBowView } from '@wildshard/sdk/viewmodel/staveBow';
import { LONGBOW_ARROW, LONGBOW_LOOK, LONGBOW_MATERIAL, LONGBOW_POSES } from '../data/longbowLook';
import { ARROW_FLIGHT, ARROW_MAX_FLYING } from './longbowFlight';

/** The arrow's length (TIP at the origin, shaft along +Z — Projectiles.ts's convention). */
export const ARROW_LEN = LONGBOW_ARROW.length;
/** The arrow: an ash shaft, a sinew-bound bodkin head, three grey-goose feathers (data/longbowLook.ts LONGBOW_ARROW). */
export function buildArrowGeometry(): THREE.BufferGeometry { return arrowGeometry(LONGBOW_ARROW); }

/** the arrows' one standard material (the world pool's; E348: the Model Explorer's arrow card makes its own) */
export function arrowMaterial(sky: Sky): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
  material.name = 'longbow-arrow'; fixIBL(material, 'longbow-arrow'); sky.setupMaterial(material);
  return material;
}

/** the arrow as a `Projectiles` kind: one instanced standard material for every arrow in flight or stuck in the world */
export function arrowKind(sky: Sky): ProjectileKind {
  const material = arrowMaterial(sky);
  return { geometry: buildArrowGeometry(), material, length: ARROW_LEN, ...ARROW_FLIGHT, bury: 0.09, recover: 0.7, maxFlying: ARROW_MAX_FLYING, maxStuck: 48 };
}

/** The Longbow's grip poses in rig space (data/longbowLook.ts LONGBOW_POSES). */
export const POSE = bowPoses(LONGBOW_POSES);

/** the longbow's one material: the viewmodels' shared lit program (vertex colours × the 1×1 fillers) — waxed yew, leather, linen */
function longbowMaterial(sky: Sky): THREE.MeshPhysicalMaterial {
  return viewmodelMaterial(sky, 'longbow', { ...LONGBOW_MATERIAL });
}

/**
 * The Model Explorer's card (src/shards/pine-hollow/models/gear.ts): what `displayModel` shows — the braced stave and the
 * left glove on it (the bow's one mesh) — built as the viewmodel builds it on its own material, without a bow in your hands.
 */
export function longbowSpecimen(sky: Sky): THREE.Group {
  const m = new THREE.Mesh(staveBowSpecimen(LONGBOW_LOOK), longbowMaterial(sky));
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

/** The held Longbow's view: the yew stave, its string and arrow, the hunter's gloved hands (@wildshard/sdk/viewmodel/staveBow). */
export function buildLongbow(sky: Sky): BowView {
  return staveBowView(LONGBOW_LOOK, longbowMaterial(sky));
}
