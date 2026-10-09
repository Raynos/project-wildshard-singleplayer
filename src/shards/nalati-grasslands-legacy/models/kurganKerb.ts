/**
 * The kurgan kerb stone (E306 / E315 M3): one of the set stones ringing a Wusun burial mound's foot — a lumpy granite
 * block standing on end (a few fallen flat), lichen gold on its top. Painted into its place's one mesh
 * (src/shards/nalati-grasslands/world/painted.ts); every copy its own shape, drawn from the place's rng stream after the ring has chosen
 * where it stands: its squash, its shape, its shade, a little twist and tilt. The kurgan field's rings place ~300.
 * No colliders (the mound under it is the ground).
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { M } from '../world/paint';
import { blob } from '@wildshard/engine/world/geometryKit';
import { painted, type Paint } from '../world/painted';

export interface KurganKerbParams {
  /** radius, metres */
  readonly s: number;
  /** lying flat on its side (robbed and toppled) */
  readonly fallen: boolean;
}

const C = { kerb: new THREE.Color('#948f86'), kerbDark: new THREE.Color('#77736c'), lichen: new THREE.Color('#b9a45a') };

/** `at`: the stone's foot on the ground, `yaw` the ring's angle there */
const paint: Paint<KurganKerbParams> = (kit, at, p) => {
  const rng = kit.rng;
  const g = blob(p.s, rng, 1, p.fallen ? 0.45 : rng.range(0.9, 1.35), 0.2);
  kit.add(g, rng.next() < 0.4 ? C.kerbDark : C.kerb, { matrix: M(at.x, at.y + p.s * (p.fallen ? 0.2 : 0.45), at.z, at.yaw + rng.range(-0.3, 0.3), 1, 1, 1, p.fallen ? 1.2 : rng.range(-0.1, 0.1)), top: { color: C.lichen, threshold: 0.5, amount: 0.5 }, brush: 0.1 });
  return {};
};

export const kurganKerb = defineModel<KurganKerbParams>({
  id: 'nalati-grasslands/kurgan-kerb', name: 'Kurgan kerb stone', category: 'props', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/kurganKerb.ts', surface: 'stone',
  defaults: { s: 0.45, fallen: false },
  variants: [{ id: 'standing', label: 'Standing', params: {} }, { id: 'fallen', label: 'Fallen', params: { fallen: true } }],
  build: painted(paint, { seed: 0x4b62 }),
});
