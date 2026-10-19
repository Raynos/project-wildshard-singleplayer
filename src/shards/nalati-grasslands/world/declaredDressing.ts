import { loadBoundSpecimen } from '@wildshard/game/models/specimenCatalogue';
import specimenData from '../boot/specimens.generated.json' with { type: 'json' };
import * as THREE from 'three';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { TIER } from '@wildshard/engine/core/tier';
import { FrameCamera } from '@wildshard/engine/world/frameCamera';
import { modelContext, type ModelDef } from '@wildshard/engine/models/model';
import { place, type PlaceOptions, type Placed } from '@wildshard/engine/models/place';
import type { Renderer } from '@wildshard/engine/render/renderer';
import * as v from 'valibot';
import { painterlyMaterial, painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { Flutter } from './Flutter';
import { scatterLayer, instanceBoxes, type ScatterPose as Inst, type ScatterLayer as DressLayer } from '@wildshard/engine/render/scatterInstances';
import type { PoiPiece } from './types';
import { AmbientWingField } from '@wildshard/game/ambient/wingField';
import coverRows from '../boot/cover.generated.json' with { type: 'json' };
import { Rng } from '@wildshard/engine/core/rng';
import { wind } from '@wildshard/engine/world/steppeWind';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { MOTES_GLSL } from '../runtime/looks/motesGlsl';
import { coverGeometry, preloadCover } from '../creatures/marmots';
import type { Box } from './solid';
import {
  boulder, slab, stone, juniper, wildRose, dwarfWillow, lupin, daisy, reeds,
  fallenLog, stump, ovoo, viewpointPole, skyGateway, fence, campClutter,
} from '../models/catalogue';
import { preloadNalatiPlaces, bakedActorGeometry, bakedDressingGeo, bakedDressingContacts, bakedPlaceSteps, placer } from './places';

const dressNumber = v.pipe(v.number(), v.finite());
const spot = v.object({ x: dressNumber, z: dressNumber, s: dressNumber });
const instance = v.object({ x: dressNumber, y: dressNumber, z: dressNumber, yaw: dressNumber, sx: dressNumber, sy: dressNumber, sz: dressNumber,
  tiltX: v.exactOptional(dressNumber), tiltZ: v.exactOptional(dressNumber), solid: v.exactOptional(v.literal(true)), far: dressNumber, r: dressNumber, g: dressNumber, b: dressNumber });
const box = v.object({ x: dressNumber, z: dressNumber, hw: dressNumber, hd: dressNumber, rot: dressNumber, yBottom: dressNumber, yTop: dressNumber, ghost: v.exactOptional(v.literal(true)) });

/** Exact build-time world placements; the page only renders these rows. */
export const DRESSING_PLAN = v.object({
  boulder: v.array(instance), slab: v.array(instance), stone: v.array(instance),
  juniper: v.array(instance), rose: v.array(instance), willow: v.array(instance),
  lupin: v.array(instance), daisy: v.array(instance), reed: v.array(instance),
  logs: v.array(v.object({ ax: dressNumber, az: dressNumber, bx: dressNumber, bz: dressNumber, r: dressNumber, drift: v.boolean() })),
  stumps: v.array(spot), ovoos: v.array(spot), poles: v.array(spot),
  fences: v.array(v.array(v.tuple([dressNumber, dressNumber]))), gates: v.array(v.object({ x: dressNumber, z: dressNumber, yaw: dressNumber })),
  drifts: v.array(v.object({ x: dressNumber, y: dressNumber, z: dressNumber, r: dressNumber })), colliders: v.array(box),
});
export type DressPlan = v.InferOutput<typeof DRESSING_PLAN>;
/** Camp anchors already rejected against the actual POI, outcrop and crag boxes. */
export const CAMP_CLUTTER = v.array(v.object({ x: dressNumber, z: dressNumber, yaw: dressNumber, kind: dressNumber }));
export type ClutterSpots = v.InferOutput<typeof CAMP_CLUTTER>;

function dressingGeo(key: string): THREE.BufferGeometry {
  const geometry = bakedDressingGeo(key); if (geometry === null) throw new Error(`Missing dressing shape ${key}`); return geometry;
}

/** Existing ambient rows own every flight/perch decision. This owner only draws their poses. */
function dressingLife(sky: Sky) {
  const profile = TIER === 'phone' ? coverRows.phone : coverRows.desktop, group = new THREE.Group(), drift = new THREE.Vector2();
  const count = TIER === 'phone' ? 380 : 900, seeds = new Float32Array(count * 4), rng = new Rng(0x9011e);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next();
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const shader = new ShaderFamily(MOTES_GLSL, {}), material = new THREE.ShaderMaterial({ vertexShader: shader.glsl(MOTES_GLSL.MOTE_VERT), fragmentShader: shader.glsl(MOTES_GLSL.MOTE_FRAG), transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDrift: { value: drift }, uBox: { value: new THREE.Vector3(26, 7, 26) }, uPx: { value: 600 }, uSunDir: painterlyUniforms.uPSunDir, uSunCol: { value: new THREE.Color(1, 0.93, 0.8) }, uOpacity: { value: 1 } } });
  const motes = new THREE.Points(geometry, material); motes.frustumCulled = false; motes.renderOrder = 2; motes.name = 'nalati-dress-pollen'; group.add(motes);
  const wings = new AmbientWingField({ groups: profile.life, layers: [
    { id:'butterfly', capacity:TIER==='phone'?coverRows.butterflies.phone:coverRows.butterflies.desktop, palette:coverRows.hue, flap:[12,1.15,.25] },
    { id:'raptor', capacity:coverRows.raptors, palette:[], flap:null },
  ] },new Map([['butterfly',coverGeometry(sky,'wing')],['raptor',coverGeometry(sky,'halfBird')]]),new Map([
    ['butterfly',painterlyMaterial(sky,{rim:.3,bands:.5,shade:.6,emissive:0x101010})],['raptor',painterlyMaterial(sky,{rim:.6,bands:.6})],
  ]));
  group.add(wings.group);let time=0;
  return { group, setPollen(value:number) { const opacity=material.uniforms['uOpacity'];if(opacity!==undefined)opacity.value=value; },
    update(dt:number,camera:THREE.PerspectiveCamera,player:THREE.Vector3,renderHeight:number){
      time+=dt;drift.x+=wind.dirX*wind.speed*.35*dt;drift.y+=wind.dirZ*wind.speed*.35*dt;
      const t=material.uniforms['uTime'],px=material.uniforms['uPx'];if(t!==undefined)t.value=time;if(px!==undefined)px.value=renderHeight/(2*Math.tan(camera.fov*Math.PI/360));
      wings.update(dt,player);
    } };

}

const PHONE = TIER === 'phone';

/** one scatter layer's model: what it draws, the colliders its big rocks made (world space, in plan order), its `place` */
interface Drawn { readonly layer: DressLayer; readonly list: readonly Inst[]; readonly descs: ColliderDesc[]; readonly place: (o: PlaceOptions) => Placed }

/** per-layer draw-distance scale on this tier */
const FAR = PHONE ? { rock: 0.6, small: 0.55, shrub: 0.6, flower: 0.55 } : { rock: 1, small: 1, shrub: 1, flower: 1 };

export class NalatiDressing {
  group = new THREE.Group();
  layers: DressLayer[] = [];
  props: THREE.Mesh[] = [];
  propTris = 0;
  flutter = new Flutter();
  life: ReturnType<typeof dressingLife> | null = null;
  /** the boxes, as data (keep-outs); their solids are in `descs` or, for a `ghost`, a hull / capsule / prism there */
  colliders: Box[] = [];
  /** the collision as real geometry: big rocks as hulls of what they draw, logs as capsules, the ovoo heaps as prisms */
  descs: ColliderDesc[] = [];
  plan: DressPlan | null = null;
  /** the one-off props (merged per region: the props' tap target) and the camps' clutter */
  statics: THREE.Object3D = new THREE.Group();
  private drawn: Drawn[] = [];
  private staticPiece: PoiPiece | null = null;
  private clutter: PoiPiece | null = null;
  /** build ms per stage */
  timings: Record<string, number> = {};
  private frustum = new THREE.Frustum();
  private projScreen = new THREE.Matrix4();
  private lastPos = new THREE.Vector3(1e9, 0, 0);
  private lastDir = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private readonly frame = new FrameCamera(this.group);
  private size = new THREE.Vector2();

  constructor(private sky: Sky) { this.group.name = 'nalati-dressing'; this.statics.name = 'nalati-dress-statics'; }


  async build(product: { file: (name: string) => Promise<Uint8Array> }, yieldTask: () => Promise<void> = () => Promise.resolve()): Promise<this> {
    let t0 = diagnosticNow();
    const lap = (k: string) => { const t = diagnosticNow(); this.timings[k] = Math.round(t - t0); t0 = t; };
    const read = async (key: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await product.file(`world/dressing-${key}.json`)));
    const entries = await Promise.all(Object.keys(DRESSING_PLAN.entries).map(async key => [key, await read(key)]));
    const plan = this.plan = v.parse(DRESSING_PLAN, Object.fromEntries(entries));
    lap('plan');
    await yieldTask();
    await Promise.all([preloadNalatiPlaces(), preloadCover()]); // the scatter shapes' bake (../placeBake.ts; in already when the POIs built first)
    t0 = diagnosticNow();

    const rock = painterlyMaterial(this.sky, { rim: 0.3, bands: 0.8 });
    const shrub = painterlyMaterial(this.sky, { rim: 0.5, bands: 0.7, sway: 0.05 });
    const flower = painterlyMaterial(this.sky, { rim: 0.45, bands: 0.6, sway: 0.3 });
    const reed = painterlyMaterial(this.sky, { rim: 0.5, bands: 0.6, sway: 0.1 });
    const add = <P extends object>(model: ModelDef<P>, name: string, geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[], far: number, o: { castShadow?: boolean; keepNear?: number } = {}) => {
      if (list.length === 0) { geo.dispose(); return; }
      const l = scatterLayer(`nalati-dress-${name}`, geo, mat, list, far, o.castShadow, o.keepNear);
      // P1: a big rock collides as the hull of what this layer draws for it
      const descs = list.some(it => it.solid === true) ? bakedDressingContacts(name) : [];
      this.descs.push(...descs);
      this.layers.push(l);
      this.drawn.push({ layer: l, list, descs, place: (how) => place(model, list.map((it) => ({ x: it.x, y: it.y, z: it.z })), how) });
      this.group.add(l.mesh);
    };
    // The prepared boulders share the declared material with their Explorer specimens.
    const rockModels = await Promise.all((['boulder-1', 'boulder-2', 'boulder-3'] as const).map((n) => loadBoundSpecimen(this.sky, specimenData.assets[n]))).catch((e: unknown) => { console.warn('[nalati] rock models failed', e); return null; });
    if (rockModels) {
      const [b1, b2, b3] = rockModels;
      if (b1 && b2 && b3) {
        add(boulder, 'boulder', bakedActorGeometry(`dressing:${TIER}:boulder`), b1.material, plan.boulder.filter((_, i) => i % 3 !== 2), FAR.rock, { castShadow: true, keepNear: 40 });
        add(boulder, 'boulder-tall', bakedActorGeometry(`dressing:${TIER}:boulder-tall`), b2.material, plan.boulder.filter((_, i) => i % 3 === 2), FAR.rock, { castShadow: true, keepNear: 40 });
        add(slab, 'slab', bakedActorGeometry(`dressing:${TIER}:slab`), b3.material, plan.slab, FAR.rock, { castShadow: true, keepNear: 40 });
      }
    } else {
      add(boulder, 'boulder', dressingGeo(`boulder:${PHONE ? 2 : 3}`), rock, plan.boulder, FAR.rock, { castShadow: true, keepNear: 40 });
      add(slab, 'slab', dressingGeo(`slab:${PHONE ? 2 : 3}`), rock, plan.slab, FAR.rock, { castShadow: true, keepNear: 40 });
    }
    add(stone, 'stone', dressingGeo('stone'), rock, plan.stone, FAR.small);
    add(juniper, 'juniper', dressingGeo('juniper'), shrub, plan.juniper, FAR.shrub, { castShadow: !PHONE });
    add(wildRose, 'rose', dressingGeo(PHONE ? 'rose:lite' : 'rose'), shrub, plan.rose, FAR.shrub, { castShadow: !PHONE });
    add(dwarfWillow, 'willow', dressingGeo('willow'), shrub, plan.willow, FAR.shrub, { castShadow: !PHONE });
    add(lupin, 'lupin', dressingGeo(PHONE ? 'lupin:lite' : 'lupin'), flower, plan.lupin, FAR.flower);
    add(daisy, 'daisy', dressingGeo('daisy'), flower, plan.daisy, FAR.flower);
    add(reeds, 'reed', dressingGeo('reed'), reed, plan.reed, FAR.shrub);
    lap('layers');
    await yieldTask();
    t0 = diagnosticNow();

    const steps = this.staticSteps('dressing-statics');
    let step = steps.next();
    while (step.done !== true) { await yieldTask(); step = steps.next(); }
    const st = step.value;
    this.props = st.object.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    this.propTris = st.tris;
    this.staticPiece = st;
    this.statics = st.object;
    this.group.add(this.statics);
    if (this.flutter.count > 0) this.group.add(this.flutter.build(this.sky));
    this.colliders = [...plan.colliders, ...st.colliders];
    this.descs.push(...(st.descs ?? []));
    lap('props');
    await yieldTask();
    t0 = diagnosticNow();

    this.life = dressingLife(this.sky);
    this.group.add(this.life.group);
    lap('life');
    await yieldTask();
    return this;
  }

  /** Into the scene; camp clutter uses its already-cleared build-time anchors. */
  addTo(scene: THREE.Object3D): void {
    scene.add(this.group);
    const steps = this.staticSteps('dressing-clutter');
    for (;;) { const step = steps.next(); if (step.done === true) { this.addClutter(step.value); break; } }
  }

  /** `addTo`, the clutter a task apart whenever `due` says the task is over budget (SF67); the same clutter */
  async addToSliced(scene: THREE.Object3D, due: () => Promise<void> | null): Promise<void> {
    scene.add(this.group);
    const steps = this.staticSteps('dressing-clutter');
    for (;;) {
      const step = steps.next(); if (step.done === true) { this.addClutter(step.value); break; }
      const pause = due(); if (pause !== null) await pause;
    }
  }

  private staticSteps(name: string): Generator<void, PoiPiece> {
    return bakedPlaceSteps(name, { sky: this.sky, ground: () => 0, flutter: this.flutter, smoke: { emitter: () => undefined } }, new Map([placer(fallenLog), placer(stump), placer(ovoo), placer(viewpointPole), placer(skyGateway), placer(fence), placer(campClutter)]));
  }

  private addClutter(cl: PoiPiece): void {
    if (isMesh(cl.object)) { this.group.add(cl.object); this.props.push(cl.object); this.propTris += cl.tris; this.clutter = cl; }
    this.colliders.push(...cl.colliders);
    if (import.meta.env.DEV) Object.assign(window, { __nalatiDressing: this }); // dev: stats / poking from the console
  }

  /**
   * The dressing's models into the world registry (E306 / E315; NALATI-MERGE P1: its collision): each scatter layer's
   * model placed `drawnInto` its layer, the big rocks' hulls 150 a task (the phone's per-task collider budget), then the
   * props (their region meshes) and the camps' clutter.
   */
  async place(registry: WorldRegistry, yieldTask: () => Promise<void>): Promise<readonly Placed[]> {
    const ctx = modelContext(this.sky);
    const out: Placed[] = [];
    for (const d of this.drawn) {
      const placed = d.place({
        ctx, draw: 'instanced', registry, drawnInto: { object: d.layer.mesh, boxes: instanceBoxes(d.layer.mesh.geometry, d.list), colliders: d.descs },
        piece: { solidFloor: true, split: { every: 150, yieldTask } },
      });
      await placed.registered;
      out.push(placed);
      await yieldTask();
    }
    if (this.staticPiece?.register) out.push(...this.staticPiece.register({ ctx, registry }));
    await yieldTask();
    if (this.clutter?.register) out.push(...this.clutter.register({ ctx, registry }));
    return out;
  }

  update(dt: number, view: THREE.PerspectiveCamera, player: THREE.Vector3, renderer: Renderer): void {
    // SF63: the layers' copies are in the group's space; inside a grid cell it stands at the cell's render offset, so the
    // cull reads the camera seen from the group (standalone: the camera itself)
    const camera = this.frame.of(view);
    camera.getWorldPosition(this.camPos);
    camera.getWorldDirection(this.dir);
    const moved = this.camPos.distanceToSquared(this.lastPos) > 1;
    const turned = this.dir.dot(this.lastDir) < 0.9994; // ≈ 2°
    if (moved || turned) {
      this.lastPos.copy(this.camPos); this.lastDir.copy(this.dir);
      camera.updateMatrixWorld();
      this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projScreen);
      for (const l of this.layers) l.cull(this.frustum, this.camPos);
    }
    this.flutter.update(dt);
    renderer.getDrawingBufferSize(this.size);
    this.life?.update(dt, view, player, this.size.y);
  }

  /** visible instances / triangles per layer (after the last cull) + the static props */
  stats(): { layers: Record<string, { total: number; visible: number; tris: number }>; propTris: number; clothVerts: number; calls: number } {
    const layers: Record<string, { total: number; visible: number; tris: number }> = {};
    let calls = 0;
    for (const l of this.layers) { layers[l.name] = { total: l.count, visible: l.visible, tris: Math.round(l.tris) }; if (l.visible > 0) calls++; }
    return { layers, propTris: Math.round(this.propTris), clothVerts: this.flutter.vertexCount, calls: calls + this.props.length + 4 };
  }
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh { return object instanceof THREE.Mesh; }
