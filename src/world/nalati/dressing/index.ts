/**
 * Nalati dressing (look-pass lever 6, "density") — everything small that makes the steppe feel lived-in between the
 * POIs: boulder clusters with moss and lichen, outcrop slabs, stones lining every road, pebbles / cobbles / driftwood
 * on the gravel bars, junipers, wild rose, dwarf willow, lupin / sage and edelweiss / buttercup drifts in 3D, reeds,
 * fallen logs and stumps round the spruce, ovoo cairns and ribbon poles at the viewpoints, loose clutter round the
 * camps, and ambient life (pollen + seed fluff in the sun, butterflies over the drifts, kites circling high).
 *
 *   import { NalatiDressing } from '../world/nalati/dressing';
 *   const dressing = await new NalatiDressing(sky, forest).build(macrotask);   // deterministic from the seed; yields between passes
 *   dressing.addTo(game.scene, player);                          // meshes + colliders
 *   game.onUpdate((dt) => dressing.update(dt, game.camera, player.position, renderer));
 *   dressing.stats()                                             // { calls, tris, perLayer } for the perf report
 *
 * Draw calls: 9 instanced scatter layers (boulder, slab, stone, juniper, rose, willow, lupin, daisy, reed) + up to
 * 4 merged prop meshes (frustum-culled by region) + the ribbon cloth + pollen + butterflies + raptors ≈ 17, of
 * which boulder / slab / the prop meshes also cast shadows. Everything is on the shared painterly material (one
 * program, + its instanced sibling) except the pollen points. Per-instance culling (range + frustum) runs only when
 * the view has moved ≥ 1 m or turned ≥ 2°; draw distances are per instance (density falls off with distance) and
 * scaled down on the phone tier.
 */
import * as THREE from 'three';
import { TIER } from '../../../core/tier';
import { painterlyMaterial } from '../../painterly';
import { Flutter } from '../Flutter';
import { DressLayer, type Inst } from './layer';
import { planDressing, type DressPlan } from './place';
import { boulderGeo, slabGeo, stoneGeo, juniperGeo, roseGeo, willowGeo, lupinGeo, daisyGeo, reedGeo } from './models';
import { buildStatics } from './statics';
import { DressLife } from './life';
import type { Sky } from '../../Sky';
import type { Forest } from '../../Forest';
import type { Collider } from '../../../player/Player';

const PHONE = TIER === 'phone';
/** per-layer draw-distance scale on this tier */
const FAR = PHONE ? { rock: 0.6, small: 0.55, shrub: 0.6, flower: 0.55 } : { rock: 1, small: 1, shrub: 1, flower: 1 };

export class NalatiDressing {
  group = new THREE.Group();
  layers: DressLayer[] = [];
  props: THREE.Mesh[] = [];
  propTris = 0;
  flutter = new Flutter();
  life: DressLife | null = null;
  colliders: Collider[] = [];
  plan: DressPlan | null = null;
  /** build ms per stage */
  timings: Record<string, number> = {};
  private frustum = new THREE.Frustum();
  private projScreen = new THREE.Matrix4();
  private lastPos = new THREE.Vector3(1e9, 0, 0);
  private lastDir = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private size = new THREE.Vector2();

  constructor(private sky: Sky, private forest: Forest | null) { this.group.name = 'nalati-dressing'; }

  async build(yieldTask: () => Promise<void> = () => Promise.resolve()): Promise<this> {
    let t0 = performance.now();
    const lap = (k: string) => { const t = performance.now(); this.timings[k] = Math.round(t - t0); t0 = t; };
    const plan = this.plan = await planDressing(this.forest, yieldTask);
    lap('plan');
    await yieldTask();
    t0 = performance.now();

    const rock = painterlyMaterial(this.sky, { rim: 0.3, bands: 0.8 });
    const shrub = painterlyMaterial(this.sky, { rim: 0.5, bands: 0.7, sway: 0.05 });
    const flower = painterlyMaterial(this.sky, { rim: 0.45, bands: 0.6, sway: 0.3 });
    const reed = painterlyMaterial(this.sky, { rim: 0.5, bands: 0.6, sway: 0.1 });
    const add = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[], far: number, o: { castShadow?: boolean; keepNear?: number } = {}) => {
      if (list.length === 0) { geo.dispose(); return; }
      const l = new DressLayer(name, geo, mat, list, { farScale: far, ...o });
      this.layers.push(l);
      this.group.add(l.mesh);
    };
    add('boulder', boulderGeo(0xb01d, PHONE ? 2 : 3), rock, plan.boulder, FAR.rock, { castShadow: true, keepNear: 40 });
    add('slab', slabGeo(0x51ab, PHONE ? 2 : 3), rock, plan.slab, FAR.rock, { castShadow: true, keepNear: 40 });
    add('stone', stoneGeo(0x5707), rock, plan.stone, FAR.small);
    add('juniper', juniperGeo(0x1a9), shrub, plan.juniper, FAR.shrub, { castShadow: !PHONE });
    add('rose', roseGeo(0x805e, PHONE), shrub, plan.rose, FAR.shrub, { castShadow: !PHONE });
    add('willow', willowGeo(0x3170), shrub, plan.willow, FAR.shrub, { castShadow: !PHONE });
    add('lupin', lupinGeo(0x1ab1, PHONE), flower, plan.lupin, FAR.flower);
    add('daisy', daisyGeo(0xda15), flower, plan.daisy, FAR.flower);
    add('reed', reedGeo(0x4eed), reed, plan.reed, FAR.shrub);
    lap('layers');
    await yieldTask();
    t0 = performance.now();

    const st = buildStatics(this.sky, plan, this.flutter);
    this.props = st.meshes;
    this.propTris = st.tris;
    for (const m of st.meshes) this.group.add(m);
    if (this.flutter.count > 0) this.group.add(this.flutter.build(this.sky));
    this.colliders = [...plan.colliders, ...st.colliders];
    lap('props');

    this.life = new DressLife(this.sky, plan.drifts).build();
    this.group.add(this.life.group);
    lap('life');
    return this;
  }

  addTo(scene: THREE.Object3D, player: { colliders: Collider[] }): void {
    scene.add(this.group);
    player.colliders.push(...this.colliders);
    if (import.meta.env.DEV) Object.assign(window, { __nalatiDressing: this }); // dev: stats / poking from the console
  }

  update(dt: number, camera: THREE.PerspectiveCamera, player: THREE.Vector3, renderer: THREE.WebGLRenderer): void {
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
    this.life?.update(dt, camera, player, this.size.y);
  }

  /** visible instances / triangles per layer (after the last cull) + the static props */
  stats(): { layers: Record<string, { total: number; visible: number; tris: number }>; propTris: number; clothVerts: number; calls: number } {
    const layers: Record<string, { total: number; visible: number; tris: number }> = {};
    let calls = 0;
    for (const l of this.layers) { layers[l.name] = { total: l.count, visible: l.visible, tris: Math.round(l.tris) }; if (l.visible > 0) calls++; }
    return { layers, propTris: Math.round(this.propTris), clothVerts: this.flutter.vertexCount, calls: calls + this.props.length + 4 };
  }
}
