import * as THREE from 'three';
import herdChannels from '../data/herdChannels.generated.json' with { type: 'json' };
import { instanceModel, poiMaterial, loadNalatiModel, placementMatrix } from './modelView';
import type { ModelPlacement } from './modelTypes';
import modelMetrics from '../boot/modelMetrics.generated.json' with { type: 'json' };
import layoutRows from '../boot/layout.generated.json' with { type: 'json' };
import { inPoiClearing } from './terrain';
import rows from '../boot/decorative.generated.json' with { type: 'json' };
import type { PoiCtx, PoiPiece } from './types';
import { kokparPost, kokparGoal, saddledHorse, kokparRider, herdHorse, snowLotus } from '../models/catalogue';
import { bakedMember, bakedActorGeometry, bakedPlaceSteps, bakedPlaceAnchors, placer, type Placer } from './places';
import { glacierSnout } from '../models/glacierSnout';
import fixed from '../boot/poiPaint.json' with { type: 'json' };
import { Rng } from '@wildshard/engine/core/rng';
import { TIER } from '@wildshard/engine/core/tier';
import { place as placeModel } from '@wildshard/engine/models/place';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { painterlyMaterial, painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { BOWL_GLSL } from '../runtime/looks/bowlGlsl';
import { createClientChannels } from '@wildshard/game/plugin/channels';

const { KOKPAR, KURGANS, SUMMER_YURTS } = layoutRows;


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

/** the GLSL below is trusted custom code (runtime/looks/bowlGlsl.ts); `@{name}` splices the fragments this module passes */
const BOWL_GLSL_FAMILY = new ShaderFamily(BOWL_GLSL, {});

const PHONE = TIER === 'phone';

// ── the riders' gallop ──

/** strides per second × 2π, and the phase offset between riders (GALLOP_GLSL reads the same from gl_InstanceID) */
const GALLOP_HZ = 2.2 * Math.PI * 2, GALLOP_SPREAD = 1.7;
/**
 * The generated horse-and-rider is one rigid mesh; this bends it into a gallop in the vertex shader (the model faces +z,
 * feet at y 0, 2.5 m tall): the legs below the belly swing fore / aft from the hip, fore and hind pairs half a stride
 * apart and the left leading, each hoof lifting on its swing; the head and neck pump with the stride; the rider sits
 * into it and leans forward. The body's own rise / rock / lean is the instance matrix (buildKokpar's update).
 */
const GALLOP_GLSL = BOWL_GLSL_FAMILY.glsl(BOWL_GLSL.GALLOP_GLSL, { GALLOP_HZ: GALLOP_HZ.toFixed(4), GALLOP_SPREAD: GALLOP_SPREAD.toFixed(2) });

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
  const { sky, ground } = ctx;
  const base = readPlace('kokpar', ctx, new Map([placer(kokparPost), placer(kokparGoal), placer(saddledHorse), placer(kokparRider)]));
  const group = base.object;
  const riders = (bakedPlaceAnchors('kokpar').riders ?? []).map(r => ({ t: r.t, k: r.k, w: r.w, bob: r.bob }));
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
  const riderTris = riders.length * (PHONE ? modelMetrics.farTriangles['kokpar-rider'] : modelMetrics.triangles['kokpar-rider']);
  return { ...base, tris: base.tris + riderTris, update };
}

// ── the herds in the hundreds ────────────────────────────────────────────────────────────────────────────────────────

/** the herds' grazing grounds on the bowl floor (the AI herd with the stallion is on HORSE_PLAINS too) */
/** coats as a tint over the dun far LOD: bay, chestnut, dun, grey, black, a light dun */
const COATS: [number, number, number][] = [[0.78, 0.55, 0.42], [1.0, 0.62, 0.42], [1, 1, 1], [1.25, 1.22, 1.18], [0.32, 0.3, 0.3], [1.15, 1.08, 0.95]];

export function buildFarHerds(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const group = new THREE.Group();
  group.name = 'nalati-far-herds';
  const rng = new Rng(0x4e4d);
  const drift = createClientChannels(herdChannels.clientChannels[0]), commit = createClientChannels(herdChannels.clientChannels[1]);
  const proposal = { time: 0, delta: 0, values: Array.from({ length: 9 }, () => 0) }, acceptance = { time: 0, delta: 0, values: Array.from({ length: 7 }, () => 0) };
  const missingPose = new Error('Missing declared decorative horse pose');
  const blocked = (x: number, z: number): boolean =>
    inPoiClearing(x, z, 4) || KURGANS.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 3) || Math.hypot(x - SUMMER_YURTS.x, z - SUMMER_YURTS.z) < 20;
  interface Horse { x: number; z: number; yaw: number; s: number; speed: number; turn: number; c: number }
  interface Herd { x: number; z: number; r: number; horses: Horse[]; mesh: THREE.InstancedMesh | null }
  const data = rows[TIER].horses;
  const herds: Herd[] = data.herds.map(herd => ({ ...herd, horses: herd.horses.map(horse => ({ ...horse })), mesh: null }));
  rng.restore(data.random);
  const copies = bakedMember(data.member), put = placer(herdHorse)[1];
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
        proposal.delta = step;
        proposal.values[0] = h.x; proposal.values[1] = h.z; proposal.values[2] = h.yaw; proposal.values[3] = h.turn; proposal.values[4] = h.speed;
        proposal.values[5] = herd.x; proposal.values[6] = herd.z; proposal.values[7] = herd.r; proposal.values[8] = rng.next();
        drift.evaluate(proposal);
        const proposed = drift.frame;
        if (proposed.x === undefined || proposed.z === undefined || proposed.yaw === undefined || proposed.turn === undefined) throw missingPose;
        acceptance.delta = step;
        acceptance.values[0] = h.x; acceptance.values[1] = h.z; acceptance.values[2] = proposed.yaw; acceptance.values[3] = proposed.x; acceptance.values[4] = proposed.z;
        acceptance.values[5] = proposed.turn; acceptance.values[6] = Number(blocked(proposed.x, proposed.z));
        commit.evaluate(acceptance);
        const frame = commit.frame;
        if (frame.x === undefined || frame.z === undefined || frame.yaw === undefined || frame.turn === undefined) throw missingPose;
        h.x = frame.x; h.z = frame.z; h.yaw = frame.yaw; h.turn = frame.turn;
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
  return { name: 'farHerds', object: group, colliders: [], surface: 'ground', tris: data.total * modelMetrics.farTriangles['horse-wild'], update, register: (o) => [put(copies, { ...o, object: group }, group)] };
}

// ── snow lotus ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function buildSnowLotus(ctx: PoiCtx): PoiPiece {
  const { sky } = ctx;
  const group = new THREE.Group();
  group.name = 'nalati-snow-lotus';
  const data = rows[TIER].lotus, copies = bakedMember(data.member), put = placer(snowLotus)[1];
  loadNalatiModel(sky, 'snow-lotus', data.look).then(model => { group.add(instanceModel(model, data.poses)); return model; })
    .catch((e: unknown) => { console.warn('[nalati] snow lotus failed', e); });
  return { name: 'snowLotus', object: group, colliders: [], surface: 'ground', tris: data.poses.length * modelMetrics.triangles['snow-lotus'], register: (o) => [put(copies, { ...o, object: group }, group)] };
}

// ── the glacier ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The glacier's snout: a blue ice cliff at the tongue's foot with the dark portal the meltwater stream runs out of — the
 * glacier snout model (src/shards/nalati-grasslands/models/glacierSnout.ts, E323: its card came back), fitted to the
 * ground, placed once drawnInto its one mesh on the POI material. The tongue itself is the terrain (its convex ramp,
 * `GLACIER`), painted as ice per pixel by terrainSurface.ts (crevasse bands across the flow, moraine along the edges).
 */
export function buildGlacier(ctx: PoiCtx): PoiPiece {
  const { sky } = ctx;
  const geo = bakedActorGeometry('glacier-snout:world');
  const mesh = new THREE.Mesh(geo, poiMaterial(sky));
  mesh.name = 'nalati-glacier';
  mesh.receiveShadow = true; mesh.castShadow = false;
  const at = fixed.glacierSnout;
  const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position') as THREE.BufferAttribute);
  return {
    name: 'glacier', object: mesh, colliders: [], surface: 'ground', tris: (geo.index?.count ?? 0) / 3,
    register: (o) => [placeModel(glacierSnout, [at], { ctx: o.ctx, draw: 'single', registry: o.registry, drawnInto: { object: mesh, boxes: Float32Array.of(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z) }, piece: { solidFloor: true } })],
  };
}

function readPlace(name: string, ctx: PoiCtx, placers: ReadonlyMap<string, Placer>): PoiPiece {
  const steps = bakedPlaceSteps(name, ctx, placers);
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}
