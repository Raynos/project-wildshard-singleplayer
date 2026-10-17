/**
 * Pine Hollow's trophy-wall mounts, baked offline (SHARD-PLATFORM W2, C1). Each mount slot of the ranger's wall
 * (`PINE_HOLLOW_TROPHIES` laid out by `RANGER_WALL`, ../data/trophyWall.ts) becomes one geometry, already posed in the wall's
 * anchor frame: a bevelled wooden shield plaque (arched top, pointed bottom, grain in its vertex colours) and the
 * species' head and shoulders cut from its phone rigged hull at the neck (the phone's vertex count on every tier), its coat atlas (the variant's authored repaint,
 * box-filtered to at most 512² as the page once read it) sampled into the vertex colours. The page
 * (runtime/compendium/trophyWall.ts) merges the taken slots' geometries into its one mounts mesh.
 * Reads only data rows and committed rig bytes; no renderer, page or game service.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeometryPackWriter, type PackedGeometryRows } from '@wildshard/sdk/kit/geometryPack';
import { PINE_HOLLOW_TROPHIES, RANGER_WALL } from './trophyWall';
import { PINE_HULLS } from './creatureHulls';
import { producePineCoats, readCoatRig } from './coatProducer';

const WOOD = new THREE.Color(0x6e4a2c), WOOD_DARK = new THREE.Color(0x3a2616);

/** a shield plaque: arched top, straight sides, pointed bottom, extruded, bevelled (y up, facing +z, centred) */
function shieldGeometry(w: number, h: number): THREE.BufferGeometry {
  const s = new THREE.Shape(), hw = w / 2, hh = h / 2;
  s.moveTo(0, -hh);
  s.quadraticCurveTo(hw * 0.95, -hh * 0.62, hw, -hh * 0.05);
  s.lineTo(hw, hh * 0.72);
  s.quadraticCurveTo(hw * 0.5, hh * 0.78, 0, hh);
  s.quadraticCurveTo(-hw * 0.5, hh * 0.78, -hw, hh * 0.72);
  s.lineTo(-hw, -hh * 0.05);
  s.quadraticCurveTo(-hw * 0.95, -hh * 0.62, 0, -hh);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 2, curveSegments: 10 });
  g.deleteAttribute('uv');
  const pos = g.getAttribute('position'), col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // darker on the bevel and the back, a faint grain across the face
    const face = pos.getZ(i) > 0.04 ? 1 : 0.6;
    c.copy(WOOD_DARK).lerp(WOOD, face * (0.8 + 0.2 * Math.sin(pos.getY(i) * 60 + pos.getX(i) * 7)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** an RGBA raster box-filtered down to at most 512² (as the page's canvas once drew it) */
function downscale(pixels: Uint8ClampedArray, width: number, height: number): { data: Uint8ClampedArray; w: number; h: number } {
  const k = Math.min(1, 512 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * k)), h = Math.max(1, Math.round(height * k)), data = new Uint8ClampedArray(w * h * 4);
  const fx = width / w, fy = height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx)), y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    const sum = [0, 0, 0, 0];
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) for (let c = 0; c < 4; c++) sum[c] = (sum[c] ?? 0) + (pixels[(sy * width + sx) * 4 + c] ?? 0);
    const n = (x1 - x0) * (y1 - y0);
    for (let c = 0; c < 4; c++) data[(y * w + x) * 4 + c] = Math.round((sum[c] ?? 0) / n);
  }
  return { data, w, h };
}

/** the head and shoulders of a rig: its rest triangles in front of the neck's base, above the chest, painted from `atlas` */
function mountGeometry(geometry: THREE.BufferGeometry, bones: readonly { name: string; pos: readonly [number, number, number] }[], atlas: { data: Uint8ClampedArray; w: number; h: number }): THREE.BufferGeometry {
  const neck = bones.find((b) => b.name === 'neck1')?.pos, body = bones.find((b) => b.name === 'body')?.pos;
  if (neck === undefined || body === undefined) throw new Error('trophy mount: rig lacks neck1 / body');
  const pos = geometry.getAttribute('position'), nrm = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv'), idx = geometry.getIndex();
  if (idx === null) throw new Error('trophy mount: rig is not indexed');
  const sc = new THREE.Color(), cutZ = neck[2] - 0.06, cutY = body[1] - 0.04;
  const P: number[] = [], N: number[] = [], C: number[] = [];
  for (let i = 0; i + 2 < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
    const zc = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3, yc = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    if (zc < cutZ || yc < cutY) continue;
    for (const v of [a, b, c]) {
      P.push(pos.getX(v) - neck[0], pos.getY(v) - neck[1], pos.getZ(v) - cutZ);
      N.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
      // glTF uv: v = 0 is the image's top row (flipY false)
      const u = uv.getX(v) - Math.floor(uv.getX(v)), t = uv.getY(v) - Math.floor(uv.getY(v));
      const x = Math.min(atlas.w - 1, Math.floor(u * atlas.w)), y = Math.min(atlas.h - 1, Math.floor(t * atlas.h)), o = (y * atlas.w + x) * 4;
      sc.setRGB((atlas.data[o] ?? 0) / 255, (atlas.data[o + 1] ?? 0) / 255, (atlas.data[o + 2] ?? 0) / 255, THREE.SRGBColorSpace);
      C.push(sc.r, sc.g, sc.b);
    }
  }
  if (P.length === 0) throw new Error('trophy mount: nothing in front of the neck');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
}

/** The trophy pack: its uncompressed bytes, its rows and each mount slot's geometry (by entry id). */
export interface TrophyBake { readonly bin: Uint8Array; readonly rows: PackedGeometryRows; readonly slots: Readonly<Record<string, number>> }

/** Bake every mount slot of the wall; `readAsset` reads a committed creature rig by its file name (the last path part). */
export async function bakePineTrophies(readAsset: (url: string) => Promise<Uint8Array>): Promise<TrophyBake> {
  const wall = RANGER_WALL, slots: readonly { readonly entry: string; readonly mount?: { readonly kind: string; readonly variant: string } }[] = PINE_HOLLOW_TROPHIES;
  const coats = new Map((await producePineCoats(readAsset, 'phone')).map((p) => [p.key, p]));
  const writer = new GeometryPackWriter('pine trophies'), out: Record<string, number> = {};
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
  let k = 0;
  for (const [r, count] of wall.rows.entries()) {
    const w = wall.width / count, y = wall.rowY[r] ?? 1.5, h = r === 0 ? 0.95 : 0.8;
    for (let i = 0; i < count; i++) {
      const slot = slots[k++];
      if (slot?.mount === undefined) continue;
      const x = -wall.width / 2 + w * (i + 0.5);
      const shield = shieldGeometry(Math.min(0.62, w * 0.78), Math.min(0.7, h * 0.8));
      shield.translate(x, y - 0.06, 0.005);
      const { kind, variant } = slot.mount, name = PINE_HULLS.hulls[`${kind}:${variant}`];
      if (name === undefined) throw new Error(`trophy bake: no hull for ${kind}:${variant}`);
      const rig = await readCoatRig(await readAsset(`${name}.phone.rigged.glb`), name);
      const coat = coats.get(`procedural:/assets/pine-hollow/creatures/${name}.phone.${kind}.${variant}.coat.png`);
      const head = mountGeometry(rig.geometry, rig.bones, downscale(coat?.pixels ?? rig.pixels, coat?.width ?? rig.width, coat?.height ?? rig.height));
      head.computeBoundingBox();
      const bb = head.boundingBox ?? new THREE.Box3();
      const fit = Math.min((w * 0.72) / Math.max(0.01, bb.max.x - bb.min.x), (h * 0.9) / Math.max(0.01, bb.max.y - bb.min.y), 1.1);
      const yaw = (x < 0 ? 1 : -1) * 0.5; // turned toward the room's middle: a mount reads in three-quarter view
      head.applyMatrix4(m.compose(t.set(x, y - 0.05, 0.05), q.setFromEuler(new THREE.Euler(-0.08, yaw, 0)), s.setScalar(fit)));
      out[slot.entry] = writer.add(mergeGeometries([shield, head], false));
    }
  }
  return { bin: writer.bytes(), rows: writer.rows(), slots: out };
}
