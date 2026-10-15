import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wildlifeGeometry } from './wildlife';
import { KIND } from '../data/wildlifeKinds';
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { BIRD_FRAMES } from '../data/birdFrames';
import { clingPose,inflateBody,type ClingFeet } from './birdFrames';

const isMesh=(node:THREE.Object3D):node is THREE.Mesh=>node instanceof THREE.Mesh;
type V3=readonly [number,number,number];
interface PreparedBird {kind:number;fly:boolean;geo:THREE.BufferGeometry;parts:Uint8Array;shoulderL:V3;shoulderR:V3;neck:V3;rough:number;eyes:boolean}
interface Side {
  shoulderL: V3; shoulderR: V3; bodyHalfWidth: number; neck: V3; headAxis?: V3; feetY: number;
  tailRoot?: V3; tailAxis?: V3; beakTip?: V3; tailTip?: V3;
}
interface Sidecar { meshes: Record<string, Side | undefined> }

/** a decimated generation reads faceted (its normals split along every uv seam and hard edge): one normal per position,
 *  area-weighted over the faces round it, keeping the vertices (and their uvs) split */
function smoothNormals(g: THREE.BufferGeometry): void {
  const pos = g.getAttribute('position'), idx = g.getIndex();
  const key = (i: number): string => `${Math.round(pos.getX(i) * 2e4)},${Math.round(pos.getY(i) * 2e4)},${Math.round(pos.getZ(i) * 2e4)}`;
  const acc = new Map<string, THREE.Vector3>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const tri = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < tri; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const n = c.sub(b).cross(a.sub(b)); // area-weighted
    for (const i of [i0, i1, i2]) { const k = key(i); const v = acc.get(k); if (v) v.add(n); else acc.set(k, n.clone()); }
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = acc.get(key(i));
    if (!v) continue;
    const l = v.length() || 1;
    out[i * 3] = v.x / l; out[i * 3 + 1] = v.y / l; out[i * 3 + 2] = v.z / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
const tf = (m: THREE.Matrix4, p: V3): V3 => { _v.set(p[0], p[1], p[2]).applyMatrix4(m); return [_v.x, _v.y, _v.z]; };

/** the geometry's float array of `name` (parseBirds builds every attribute as a Float32Array) */
function floats(g: THREE.BufferGeometry, name: string): Float32Array | null {
  const a = g.getAttribute(name).array;
  return a instanceof Float32Array ? a : null;
}

/** E322 F-M5: the clinging woodpecker's new feet appended to its geometry (position / uv / index; body part 0; the
 *  normals are rebuilt after). Returns the parts grown to match. */
function appendFeet(g: THREE.BufferGeometry, parts: Uint8Array, f: ClingFeet): Uint8Array {
  const P = floats(g, 'position'), U = floats(g, 'uv'), idx = g.getIndex();
  if (!P || !U || !idx) return parts;
  const n0 = P.length / 3, nf = f.pos.length / 3;
  const pos = new Float32Array(P.length + f.pos.length); pos.set(P); pos.set(f.pos, P.length);
  const uv = new Float32Array(U.length + f.uv.length); uv.set(U); uv.set(f.uv, U.length);
  const ix = new Uint32Array(idx.count + f.idx.length);
  for (let i = 0; i < idx.count; i++) ix[i] = idx.getX(i);
  for (let i = 0; i < f.idx.length; i++) ix[idx.count + i] = (f.idx[i] ?? 0) + n0;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(ix, 1));
  const out = new Uint8Array(n0 + nf); out.set(parts);
  return out;
}

function parseBirds(root: THREE.Object3D,side:Sidecar):PreparedBird[] {
  root.updateMatrixWorld(true);
  const found = new Map<string, THREE.Mesh>();
  root.traverse((o) => { if(isMesh(o))found.set(o.name,o); });
  
  const meshes: PreparedBird[] = [];
  for (const b of BIRD_FRAMES) {
    for (const fly of [false, true]) {
      const name = `${b.name}_${fly ? 'fly' : 'perch'}`, mesh = found.get(name), s = side.meshes[name];
      if (!mesh || !s) throw new Error(`[birds] no '${name}' in the GLB / sidecar`);
      // plain float geometry (meshopt's quantised streams decoded, the node's transform applied)
      const src = mesh.geometry, g = new THREE.BufferGeometry();
      for (const [attr, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
        const a=src.getAttribute(attr);
        if (a.count===0) throw new Error(`[birds] ${name}: no ${attr}`);
        const out = new Float32Array(a.count * size);
        for (let i = 0; i < a.count; i++) { out[i * size] = a.getX(i); out[i * size + 1] = a.getY(i); if (size === 3) out[i * size + 2] = a.getZ(i); }
        g.setAttribute(attr, new THREE.BufferAttribute(out, size));
      }
      const idx = src.getIndex();
      if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.array), 1));
      g.applyMatrix4(mesh.matrixWorld);
      // E322 F-M5: the flying owl's body given volume, in the generated frame (the normals are rebuilt just below)
      const P = floats(g, 'position'), Nr = floats(g, 'normal');
      if (b.kind === 1 && fly && P && Nr) inflateBody(P, Nr, s);
      smoothNormals(g);
      // the parts, in the generated frame: flying, outboard of the body's half-width a wing; the head past the plane
      // through the neck across its axis (+z flying; up-and-forward on the upright perched birds)
      const pos = g.getAttribute('position');
      let parts: Uint8Array = new Uint8Array(pos.count);
      const N = s.neck, A = s.headAxis ?? [0, 0, 1];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (fly && Math.abs(x) > s.bodyHalfWidth) parts[i] = x < 0 ? 1 : 2;
        else if ((x - N[0]) * A[0] + (y - N[1]) * A[1] + (z - N[2]) * A[2] > 0) parts[i] = 3;
      }
      // into the pose frame (identity for the flying ones)
      _m.identity();
      if (!fly) {
        // the feet at the procedural stand height, then the tilt: the perch pitch undone (the raven / owl stand as
        // modelled), or the body axis laid level (the woodpecker: its perch pitch then stands it up the trunk)
        const lift = new THREE.Matrix4().makeTranslation(0, -b.feet - s.feetY, 0);
        let tilt: number = b.perchPitch;
        if (b.level && s.tailRoot && s.beakTip) tilt = Math.atan2(s.beakTip[1] - s.tailRoot[1], s.beakTip[2] - s.tailRoot[2]);
        // three's rotation about +x by +a turns the nose (+z) down: the instance's nose-up pitch takes it back
        _m.makeRotationX(tilt).multiply(lift);
        g.applyMatrix4(_m);
        // E322 F-M5: the woodpecker clinging to its bark (legs folded, tail propped); the pivots take its rigid move
        const Q = floats(g, 'position');
        if (b.kind === 2 && Q) {
          const cling = clingPose(Q, s, _m.clone(), { pitch: b.perchPitch, uv: floats(g, 'uv') });
          _m.premultiply(cling.move);
          parts = appendFeet(g, parts, cling.feet);
          smoothNormals(g);
        }
        // the head held back by the pitch the life code pitches it down by (the owl's 1.1 on its perch)
        if (b.headPitch !== 0) {
          const n = tf(_m, s.neck), r = new THREE.Matrix4().makeTranslation(n[0], n[1], n[2]).multiply(new THREE.Matrix4().makeRotationX(-b.headPitch)).multiply(new THREE.Matrix4().makeTranslation(-n[0], -n[1], -n[2]));
          const rn = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationX(-b.headPitch));
          const pa = g.getAttribute('position'), na = g.getAttribute('normal'), v = new THREE.Vector3();
          for (let i = 0; i < pa.count; i++) {
            if (parts[i] !== 3) continue;
            v.fromBufferAttribute(pa, i).applyMatrix4(r); pa.setXYZ(i, v.x, v.y, v.z);
            v.fromBufferAttribute(na, i).applyMatrix3(rn); na.setXYZ(i, v.x, v.y, v.z);
          }
        }
      }
      g.computeBoundingSphere();
      meshes.push({
        kind: b.kind, fly, geo: g, parts,
        shoulderL: tf(_m, s.shoulderL), shoulderR: tf(_m, s.shoulderR), neck: tf(_m, s.neck), rough: b.rough, eyes: b.eyes,
      });
    }
  }
  return meshes;
}

interface PackedRange {kind: number; start: number; count: number; box: [number, number, number, number, number, number]}
function packedBox(geometry: THREE.BufferGeometry): PackedRange['box'] {
  geometry.computeBoundingBox(); const box = geometry.boundingBox;
  if (box === null) throw new Error('Missing authored wildlife bounds');
  return [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
}
/** Author the final one-draw channels; live instances only supply their pose. */
export async function bakeBirds(bytes: Uint8Array, sidecar: Sidecar): Promise<{
  glb: Uint8Array; ranges: PackedRange[];
}> {
  const source = await readSourceModel(bytes), prepared = parseBirds(source.gltf.scene, sidecar);
  const parts: THREE.BufferGeometry[] = [], ranges: PackedRange[] = [];
  const material = new THREE.MeshStandardMaterial();
  let start = 0;
  for (const bird of prepared) {
    const geometry = bird.geo, position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    const pivot = new Float32Array(position.count * 3), info = new Float32Array(position.count * 4), tex = new Float32Array(position.count * 4);
    const pivots = [[0, 0, 0], bird.shoulderL, bird.shoulderR, bird.neck] as const, ids = [0, 1, 2, 3];
    for (let i = 0; i < position.count; i++) {
      const slot = bird.parts[i] ?? 0, part = ids[slot] ?? 0;
      pivot.set(pivots[slot] ?? [0, 0, 0], i * 3);
      info.set([part, bird.kind, bird.rough, bird.eyes && part === 3 ? 1 : 0], i * 4);
      tex.set([uv.getX(i), uv.getY(i), 1, bird.fly ? 1 : 0], i * 4);
    }
    geometry.deleteAttribute('uv');
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(position.count * 3).fill(1), 3));
    geometry.setAttribute('aPivot', new THREE.BufferAttribute(pivot, 3));
    geometry.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
    geometry.setAttribute('aTexV', new THREE.BufferAttribute(tex, 4));
    const count = geometry.getIndex()?.count ?? position.count;
    const previous = ranges.at(-1), box = packedBox(geometry);
    if (previous?.kind === bird.kind) {
      previous.count += count;
      previous.box = [Math.min(previous.box[0], box[0]), Math.min(previous.box[1], box[1]), Math.min(previous.box[2], box[2]),
        Math.max(previous.box[3], box[3]), Math.max(previous.box[4], box[4]), Math.max(previous.box[5], box[5])];
    } else ranges.push({kind: bird.kind, start, count, box});
    start += count; parts.push(geometry);
  }
  const hare = wildlifeGeometry(KIND.hare), texture = hare.getAttribute('aTex');
  hare.setAttribute('aTexV', texture); hare.deleteAttribute('aTex'); parts.push(hare);
  ranges.push({kind: KIND.hare, start, count: hare.getIndex()?.count ?? 0, box: packedBox(hare)});
  const geometry = mergeGeometries(parts);
  try {
    const raw = staticGlb([{name: 'wildlife', geometry, material, compactIndex: true,
      customAttributes: {_PIVOT: 'aPivot', _INFO: 'aInfo', _TEX: 'aTexV'}}], 'ambient-wildlife');
    await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
    const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE).registerExtensions([EXTMeshoptCompression])
      .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
    const document = await io.readBinary(raw);
    // No reorder, quantize or filters: the codec preserves the authored Float32 words.
    document.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE});
    return {glb: await io.writeBinary(document), ranges};
  } finally {material.dispose(); geometry.dispose(); for (const part of parts) part.dispose();}
}
