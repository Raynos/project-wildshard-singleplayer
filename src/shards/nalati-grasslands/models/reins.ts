/**
 * The reins (NALATI-FINISH B1 / E320; E348, the E315 M5 leftover): the two leather straps a rider holds, from the hands
 * low over the withers, up each side of the neck, under the jowls to the bit. In the saddle (src/shards/nalati-grasslands/ride/ride.ts) the
 * viewmodel (src/shards/nalati-grasslands/ride/Reins.ts) rewrites them every frame from the horse's own bones; the card is a SEPARATE build by
 * the same builder (`buildReinsRibbon`) laid along the same path (`fillRein`) in a rest pose: the hands under the frame, a
 * horse's neck, jowl and bit ahead of the eye (camera space, then stood on the turntable's disc). Nothing the Explorer
 * does reaches the reins in your hands. One copy: the rider's.
 */
import * as THREE from 'three';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { BIT_BACK, BIT_OUT, buildReinsRibbon, fillRein, HAND_DEPTH, HAND_NDC, JOWL_DOWN, JOWL_OUT, NECK_DOWN, NECK_OUT } from '../ride/Reins';

/** the rest pose, camera space (the eye at the origin, looking down −z along the horse; the horse's left is −x): the crest
 *  of the neck, the head bone and the muzzle of a horse ridden at a walk, and a portrait phone's view (70°, 9:19.5) */
const CREST = new THREE.Vector3(0, -0.5, -1.05), HEAD = new THREE.Vector3(0, -0.55, -1.75), MUZZLE = new THREE.Vector3(0, -1.0, -2.1);
const TAN_F = Math.tan(THREE.MathUtils.degToRad(70) / 2), ASPECT = 9 / 19.5;
const LEFT = new THREE.Vector3(-1, 0, 0), UP = new THREE.Vector3(0, 1, 0);

export const reins: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/reins', name: 'Reins', category: 'gear', pipeline: 'code', file: 'src/shards/nalati-grasslands/models/reins.ts',
  defaults: {},
  build: () => {
    const { mesh, pos } = buildReinsRibbon();
    for (let r = 0; r < 2; r++) {
      const side = r === 0 ? 1 : -1; // (Reins.update: r 0 = the horse's left rein, on the screen's left)
      const bit = MUZZLE.clone().lerp(HEAD, BIT_BACK).addScaledVector(LEFT, side * BIT_OUT);
      const hand = new THREE.Vector3(-side * HAND_NDC.x * HAND_DEPTH * TAN_F * ASPECT, HAND_NDC.y * HAND_DEPTH * TAN_F, -HAND_DEPTH);
      const neck = CREST.clone().addScaledVector(UP, -NECK_DOWN).addScaledVector(LEFT, side * NECK_OUT);
      const jowl = HEAD.clone().addScaledVector(UP, -JOWL_DOWN).addScaledVector(LEFT, side * JOWL_OUT);
      fillRein(pos, r, [hand.clone().multiplyScalar(2).sub(neck), hand, neck, jowl, bit, bit.clone().multiplyScalar(2).sub(jowl)]);
    }
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    mesh.castShadow = true;
    const box = mesh.geometry.boundingBox ?? new THREE.Box3();
    mesh.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); // on the disc, centred
    const holder = new THREE.Group();
    holder.name = 'reins';
    holder.add(mesh);
    return holder;
  },
});
