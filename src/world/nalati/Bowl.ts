/**
 * Bowl — layout v2's new set pieces (docs/design/nalati/layout-v2.md, N9), all placed from `src/chunks/nalatiLayout.ts`:
 *
 *   buildWatchtower(ctx)   the ruined stone watchtower on its rock on the east rim (a generated GLB, glbPaint.ts)
 *   buildKokpar(ctx)       the kokpar field: a ring of marker posts round the trodden oval, the two goal mounds, the
 *                          spectators' horses at the rail, and six riders mid-game galloping laps round it (the generated
 *                          horse-and-rider model, one InstancedMesh moved every frame: a gallop bent into the mesh in the vertex shader, the body rising and rocking with it)
 *   buildFarHerds(ctx)     the herds in the hundreds on the Sky Grassland: ~260 horses in four herds (the far LOD —
 *                          ~800 tris, vertex-coloured coats tinted per horse — one draw per herd, frustum-culled), grazing
 *                          and drifting; the ones within ~45 m of the viewer are hidden (the AI herd with the stallion is
 *                          the near one); on the phone a herd more than ~165 m off is not drawn
 *   buildSnowLotus(ctx)    snow lotus in the rocks of the snow ring, clustered at SNOW_LOTUS (one instanced draw)
 *   buildGlacier(ctx)      the glacier snout's ice cliff and portal (the tongue's ice is the terrain's, terrainSurface.ts)
 *
 * Each returns a PoiPiece; the animated ones carry `update(dt, viewer)`, which NalatiPOIs calls every frame.
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3, blob, poiMaterial } from './paint';
import { painterlyMaterial, painterlyUniforms } from '../painterly';
import type { Sky } from '../Sky';
import { PC } from './props';
import { ModelSink, loadNalatiModel, instanceModel, MODEL_SIZE, MODEL_TRIS, FAR_TRIS, placementMatrix, type ModelPlacement } from './glbPaint';
import { WATCHTOWER, KOKPAR, HORSE_PLAINS, SNOW_LOTUS, KURGANS, SUMMER_YURTS, SNOW_LINE, GLACIER } from '../../chunks/nalatiLayout';
import { inPoiClearing } from './clearings';
import { Rng } from '../../core/rng';
import { TIER } from '../../core/tier';
import type { Collider } from '../../player/Player';
import type { PoiCtx, PoiPiece } from './types';

const PHONE = TIER === 'phone';

// ── the watchtower ──────────────────────────────────────────────────────────────────────────────────────────────────

export function buildWatchtower(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const group = new THREE.Group();
  group.name = 'nalati-watchtower';
  const colliders: Collider[] = [];
  const { x, z } = WATCHTOWER;
  // stand it on the lowest ground under its footprint so no corner floats; the rubble skirt runs into the rock
  let y = ground(x, z);
  for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; y = Math.min(y, ground(x + Math.cos(t) * 3.2, z + Math.sin(t) * 3.2)); }
  const rot = Math.PI / 2; // the doorway (the model's +Z) faces west (+x), into the bowl
  const sink = new ModelSink();
  sink.add('watchtower', { x, y: y - 0.4, z, rot });
  // the tower's shell: the four walls as colliders (the ruin is open at the top; you can stand in the doorway)
  const [w, h, d] = MODEL_SIZE.watchtower;
  colliders.push({ x, z, hw: w * 0.36, hd: d * 0.36, rot: -rot, yBottom: y - 2, yTop: y + h * 0.85 });
  // a few fallen blocks down the slope below it
  const kit = new PaintKit(0x70e7);
  const rng = kit.rng;
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(5, 12), bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, s = rng.range(0.35, 0.8);
    kit.add(blob(s, rng, 1, 0.7, 0.25), new THREE.Color('#948b7c'), { matrix: M(bx, ground(bx, bz) - s * 0.2, bz, rng.range(0, 6)), top: { color: new THREE.Color('#b3a35a'), threshold: 0.6, amount: 0.4 }, brush: 0.12 });
  }
  const mesh = kit.mesh(sky, { ground });
  group.add(mesh);
  void sink.flush(group, sky, { watchtower: { rim: 0.3, bands: 0.8 } });
  return { name: 'watchtower', object: group, colliders, platforms: [], tris: sink.tris() + mesh.geometry.getAttribute('position').count / 3 };
}

// ── the riders' gallop ──

/** strides per second × 2π, and the phase offset between riders (GALLOP_GLSL reads the same from gl_InstanceID) */
const GALLOP_HZ = 2.2 * Math.PI * 2, GALLOP_SPREAD = 1.7;
/**
 * The generated horse-and-rider is one rigid mesh; this bends it into a gallop in the vertex shader (the model faces +z,
 * feet at y 0, 2.5 m tall): the legs below the belly swing fore / aft from the hip, fore and hind pairs half a stride
 * apart and the left leading, each hoof lifting on its swing; the head and neck pump with the stride; the rider sits
 * into it and leans forward. The body's own rise / rock / lean is the instance matrix (buildKokpar's update).
 */
const GALLOP_GLSL = /* glsl */`
#ifdef USE_INSTANCING
{
  float gPh = uPTime * ${GALLOP_HZ.toFixed(4)} + float( gl_InstanceID ) * ${GALLOP_SPREAD.toFixed(2)};
  float legK = 1.0 - smoothstep( 0.35, 0.9, position.y );
  float lp = gPh + step( 0.0, position.z ) * 3.1416 + sign( position.x ) * 0.45;
  float fromHip = max( 0.0, 0.95 - position.y );
  transformed.z += sin( lp ) * 0.5 * legK * fromHip;
  transformed.y += max( 0.0, cos( lp ) ) * 0.22 * legK * fromHip;
  float neck = smoothstep( 0.8, 1.35, position.z ) * smoothstep( 0.9, 1.3, position.y );
  transformed.y += sin( gPh * 2.0 + 0.8 ) * 0.06 * neck;
  float rid = smoothstep( 1.5, 1.8, position.y );
  transformed.z += ( 0.08 + sin( gPh * 2.0 - 0.6 ) * 0.05 ) * rid * ( position.y - 1.5 );
  transformed.y -= ( 0.5 + 0.5 * sin( gPh * 2.0 + 0.9 ) ) * 0.05 * rid;
}
#endif
`;

/** a painterly material for the riders with the gallop bent in (one extra program, for the six riders) */
function gallopMaterial(sky: Sky, like: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
  const mat = painterlyMaterial(sky, { map: like.map, rim: 0.8, bands: 0.85 });
  const base = mat.onBeforeCompile.bind(mat), key = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${GALLOP_GLSL}`);
  };
  mat.customProgramCacheKey = () => `${key()}|gallop`;
  return mat;
}

// ── the kokpar field ─────────────────────────────────────────────────────────────────────────────────────────────────

/** a point on the field's oval at angle t, scaled by k (1 = its edge), and the tangent heading there */
function onOval(t: number, k: number): { x: number; z: number; yaw: number } {
  const c = Math.cos(KOKPAR.rot), s = Math.sin(KOKPAR.rot);
  const lx = Math.cos(t) * KOKPAR.rx * k, lz = Math.sin(t) * KOKPAR.rz * k;
  const tx = -Math.sin(t) * KOKPAR.rx, tz = Math.cos(t) * KOKPAR.rz;         // d/dt (local)
  const x = KOKPAR.x + lx * c + lz * s, z = KOKPAR.z - lx * s + lz * c;
  const dx = tx * c + tz * s, dz = -tx * s + tz * c;
  return { x, z, yaw: Math.atan2(dx, dz) };
}

export function buildKokpar(ctx: PoiCtx): PoiPiece {
  const { sky, ground, flutter } = ctx;
  const kit = new PaintKit(0x60ba);
  const rng = kit.rng;
  const colliders: Collider[] = [];
  const group = new THREE.Group();
  group.name = 'nalati-kokpar';
  // marker posts round the oval, a pennant on every fourth
  const n = 34;
  for (let i = 0; i < n; i++) {
    const p = onOval((i / n) * Math.PI * 2, 1.08), gy = ground(p.x, p.z);
    kit.add(pole(v3(p.x, gy - 0.3, p.z), v3(p.x, gy + 1.25, p.z), 0.06, 0.05, 6), PC.woodGrey, { foot: 0.7 });
    if (i % 4 === 0) flutter.flag(v3(p.x, gy + 1.2, p.z), 0.25, 0.55, i % 8 === 0 ? '#c9361f' : '#2f5fae', { taper: 1, droop: 0.2 });
  }
  // the two goals (the tai-kazan: a raised ring of turf with a stone rim) at the oval's ends
  for (const t of [0, Math.PI]) {
    const p = onOval(t, 0.82), gy = ground(p.x, p.z);
    kit.add(new THREE.CylinderGeometry(2.2, 2.6, 0.9, 18, 1), new THREE.Color('#6f5a3a'), { matrix: M(p.x, gy + 0.2, p.z), brush: 0.1 });
    kit.add(new THREE.TorusGeometry(2.25, 0.28, 6, 18).rotateX(Math.PI / 2), PC.stone, { matrix: M(p.x, gy + 0.68, p.z), brush: 0.1 });
    colliders.push({ x: p.x, z: p.z, hw: 2.4, hd: 2.4, rot: 0, yBottom: gy - 1, yTop: gy + 0.75 });
  }
  const mesh = kit.mesh(sky, { ground });
  group.add(mesh);
  // the spectators' saddled horses standing round the rail (static), a little way out
  const sink = new ModelSink();
  for (let i = 0; i < 6; i++) {
    const p = onOval(1.2 + i * 0.55 + rng.range(-0.1, 0.1), 1.2 + rng.range(0, 0.1));
    sink.add('horse-saddled', { x: p.x, y: ground(p.x, p.z) - 0.03, z: p.z, rot: p.yaw + Math.PI / 2 + rng.range(-0.3, 0.3) });
  }
  void sink.flush(group, sky, { 'horse-saddled': { rim: 0.8, bands: 0.85 } });

  // the riders: six laps round the oval at different radii and speeds, bunched as in a game (the goat carried by one)
  const riders = Array.from({ length: 6 }, (_, i) => ({ t: (i < 4 ? 0.35 * i : 3 + i * 0.5), k: 0.45 + (i % 3) * 0.14, w: 0.28 + (i % 2) * 0.03 + i * 0.006, bob: rng.range(0, 6) }));
  let inst: THREE.InstancedMesh | null = null;
  const mat = new THREE.Matrix4(), place: ModelPlacement = { x: 0, y: 0, z: 0 };
  loadNalatiModel(sky, 'kokpar-rider', { rim: 0.8, bands: 0.85 }, PHONE ? 'far' : 'near').then((m) => {
    inst = new THREE.InstancedMesh(m.geometry, gallopMaterial(sky, m.material), riders.length);
    inst.castShadow = !PHONE; inst.receiveShadow = true;
    inst.name = 'nalati-kokpar-riders';
    inst.frustumCulled = true;
    inst.boundingSphere = new THREE.Sphere(new THREE.Vector3(KOKPAR.x, ground(KOKPAR.x, KOKPAR.z) + 1.5, KOKPAR.z), Math.max(KOKPAR.rx, KOKPAR.rz) + 5);
    group.add(inst);
    return m;
  }).catch((e: unknown) => { console.warn('[nalati] kokpar riders failed', e); });
  let clock = 0;
  const update = (dt: number): void => {
    clock += dt;
    const m = inst;
    if (!m) return;
    for (let i = 0; i < riders.length; i++) {
      const r = riders[i];
      if (!r) continue;
      r.t += r.w * dt;
      const p = onOval(r.t, r.k), gy = ground(p.x, p.z);
      // the body rides the same stride as the legs (GALLOP_GLSL's phase): it rises off the hind push, rocks nose-down
      // over the lead fore, and leans into the turn
      const ph = painterlyUniforms.uPTime.value * GALLOP_HZ + i * GALLOP_SPREAD;
      place.x = p.x; place.z = p.z; place.y = gy + (0.5 + 0.5 * Math.sin(ph * 2 - 0.4)) * 0.16 - 0.06;
      place.rot = p.yaw + Math.sin(ph) * 0.025; place.roll = -0.14 + Math.sin(ph) * 0.03; place.pitch = Math.sin(ph + 1.1) * 0.07;
      m.setMatrixAt(i, placementMatrix(place, mat));
    }
    m.instanceMatrix.needsUpdate = true;
  };
  const riderTris = riders.length * (PHONE ? FAR_TRIS['kokpar-rider'] : MODEL_TRIS['kokpar-rider']);
  return { name: 'kokpar', object: group, colliders, platforms: [], tris: mesh.geometry.getAttribute('position').count / 3 + sink.tris() + riderTris, update };
}

// ── the herds in the hundreds ────────────────────────────────────────────────────────────────────────────────────────

/** the herds' grazing grounds on the bowl floor (the AI herd with the stallion is on HORSE_PLAINS too) */
const HERDS: { x: number; z: number; r: number; n: number }[] = [
  { x: HORSE_PLAINS.x + 8, z: HORSE_PLAINS.z - 6, r: 42, n: PHONE ? 50 : 80 },
  { x: -16, z: 62, r: 30, n: PHONE ? 34 : 56 },
  { x: 130, z: 6, r: 30, n: PHONE ? 34 : 56 },
  { x: -150, z: 24, r: 26, n: PHONE ? 30 : 48 },
];
/** coats as a tint over the dun far LOD: bay, chestnut, dun, grey, black, a light dun */
const COATS: [number, number, number][] = [[0.78, 0.55, 0.42], [1.0, 0.62, 0.42], [1, 1, 1], [1.25, 1.22, 1.18], [0.32, 0.3, 0.3], [1.15, 1.08, 0.95]];

export function buildFarHerds(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const group = new THREE.Group();
  group.name = 'nalati-far-herds';
  const rng = new Rng(0x4e4d);
  const blocked = (x: number, z: number): boolean =>
    inPoiClearing(x, z, 4) || KURGANS.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 3) || Math.hypot(x - SUMMER_YURTS.x, z - SUMMER_YURTS.z) < 20;
  interface Horse { x: number; z: number; yaw: number; s: number; speed: number; turn: number; c: number }
  interface Herd { x: number; z: number; r: number; horses: Horse[]; mesh: THREE.InstancedMesh | null }
  const herds: Herd[] = HERDS.map((h) => ({ x: h.x, z: h.z, r: h.r, horses: [], mesh: null }));
  let total = 0;
  for (const [hi, h] of HERDS.entries()) {
    const herd = herds[hi];
    if (!herd) continue;
    const heading = rng.range(0, Math.PI * 2);
    for (let i = 0, tries = 0; i < h.n && tries < h.n * 20; tries++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * h.r;
      const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
      if (blocked(x, z) || herd.horses.some((q) => Math.hypot(q.x - x, q.z - z) < 2.2)) continue;
      const foal = rng.next() < 0.12;
      herd.horses.push({ x, z, yaw: heading + rng.range(-1.2, 1.2), s: foal ? rng.range(0.58, 0.66) : rng.range(0.95, 1.06), speed: rng.range(0.05, 0.25), turn: rng.range(-0.15, 0.15), c: rng.int(0, COATS.length - 1) });
      i++;
    }
    total += herd.horses.length;
  }
  /** hidden within HIDE of the viewer (the AI herd is the near one); on the phone a whole herd goes past FAR */
  const HIDE = 45, FAR = PHONE ? 165 : Infinity;
  const mat = new THREE.Matrix4(), place: ModelPlacement = { x: 0, y: 0, z: 0 }, col = new THREE.Color();
  loadNalatiModel(sky, 'horse-wild', { rim: 0.8, bands: 0.85 }, 'far').then((m) => {
    for (const herd of herds) {
      // one InstancedMesh per herd, bounded by the herd's ground: a herd behind the camera costs nothing
      const im = new THREE.InstancedMesh(m.geometry, m.material, Math.max(1, herd.horses.length));
      im.castShadow = false; im.receiveShadow = true;
      im.name = 'nalati-far-herd';
      im.count = 0;
      im.boundingSphere = new THREE.Sphere(new THREE.Vector3(herd.x, ground(herd.x, herd.z) + 1, herd.z), herd.r * 1.6 + 6);
      herd.mesh = im;
      group.add(im);
    }
    return m;
  }).catch((e: unknown) => { console.warn('[nalati] far herds failed', e); });

  let acc = 1;
  const update = (dt: number, viewer: THREE.Vector3 | null): void => {
    acc += dt;
    if (acc < 0.25) return; // a quarter-second step: grazing is slow
    const step = acc; acc = 0;
    for (const herd of herds) {
      const m = herd.mesh;
      if (!m) continue;
      if (viewer && Math.hypot(herd.x - viewer.x, herd.z - viewer.z) > FAR + herd.r) { m.visible = false; continue; }
      m.visible = true;
      let n = 0;
      for (const h of herd.horses) {
        // drift: amble along the heading, turn a little, turn back toward the herd's centre when straying
        h.turn += (rng.next() - 0.5) * 0.08 * step;
        h.turn = Math.max(-0.2, Math.min(0.2, h.turn));
        const toC = Math.atan2(herd.x - h.x, herd.z - h.z), off = Math.hypot(h.x - herd.x, h.z - herd.z);
        const dy = off > herd.r * 0.9 ? Math.atan2(Math.sin(toC - h.yaw), Math.cos(toC - h.yaw)) * 0.3 : 0;
        h.yaw += (h.turn + dy) * step;
        const nx = h.x + Math.sin(h.yaw) * h.speed * step, nz = h.z + Math.cos(h.yaw) * h.speed * step;
        if (!blocked(nx, nz)) { h.x = nx; h.z = nz; } else h.yaw += 1.5;
        if (viewer && Math.hypot(h.x - viewer.x, h.z - viewer.z) < HIDE) continue;
        place.x = h.x; place.z = h.z; place.y = ground(h.x, h.z) - 0.04; place.rot = h.yaw; place.scale = h.s;
        m.setMatrixAt(n, placementMatrix(place, mat));
        const c = COATS[h.c] ?? [1, 1, 1];
        m.setColorAt(n, col.setRGB(c[0], c[1], c[2]));
        n++;
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };
  return { name: 'farHerds', object: group, colliders: [], platforms: [], tris: total * FAR_TRIS['horse-wild'], update };
}

// ── snow lotus ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function buildSnowLotus(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const group = new THREE.Group();
  group.name = 'nalati-snow-lotus';
  const rng = new Rng(0x5107);
  const places: ModelPlacement[] = [];
  const slope = (x: number, z: number): number => { const e = 1; return Math.hypot(ground(x + e, z) - ground(x - e, z), ground(x, z + e) - ground(x, z - e)) / (2 * e); };
  for (const c of SNOW_LOTUS) {
    const want = Math.round(c.n * (PHONE ? 0.6 : 1));
    for (let i = 0, tries = 0; i < want && tries < want * 25; tries++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * c.r;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, y = ground(x, z);
      if (slope(x, z) > 0.9 || y > SNOW_LINE + 45 || places.some((p) => Math.hypot(p.x - x, p.z - z) < 0.9)) continue;
      places.push({ x, y: y - 0.06, z, rot: rng.range(0, Math.PI * 2), scale: rng.range(0.75, 1.25) });
      i++;
    }
  }
  void loadNalatiModel(sky, 'snow-lotus', { rim: 0.6, bands: 0.7 }).then((m) => { group.add(instanceModel(m, places, { castShadow: !PHONE })); return m; })
    .catch((e: unknown) => { console.warn('[nalati] snow lotus failed', e); });
  return { name: 'snowLotus', object: group, colliders: [], platforms: [], tris: places.length * MODEL_TRIS['snow-lotus'] };
}

// ── the glacier ──────────────────────────────────────────────────────────────────────────────────────────────────────

const ICE = { mid: new THREE.Color('#bcd6e8'), deep: new THREE.Color('#6f9fc4'), dark: new THREE.Color('#10202c') };

/**
 * The glacier's snout: a blue ice cliff at the tongue's foot with the dark portal the meltwater stream runs out of. One
 * mesh on the POI material. The tongue itself is the terrain (its convex ramp, `GLACIER`), painted as ice per pixel by
 * terrainSurface.ts (crevasse bands across the flow, moraine along the edges).
 */
export function buildGlacier(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const ax = GLACIER.x1 - GLACIER.x0, az = GLACIER.z1 - GLACIER.z0, len = Math.hypot(ax, az);
  const ux = ax / len, uz = az / len, px = -uz, pz = ux;                        // along the flow, and across it
  const at = (t: number, v: number): { x: number; z: number } => ({ x: GLACIER.x0 + ax * t + px * v * GLACIER.half, z: GLACIER.z0 + az * t + pz * v * GLACIER.half });
  // the tongue's surface is the terrain's own (terrainSurface.ts paints the ice, crevasses and moraine per pixel — a
  // vertex-coloured skin over it read quilted); this mesh is only the snout
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const NV = 18, T1 = 0.985;
  const c = new THREE.Color();
  // the snout: an ice cliff from the tongue's last row down to the valley floor, the portal dark in its middle
  const tEnd = T1, drop = 2.5;
  for (let j = 0; j <= NV; j++) {
    const v = ((j / NV) * 2 - 1) * 0.93;
    const top = at(tEnd, v), foot = at(tEnd + 0.03, v * 1.04);
    const yTop = ground(top.x, top.z) + 0.14, yFoot = ground(foot.x, foot.z) - drop;
    for (let k = 0; k <= 4; k++) {
      const f = k / 4;
      pos.push(top.x + (foot.x - top.x) * f, yTop + (yFoot - yTop) * f, top.z + (foot.z - top.z) * f);
      const portal = Math.max(0, 1 - Math.abs(v - 0.1) / 0.16) * (f > 0.45 ? 1 : 0);
      c.copy(ICE.mid).lerp(ICE.deep, 0.35 + f * 0.5).lerp(ICE.dark, portal * 0.9);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < NV; j++) for (let k = 0; k < 4; k++) {
    const a = j * 5 + k, b = a + 5;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, poiMaterial(sky));
  mesh.name = 'nalati-glacier';
  mesh.receiveShadow = true; mesh.castShadow = false;
  return { name: 'glacier', object: mesh, colliders: [], platforms: [], tris: idx.length / 3 };
}
