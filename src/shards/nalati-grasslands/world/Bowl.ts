/**
 * Bowl — layout v2's new set pieces (docs/design/nalati/layout-v2.md, N9), all placed from `src/shards/nalati-grasslands/layout.ts`:
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
 * Each returns a PoiPiece; the animated ones carry `update(dt, viewer)`, which NalatiPOIs calls every frame. Each places
 * models (E306 / E315 M3, src/shards/nalati-grasslands/models/) through a NalatiSet (./painted.ts) and registers itself:
 * the watchtower (+ its stone steps and fallen blocks), the kokpar field (posts, goals, the spectators' saddled horses,
 * the riders), the herd horses, the snow lotus, the glacier's snout (the tongue under it is the terrain's: world).
 */
import * as THREE from 'three';
import { PaintKit, poiMaterial, v3 } from './paint';
import { loadNalatiModel, MODEL_TRIS, FAR_TRIS, placementMatrix, type ModelPlacement } from './glbPaint';
import { WATCHTOWER, KOKPAR, HORSE_PLAINS, SNOW_LOTUS, KURGANS, SUMMER_YURTS, SNOW_LINE } from '../layout';
import { inPoiClearing } from './clearings';
import { NalatiSet } from './painted';
import { addStoneStair } from './Stair';
import type { PoiCtx, PoiPiece } from './types';
import { watchtower } from '../models/watchtower';
import { fieldstone } from '../models/fieldstone';
import { kokparPost } from '../models/kokparPost';
import { kokparGoal } from '../models/kokparGoal';
import { saddledHorse } from '../models/saddledHorse';
import { kokparRider } from '../models/kokparRider';
import { herdHorse } from '../models/herdHorse';
import { snowLotus } from '../models/snowLotus';
import { glacierSnout, snoutGeometry, snoutAt } from '../models/glacierSnout';
import { Rng } from '@wildshard/engine/core/rng';
import { TIER } from '@wildshard/engine/core/tier';
import { place as placeModel } from '@wildshard/engine/models/place';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { painterlyMaterial, painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

const PHONE = TIER === 'phone';

// ── the watchtower ──────────────────────────────────────────────────────────────────────────────────────────────────

export function buildWatchtower(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const group = new THREE.Group();
  group.name = 'nalati-watchtower';
  const { x, z } = WATCHTOWER;
  // stand it on the lowest ground under its footprint so no corner floats; the rubble skirt runs into the rock
  let y = ground(x, z);
  for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; y = Math.min(y, ground(x + Math.cos(t) * 3.2, z + Math.sin(t) * 3.2)); }
  const rot = Math.PI / 2; // the doorway (the model's +Z) faces west (+x), into the bowl
  const kit = new PaintKit(0x70e7);
  const rng = kit.rng;
  const set = new NalatiSet(kit, ctx);
  set.instance(watchtower, { x, y, z, rot }, {});
  // a few fallen blocks down the slope below it
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(5, 12), bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, s = rng.range(0.35, 0.8);
    set.paint(fieldstone, { x: bx, y: ground(bx, bz), z: bz, yaw: 0 }, { s, squash: 0.7, rough: 0.25, lift: -0.2, look: 'rubble' });
  }
  // NALATI-MERGE P1: the tower's rock stands past the motor's 40° on every side — a stone stair climbs its west shoulder
  // from the bowl (the walkable way up, found over the physics heightfield) to the doorway's terrace
  addStoneStair(set, ground, [[x + 31.5, z + 4.7], [x + 23.7, z + 2.7], [x + 10, z + 0.7], [x + 7.5, z + 0.5]], { depth: 0.4, maxRise: 0.33 });
  const mesh = kit.mesh(sky, { ground });
  group.add(mesh);
  set.flush(group, sky);
  return { name: 'watchtower', object: group, colliders: set.boxes, surface: 'stone', tris: set.tris() + mesh.geometry.getAttribute('position').count / 3, register: (o) => set.register({ ...o, object: mesh, group }) };
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
  patchShader(mat, 'nalati.gallop', PATCH_ORDER.decorate, (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${GALLOP_GLSL}`);
  }, { key: (k) => `${k}|gallop` });
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
  const set = new NalatiSet(kit, ctx);
  const group = new THREE.Group();
  group.name = 'nalati-kokpar';
  // marker posts round the oval, a pennant on every fourth
  const n = 34;
  for (let i = 0; i < n; i++) {
    const p = onOval((i / n) * Math.PI * 2, 1.08), gy = ground(p.x, p.z);
    set.paint(kokparPost, { x: p.x, y: gy, z: p.z, yaw: 0 }, {});
    if (i % 4 === 0) flutter.flag(v3(p.x, gy + 1.2, p.z), 0.25, 0.55, i % 8 === 0 ? '#c9361f' : '#2f5fae', { taper: 1, droop: 0.2 });
  }
  // the two goals (the tai-kazan: a raised ring of turf with a stone rim) at the oval's ends
  for (const t of [0, Math.PI]) {
    const p = onOval(t, 0.82);
    set.paint(kokparGoal, { x: p.x, y: ground(p.x, p.z), z: p.z, yaw: 0 }, {});
  }
  const mesh = kit.mesh(sky, { ground });
  group.add(mesh);
  // the spectators' saddled horses standing round the rail (static), a little way out
  for (let i = 0; i < 6; i++) {
    const p = onOval(1.2 + i * 0.55 + rng.range(-0.1, 0.1), 1.2 + rng.range(0, 0.1));
    set.instance(saddledHorse, { x: p.x, y: ground(p.x, p.z) - 0.03, z: p.z, rot: p.yaw + Math.PI / 2 + rng.range(-0.3, 0.3) }, {});
  }
  set.flush(group, sky);

  // the riders: six laps round the oval at different radii and speeds, bunched as in a game (the goat carried by one)
  const riders = Array.from({ length: 6 }, (_, i) => ({ t: (i < 4 ? 0.35 * i : 3 + i * 0.5), k: 0.45 + (i % 3) * 0.14, w: 0.28 + (i % 2) * 0.03 + i * 0.006, bob: rng.range(0, 6) }));
  set.moving(kokparRider, riders.map((r) => { const p = onOval(r.t, r.k); return { x: p.x, y: ground(p.x, p.z), z: p.z, rot: p.yaw }; }));
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
  return { name: 'kokpar', object: group, colliders: set.boxes, surface: 'wood', tris: mesh.geometry.getAttribute('position').count / 3 + set.tris() + riderTris, update, register: (o) => set.register({ ...o, object: mesh, group }) };
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
  // the herd horses where they start (they drift): counted on the model's card, nothing collides
  const set = new NalatiSet(null, ctx);
  set.moving(herdHorse, herds.flatMap((h) => h.horses.map((q) => ({ x: q.x, y: ground(q.x, q.z) - 0.04, z: q.z, rot: q.yaw, scale: q.s }))));
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
  return { name: 'farHerds', object: group, colliders: [], surface: 'ground', tris: total * FAR_TRIS['horse-wild'], update, register: (o) => set.register({ ...o, object: group }) };
}

// ── snow lotus ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function buildSnowLotus(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const group = new THREE.Group();
  group.name = 'nalati-snow-lotus';
  const rng = new Rng(0x5107);
  const set = new NalatiSet(null, ctx);
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
  for (const p of places) set.instance(snowLotus, p, {});
  set.flush(group, sky);
  return { name: 'snowLotus', object: group, colliders: [], surface: 'ground', tris: set.tris(), register: (o) => set.register({ ...o, object: group }) };
}

// ── the glacier ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The glacier's snout: a blue ice cliff at the tongue's foot with the dark portal the meltwater stream runs out of — the
 * glacier snout model (src/shards/nalati-grasslands/models/glacierSnout.ts, E323: its card came back), fitted to the
 * ground, placed once drawnInto its one mesh on the POI material. The tongue itself is the terrain (its convex ramp,
 * `GLACIER`), painted as ice per pixel by terrainSurface.ts (crevasse bands across the flow, moraine along the edges).
 */
export function buildGlacier(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const geo = snoutGeometry(ground);
  const mesh = new THREE.Mesh(geo, poiMaterial(sky));
  mesh.name = 'nalati-glacier';
  mesh.receiveShadow = true; mesh.castShadow = false;
  const at = snoutAt(ground);
  const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position') as THREE.BufferAttribute);
  return {
    name: 'glacier', object: mesh, colliders: [], surface: 'ground', tris: (geo.index?.count ?? 0) / 3,
    register: (o) => [placeModel(glacierSnout, [at], { ctx: o.ctx, draw: 'single', registry: o.registry, drawnInto: { object: mesh, boxes: Float32Array.of(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z) }, piece: { solidFloor: true } })],
  };
}
