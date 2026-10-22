import * as THREE from 'three';
import { zlibSync } from 'fflate';
import { parse } from 'valibot';
import { ReinPresentationSchema } from '@wildshard/format/riding';
import { SpecimenBookSchema } from '@wildshard/format/specimenCatalogue';
import { buildReinsRibbon, fillRein } from '@wildshard/game/riding/reins';
import reins from '../data/reins.json' with { type: 'json' };
import { join, writeGeometry } from './geometryWriter';

// the Explorer's straps as the rider sees them: crest, head and muzzle of the camp horse, the phone's 70° portrait view
const CREST = new THREE.Vector3(0, -.5, -1.05), HEAD = new THREE.Vector3(0, -.55, -1.75), MUZZLE = new THREE.Vector3(0, -1, -2.1), FOV = 70, ASPECT = 9 / 19.5;

/** The reins card (G600 L7): the live straps' ribbon baked once, from the rider's hands to the bit, feet at y 0. */
export function reinsCard(): ReturnType<typeof parse<typeof SpecimenBookSchema>> {
  const profile = parse(ReinPresentationSchema, reins), { mesh, pos } = buildReinsRibbon(profile), tan = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
  const left = new THREE.Vector3(-1, 0, 0), up = new THREE.Vector3(0, 1, 0);
  for (let r = 0; r < 2; r++) {
    const side = r === 0 ? 1 : -1;
    const bit = MUZZLE.clone().lerp(HEAD, profile.bit.back).addScaledVector(left, side * profile.bit.out);
    const hand = new THREE.Vector3(-side * profile.hand.x * profile.hand.depth * tan * ASPECT, profile.hand.y * profile.hand.depth * tan, -profile.hand.depth);
    const neck = CREST.clone().addScaledVector(up, -profile.neck.down).addScaledVector(left, side * profile.neck.out);
    const jowl = HEAD.clone().addScaledVector(up, -profile.jowl.down).addScaledVector(left, side * profile.jowl.out);
    fillRein(pos, r, [hand.clone().multiplyScalar(2).sub(neck), hand, neck, jowl, bit, bit.clone().multiplyScalar(2).sub(jowl)], profile);
  }
  const geometry = mesh.geometry; geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); geometry.computeBoundingBox();
  const blocks: Uint8Array[] = [], row = writeGeometry(geometry, blocks, 'reins card');
  let text = ''; for (const byte of zlibSync(join(blocks))) text += String.fromCodePoint(byte);
  geometry.dispose();
  return parse(SpecimenBookSchema, { materials: {}, rows: [{ key: 'reins',
    model: { id: 'nalati-grasslands/reins', name: 'Reins', file: 'src/shards/nalati-grasslands/generators/reinsCard.ts', category: 'gear', pipeline: 'code', defaults: {} },
    source: { kind: 'inline', data: btoa(text), geometry: row,
      material: { id: 'nalati-reins', family: 'painterly', rim: profile.paint.rim, bands: profile.paint.bands, side: 'double' } } }] });
}
