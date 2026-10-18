/** E487: deterministic, fully jointed toon bodies. Geometry is baked, never built per frame. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skinPlain, boneIndex, type Paint } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, BoneDef } from '@wildshard/engine/entities/species/registry';
import type { BakedCreatureBody } from './creatureBodies';

type Point = readonly [number, number, number];
const colours: Readonly<Record<string, number>> = { wood: 0x71503b, end: 0xb99a67, rope: 0xd3bb82, bell: 0x58a99a,
  lip: 0xd6ab58, dark: 0x244e47, heart: 0x65f0d3, eye: 0xffd888, leaf: 0x5e9870 };
const paint: Paint = (out, _x, _y, _z, _nx, _ny, _nz, part) => { out.setHex(colours[part] ?? 0x71503b); };
function rod(a: Point, b: Point, ra: number, rb: number, sides = 6): THREE.BufferGeometry {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const shape = new THREE.CylinderGeometry(rb, ra, delta.length(), sides, 1);
  shape.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
  return shape.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
}
function builder(bones: BoneDef[]) {
  const index = boneIndex(bones), hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const add = (shape: THREE.BufferGeometry, joint: string, part = 'wood') => {
    (part === 'heart' || part === 'eye' ? eyes : hard).push(skinPlain(shape, index(joint), part, paint));
  };
  const beam = (a: Point, b: Point, ra: number, rb: number, joint: string, part = 'wood', sides = 6) => add(rod(a, b, ra, rb, sides), joint, part);
  return { add, beam, hard, eyes };
}

/** Open wreck ribs, four load-bearing legs, a hollow bell and separate swinging clapper. */
export function buildBellback(): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 1.05, 0] },
    { name: 'head', parent: 'body', pos: [0, 1.1, .9] },
    { name: 'cradle', parent: 'body', pos: [0, 1.65, 0] },
    { name: 'bell', parent: 'cradle', pos: [0, 1.85, 0] },
    { name: 'clapper', parent: 'bell', pos: [0, 1.72, 0] },
  ];
  for (const [i, x, z] of [[0, -.72, .66], [1, .72, .66], [2, -.72, -.66], [3, .72, -.66]]) {
    if (i === undefined || x === undefined || z === undefined) continue;
    bones.push({ name: `leg${i}`, parent: 'body', pos: [x, 1, z] },
      { name: `knee${i}`, parent: `leg${i}`, pos: [x * 1.2, .52, z] });
  }
  const b = builder(bones);
  b.beam([0, 1.05, -.95], [0, 1.05, .86], .19, .23, 'body');
  for (const z of [-.7, 0, .7]) {
    for (const sx of [-1, 1]) {
      b.beam([sx * .72, .93, z], [sx * .63, 1.72, z], .12, .09, 'cradle');
      b.beam([sx * .63, 1.72, z], [0, 2.02, z], .09, .13, 'cradle', 'end');
    }
    b.beam([-.72, .93, z], [.72, .93, z], .1, .1, 'body');
  }
  b.beam([0, 2.02, -.8], [0, 2.02, .8], .11, .09, 'cradle');
  const bellProfile = [[.14, 1.82], [.25, 1.72], [.29, 1.38], [.47, 1.12], [.50, 1.08], [.43, 1.08], [.25, 1.37], [.21, 1.7], [.11, 1.75]];
  b.add(new THREE.LatheGeometry(bellProfile.map(([x = 0, y = 0]) => new THREE.Vector2(x, y)), 10), 'bell', 'bell');
  b.add(new THREE.TorusGeometry(.465, .045, 4, 10).rotateX(Math.PI / 2).translate(0, 1.1, 0), 'bell', 'lip');
  b.beam([0, 1.72, 0], [0, 1.03, 0], .035, .04, 'clapper', 'dark');
  b.add(new THREE.IcosahedronGeometry(.13, 0).translate(0, 1.03, 0), 'clapper', 'lip');
  b.add(new THREE.BoxGeometry(.45, .3, .42).rotateX(-.18).translate(0, 1.12, 1), 'head');
  for (const sx of [-1, 1]) b.add(new THREE.IcosahedronGeometry(.065).translate(sx * .17, 1.19, 1.22), 'head', 'eye');
  for (let i = 0; i < 4; i++) {
    const x = (i % 2 === 0 ? -1 : 1) * .72, z = i < 2 ? .66 : -.66;
    b.beam([x, 1, z], [x * 1.2, .52, z], .16, .13, `leg${i}`);
    b.beam([x * 1.2, .52, z], [x * 1.3, .12, z + .12], .12, .17, `knee${i}`);
    b.add(new THREE.BoxGeometry(.38, .17, .46).translate(x * 1.3, .1, z + .12), `knee${i}`, 'end');
    b.beam([x * .98, .92, z + .12], [x * 1.2, .55, z + .12], .032, .032, `leg${i}`, 'rope');
  }
  return { bones, furParts: [], hardParts: b.hard, eyeParts: b.eyes,
    dims: { bodyY: 1.05, bodyHalfLen: .7, bodyRadius: .65, headRadius: .25, legLen: .95,
      feet: [[-.94, .78], [.94, .78], [-.94, -.54], [.94, -.54]], halfWidth: .78 } };
}

/** Mangrove crown and open heart cage over four three-joint, octopus-like roots. */
export function buildTideRootColossus(): AnimalSpecies {
  const bones: BoneDef[] = [{ name: 'body', parent: null, pos: [0, 1.5, 0] },
    { name: 'head', parent: 'body', pos: [0, 2.4, .22] },
    { name: 'heart', parent: 'body', pos: [0, 2.05, .55] },
    { name: 'crown', parent: 'body', pos: [0, 2.75, 0] },
    { name: 'cageL', parent: 'body', pos: [-.45, 1.8, .5] }, { name: 'cageR', parent: 'body', pos: [.45, 1.8, .5] }];
  const roots: { a: Point; b: Point; c: Point; d: Point }[] = [];
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(angle), z = Math.cos(angle);
    const a: Point = [x * .6, 1.4, z * .6], b: Point = [x * 1.3, .8, z * 1.3], c: Point = [x * 2.1, .22, z * 2.1], d: Point = [x * 2.65, .16, z * 2.65];
    roots.push({ a, b, c, d });
    bones.push({ name: `root${i}`, parent: 'body', pos: [...a] }, { name: `bend${i}`, parent: `root${i}`, pos: [...b] },
      { name: `tip${i}`, parent: `bend${i}`, pos: [...c] });
  }
  const b = builder(bones);
  // Separate buttresses leave a visible central opening; the heart is not painted onto a cylinder.
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7, x = Math.sin(angle), z = Math.cos(angle);
    if (z > .5) continue;
    b.beam([x * .7, .8, z * .7], [x * .48, 2.8, z * .48], .27, .22, 'body');
    b.beam([x * .48, 2.7, z * .48], [x * .7, 3.35 + (i % 3) * .12, z * .7], .2, .04, 'crown', 'end');
  }
  b.beam([-.6, 1.35, .1], [.6, 1.35, .1], .25, .25, 'body');
  b.add(new THREE.IcosahedronGeometry(.38, 0).scale(.8, 1.3, .7).translate(0, 2.05, .55), 'heart', 'heart');
  for (const sx of [-1, 1]) {
    b.beam([sx * .5, 1.55, .65], [sx * .26, 2.15, .85], .11, .09, sx < 0 ? 'cageL' : 'cageR');
    b.beam([sx * .26, 2.15, .85], [sx * .48, 2.55, .48], .09, .12, sx < 0 ? 'cageL' : 'cageR');
    b.add(new THREE.IcosahedronGeometry(.1).translate(sx * .25, 2.65, .55), 'head', 'eye');
  }
  roots.forEach((root, i) => {
    b.beam(root.a, root.b, .32, .26, `root${i}`);
    b.beam(root.b, root.c, .26, .18, `bend${i}`);
    b.beam(root.c, root.d, .18, .045, `tip${i}`);
    for (let j = 0; j < 3; j++) {
      const t = j / 3, x = root.b[0] * (1 - t) + root.c[0] * t, y = root.b[1] * (1 - t) + root.c[1] * t, z = root.b[2] * (1 - t) + root.c[2] * t;
      b.add(new THREE.IcosahedronGeometry(.1, 0).scale(1, .4, 1).translate(x, y + .17, z), `bend${i}`, 'bell');
    }
    b.beam(root.a, [root.a[0] * 1.3, 2.7, root.a[2] * 1.3], .12, .02, 'crown', 'leaf');
  });
  return { bones, furParts: [], hardParts: b.hard, eyeParts: b.eyes,
    dims: { bodyY: 1.5, bodyHalfLen: .65, bodyRadius: .8, headRadius: .36, legLen: 1.4,
      feet: roots.map(r => [r.d[0], r.d[2]]), halfWidth: 1.2, capsuleAxis: 'y' } };
}
function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  // skinPlain preserves source indices; normalize to triangles before merging primitive families.
  const triangles = parts.map(g => g.index === null ? g : g.toNonIndexed());
  const merge = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null => mergeGeometries(geometries, false);
  const result = merge(triangles);
  if (result === null) throw new Error('Incompatible tidal giant geometry');
  for (const g of new Set([...parts, ...triangles])) g.dispose();
  result.deleteAttribute('normal'); return result;
}
export function bakeTidalGiantsBodies(): BakedCreatureBody[] {
  return [{ kind: 'bellback', build: buildBellback }, { kind: 'tideRootColossus', build: buildTideRootColossus }].map(({ kind, build }) => {
    const sp = build(); return { kind, variant: kind, bones: sp.bones, dims: sp.dims,
      fur: merged(sp.furParts), hard: merged(sp.hardParts), eye: merged(sp.eyeParts) };
  });
}
