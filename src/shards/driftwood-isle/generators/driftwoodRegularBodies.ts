/** Deterministic, genuinely separate low-poly rigs for the three Developer enemies. */
import * as THREE from 'three';
import { skinPlain, boneIndex, type Paint } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, BoneDef } from '@wildshard/engine/entities/species/registry';

type Point = [number, number, number];
function builder(bones: BoneDef[], dims: AnimalSpecies['dims']) {
  const body: AnimalSpecies = { bones, dims, furParts: [], hardParts: [], eyeParts: [] };
  const index = boneIndex(bones);
  function part(g: THREE.BufferGeometry, joint: string, color: number, eye = false): void {
    const tint = new THREE.Color(color);
    const paint: Paint = out => { out.copy(tint); };
    const flat = g.index === null ? g : g.toNonIndexed();
    if (flat !== g) g.dispose();
    skinPlain(flat, index(joint), 'body', paint);
    (eye ? body.eyeParts : body.hardParts).push(flat);
  }
  function ellipsoid(joint: string, at: Point, size: Point, color: number, eye = false): void {
    part(new THREE.IcosahedronGeometry(1, 1).scale(...size).translate(...at), joint, color, eye);
  }
  function rod(joint: string, from: Point, to: Point, r0: number, r1: number, color: number): void {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r1, r0, delta.length(), 5, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    a.add(b).multiplyScalar(.5);
    g.translate(a.x, a.y, a.z);
    part(g, joint, color);
  }
  return { body, part, ellipsoid, rod };
}
export function buildBrinePuffer(): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, .43, 0] },
    { name: 'belly', parent: 'body', pos: [0, .43, 0] },
    { name: 'head', parent: 'body', pos: [0, .52, .33] },
    { name: 'tail', parent: 'body', pos: [0, .40, -.40] },
    { name: 'finL', parent: 'body', pos: [.30, .20, 0] },
    { name: 'finR', parent: 'body', pos: [-.30, .20, 0] },
  ];
  const b = builder(bones, { bodyY: .43, bodyHalfLen: .20, bodyRadius: .34, headRadius: .15, legLen: .25, feet: [[.43, .03], [-.43, .03]], halfWidth: .43 });
  b.ellipsoid('belly', [0, .43, 0], [.42, .34, .43], 0xd8a34c);
  b.ellipsoid('belly', [0, .29, .08], [.34, .18, .34], 0xf2d8a0);
  b.ellipsoid('head', [0, .50, .36], [.24, .17, .17], 0xdca449);
  for (const s of [-1, 1]) {
    b.ellipsoid('head', [s * .15, .60, .43], [.10, .12, .07], 0xffefc6);
    b.ellipsoid('head', [s * .15, .60, .49], [.047, .067, .025], 0x172b30, true);
    b.ellipsoid(s > 0 ? 'finL' : 'finR', [s * .42, .13, .02], [.24, .075, .27], 0x299b91);
  }
  b.ellipsoid('tail', [0, .42, -.52], [.23, .13, .075], 0x218c85);
  // Spines belong to the inflating belly, so the complete silhouette expands physically.
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const x = Math.cos(a), z = Math.sin(a);
    b.rod('belly', [x * .35, .53, z * .35], [x * .48, .69, z * .48], .055, 0, 0xffe9b1);
  }
  return b.body;
}
export function buildConchDuelist(): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, .50, 0] },
    { name: 'head', parent: 'body', pos: [0, 1.02, .12] },
    { name: 'shell', parent: 'body', pos: [-.12, .74, -.13] },
    { name: 'guard', parent: 'body', pos: [-.28, .72, .12] },
    { name: 'thrust', parent: 'body', pos: [.24, .75, .13] },
    { name: 'foot', parent: 'body', pos: [0, .10, 0] },
  ];
  const b = builder(bones, { bodyY: .50, bodyHalfLen: .26, bodyRadius: .25, headRadius: .17, legLen: .4, feet: [[0, 0]], halfWidth: .38, capsuleAxis: 'y' });
  b.ellipsoid('body', [0, .57, .10], [.22, .44, .20], 0xde827f);
  b.ellipsoid('foot', [0, .12, .07], [.31, .12, .43], 0xbb686d);
  b.ellipsoid('head', [0, 1.02, .15], [.19, .17, .17], 0xefaaa0);
  for (const s of [-1, 1]) {
    b.rod('head', [s * .10, 1.10, .16], [s * .16, 1.30, .22], .033, .022, 0xefaaa0);
    b.ellipsoid('head', [s * .16, 1.30, .23], [.045, .05, .045], 0x173c43, true);
  }
  // Stacked eccentric coils give a true asymmetric spiral visible from every side.
  for (let i = 0; i < 7; i++) {
    const a = i * 1.12, r = .25 * (1 - i / 9);
    b.ellipsoid('shell', [-.12 + Math.cos(a) * r, .78 + Math.sin(a) * r, -.14 - i * .025], [.30 - i * .028, .29 - i * .025, .23 - i * .018], i % 2 ? 0xdcb775 : 0xf3d799);
  }
  b.rod('guard', [-.23, .70, .10], [-.37, .62, .38], .09, .06, 0xd7827c);
  b.ellipsoid('guard', [-.38, .67, .40], [.16, .24, .10], 0xead3a5);
  b.rod('thrust', [.22, .75, .13], [.36, .67, .43], .075, .055, 0xde827f);
  b.rod('thrust', [.36, .67, .43], [.37, .69, 1.02], .085, 0, 0xffeaca);
  return b.body;
}
export function buildSplinterMantis(): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, .86, 0] },
    { name: 'head', parent: 'body', pos: [0, 1.30, .12] },
  ];
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'L' : 'R';
    bones.push({ name: `arm${side}`, parent: 'body', pos: [s * .13, 1.10, .10] }, { name: `hook${side}`, parent: `arm${side}`, pos: [s * .35, .87, .30] });
    for (let i = 0; i < 2; i++) bones.push({ name: `leg${side}${i}`, parent: 'body', pos: [s * .10, .82, .10 - i * .30] }, { name: `knee${side}${i}`, parent: `leg${side}${i}`, pos: [s * .40, .44, .24 - i * .53] });
  }
  const b = builder(bones, { bodyY: .86, bodyHalfLen: .27, bodyRadius: .15, headRadius: .14, legLen: .83, feet: [[.52, .38], [-.52, .38], [.52, -.44], [-.52, -.44]], halfWidth: .24, capsuleAxis: 'y' });
  b.rod('body', [0, .63, -.17], [0, 1.22, .12], .14, .085, 0x8d6949);
  b.ellipsoid('head', [0, 1.36, .18], [.19, .13, .12], 0xb38c53);
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'L' : 'R';
    b.ellipsoid('head', [s * .14, 1.39, .25], [.056, .06, .035], 0xf0cc61, true);
    b.rod('head', [s * .08, 1.44, .14], [s * .17, 1.63, .10], .012, .005, 0x725638);
    b.ellipsoid('body', [s * .20, 1.03, -.17], [.24, .32, .035], 0x5f9864);
    b.rod(`arm${side}`, [s * .13, 1.10, .10], [s * .35, .87, .30], .055, .045, 0x9a7650);
    b.rod(`hook${side}`, [s * .35, .87, .30], [s * .34, 1.12, .62], .06, .025, 0xc4a269);
    b.rod(`hook${side}`, [s * .34, 1.12, .62], [s * .24, .94, .67], .035, 0, 0xe1c492);
    for (let i = 0; i < 2; i++) {
      b.rod(`leg${side}${i}`, [s * .10, .82, .10 - i * .30], [s * .40, .44, .24 - i * .53], .045, .033, 0x8a6748);
      b.rod(`knee${side}${i}`, [s * .40, .44, .24 - i * .53], [s * .52, .04, .38 - i * .82], .035, .012, 0x725239);
    }
  }
  return b.body;
}
export const DRIFTWOOD_REGULAR_BODY_BUILDERS = [
  { kind: 'brine-puffer', variant: 'brine-puffer', build: buildBrinePuffer },
  { kind: 'conch-duelist', variant: 'conch-duelist', build: buildConchDuelist },
  { kind: 'splinter-mantis', variant: 'splinter-mantis', build: buildSplinterMantis },
] as const;
