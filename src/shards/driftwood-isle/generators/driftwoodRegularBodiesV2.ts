/** Unwired V2 visual proposal. V1 rig pivots, dimensions and gameplay contracts are retained. */
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
  /** Faceted, solid leaf blade; the ridge gives readable volume from both sides. */
  function blade(joint: string, base: Point, tip: Point, width: number, depth: number, color: number): void {
    const mid: Point = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2];
    const points = [base, [mid[0] - width, mid[1], mid[2]], tip,
      [mid[0] + width, mid[1], mid[2]], [mid[0], mid[1], mid[2] + depth],
      [mid[0], mid[1], mid[2] - depth]];
    const triangles = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4],
      [1, 0, 5], [2, 1, 5], [3, 2, 5], [0, 3, 5]];
    const vertices = triangles.flatMap(face => face.flatMap(i => points[i] ?? []));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    part(geometry, joint, color);
  }
  return { body, part, ellipsoid, rod, blade };
}
export function buildBrinePufferV2(): AnimalSpecies {
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
  // A small puckered muzzle and highlights make the face read at portrait scale.
  b.ellipsoid('head', [0, .455, .494], [.075, .058, .028], 0xf3d49a);
  b.ellipsoid('head', [0, .455, .519], [.039, .030, .008], 0x674735);
  for (const s of [-1, 1]) {
    b.ellipsoid('head', [s * .15 - .012, .625, .512], [.016, .019, .009], 0xffffff, true);
    for (let i = 0; i < 3; i++) b.rod(s > 0 ? 'finL' : 'finR',
      [s * .34, .19, .02], [s * (.46 + i * .055), .17, -.13 + i * .12], .012, .006, 0x70c6b1);
    for (let i = 0; i < 3; i++) b.ellipsoid('belly', [s * (.29 + i * .035), .43 + i * .045, .27 - i * .08], [.03, .026, .014], 0xa77538);
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
export function buildConchDuelistV2(): AnimalSpecies {
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
  // One substantial shell with a raised continuous spiral, rather than overlapping balls.
  b.ellipsoid('shell', [-.14, .78, -.17], [.40, .38, .242], 0xd9a45e);
  b.ellipsoid('shell', [-.14, .79, -.12], [.365, .35, .20], 0xf3d799);
  for (let i = 0; i < 30; i++) {
    const a = i * .34, next = (i + 1) * .34;
    const r = .31 * (1 - i / 36), rn = .31 * (1 - (i + 1) / 36);
    b.rod('shell', [-.14 + Math.cos(a) * r, .79 + Math.sin(a) * r, .058],
      [-.14 + Math.cos(next) * rn, .79 + Math.sin(next) * rn, .058], .021, .021, 0xa96f42);
  }
  // The stalk eyes remain at the same pivots, now with explicit sclera, pupil and glint.
  for (const s of [-1, 1]) {
    b.ellipsoid('head', [s * .16, 1.30, .235], [.065, .05, .055], 0xffedc9);
    b.ellipsoid('head', [s * .16, 1.30, .282], [.034, .036, .018], 0x19393b, true);
    b.ellipsoid('head', [s * .16 - .008, 1.315, .296], [.010, .012, .006], 0xffffff, true);
    b.ellipsoid('head', [s * .12, 1.035, .284], [.043, .025, .015], 0xd36b6f);
  }
  b.ellipsoid('head', [0, .99, .305], [.057, .016, .012], 0x753c48);
  b.rod('guard', [-.23, .70, .10], [-.37, .62, .38], .09, .06, 0xd7827c);
  b.ellipsoid('guard', [-.38, .67, .40], [.16, .24, .10], 0xead3a5);
  b.blade('guard', [-.38, .48, .49], [-.38, .87, .49], .12, .035, 0xf8e4bb);
  b.rod('thrust', [.22, .75, .13], [.36, .67, .43], .075, .055, 0xde827f);
  b.rod('thrust', [.36, .67, .43], [.37, .69, 1.02], .085, 0, 0xffeaca);
  return b.body;
}
export function buildSplinterMantisV2(): AnimalSpecies {
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
    b.rod(`arm${side}`, [s * .13, 1.10, .10], [s * .35, .87, .30], .087, .068, 0x9a7650);
    b.rod(`hook${side}`, [s * .35, .87, .30], [s * .34, 1.12, .62], .085, .045, 0xc4a269);
    b.ellipsoid(`arm${side}`, [s * .13, 1.10, .10], [.09, .10, .085], 0x665239);
    b.ellipsoid(`hook${side}`, [s * .35, .87, .30], [.077, .077, .077], 0xe2bb78);
    b.blade(`hook${side}`, [s * .35, .87, .30], [s * .34, 1.12, .62], .105, .045, 0xb6b575);
    for (let tooth = 0; tooth < 3; tooth++) b.rod(`hook${side}`,
      [s * .30, .91 + tooth * .065, .39 + tooth * .075],
      [s * .23, .87 + tooth * .065, .41 + tooth * .075], .022, 0, 0xf0dca5);
    b.rod(`hook${side}`, [s * .34, 1.12, .62], [s * .24, .94, .67], .035, 0, 0xe1c492);
    b.ellipsoid('head', [s * .15, 1.39, .274], [.025, .04, .015], 0x233c37, true);
    b.blade('body', [s * .08, .73, -.15], [s * .22, 1.27, -.17], .15, .045, 0x83ad70);
    for (let i = 0; i < 2; i++) {
      b.ellipsoid(`knee${side}${i}`, [s * .40, .44, .24 - i * .53], [.055, .068, .055], 0xb79a64);
      b.rod(`leg${side}${i}`, [s * .10, .82, .10 - i * .30], [s * .40, .44, .24 - i * .53], .064, .046, 0x8a6748);
      b.rod(`knee${side}${i}`, [s * .40, .44, .24 - i * .53], [s * .52, .04, .38 - i * .82], .035, .012, 0x725239);
    }
  }
  for (let i = 0; i < 3; i++) b.ellipsoid('body', [0, .76 + i * .13, -.08 + i * .06], [.14 - i * .015, .10, .12], i % 2 ? 0xa78954 : 0x756346);
  return b.body;
}
export const DRIFTWOOD_REGULAR_BODY_BUILDERS_V2 = [
  { kind: 'brine-puffer', variant: 'brine-puffer', build: buildBrinePufferV2 },
  { kind: 'conch-duelist', variant: 'conch-duelist', build: buildConchDuelistV2 },
  { kind: 'splinter-mantis', variant: 'splinter-mantis', build: buildSplinterMantisV2 },
] as const;
