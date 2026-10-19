import { retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';
// Live blade sampling and numeric graph writes over the shared arm player.
import { BackSide, BufferGeometryLoader, DoubleSide, LinearMipmapLinearFilter, Matrix4, Mesh, NoColorSpace, Texture, Vector3 } from 'three';
import rigRows from '../data/arms.json' with { type: 'json' };
import type { HeldView } from './uniformTypes';
import { restoreWeave } from '../look/style';
import { loadFirstPartyProduct, runtimeLookMaterials, slugRuntimeProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { RigArms, swordArmsOf, type RigState } from '@wildshard/game/systems/viewmodel/rigArms';
import { ARM_CLIPS, armClipNames } from '@wildshard/game/systems/viewmodel/armClips';
import { SlashTrail } from '@wildshard/engine/combat/view/slashTrail';
import { BLEND_ADD_KEEP_ALPHA } from '@wildshard/sdk/looks/shaderFamily';
import { paintCanvasAtlas } from '@wildshard/sdk/looks/canvasAtlas';
import { plumbingKnob } from '@wildshard/game/shard/declaredPlumbing';
import { createClientScene } from '@wildshard/game/plugin/ui';
import { resourceScope } from '@wildshard/engine/app/resources';
import { fetchImage, phoneUrl } from '@wildshard/engine/boot/bytes';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';
import type { ShardSword } from '@wildshard/game/shard/manifest';
import type { RigContract, RigBake } from '@wildshard/engine/anim/rig';
import { app } from '@wildshard/engine/app/runtime';
import type { Tier as NdTier } from '@wildshard/engine/core/tier';
import type { GraphLiteral } from '@wildshard/format/materialGraph';

export const RIG_URL = `${rigRows.ARMS_BASE}fp-rig.glb`;
export const ARMS_CONTRACT: RigContract = { skeleton: 'nine-dragon-fp', clips: armClipNames(ARM_CLIPS), sockets: ['R_weapon', 'L_claw'] };
export const ARMS_BAKE: RigBake = { skeleton: 'nine-dragon-fp', clips: ARM_CLIPS, joints: ['R', 'L'].map(side => ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'].map(joint => `${side}_${joint}`)) };
export type MoveName = 'light' | 'light2' | 'light3' | 'charge' | 'heavy' | 'parry' | 'draw' | 'sheathe' | 'sheathed';
export type LeftName = 'grapple_aim' | 'grapple_fire' | 'grapple_hold' | 'idle';
export type ArmsState = RigState;
type Looks = Awaited<ReturnType<typeof runtimeLookMaterials>>;
const images = new Map<string, Promise<Texture>>(), resolved = new Map<string, Texture>(), atlases = new Map<NdTier, Texture>();

export class NineDragonArms {
  readonly root: RigArms['root'];
  readonly bones: RigArms['nodes'];
  private readonly ribbon = new SlashTrail({ samples: 28, subdivisions: 4, movementSq: 1e-6, channel: 'age' });
  readonly trail: { readonly mesh: Mesh };
  private trailLife = 0.32;
  private t = 0;
  private readonly matrix = new Matrix4();
  private constructor(readonly rig: RigArms, private readonly looks: Looks, private readonly params: ReadonlyMap<string, ReadonlySet<string>>) {
    this.root = rig.root; this.bones = rig.nodes;
    const material = looks.materials.get('nine-vm-trail');
    if (material === undefined) throw new Error('Missing held trail graph');
    this.trail = { mesh: new Mesh(this.ribbon.geometry, material) };
    this.trail.mesh.frustumCulled = false; this.trail.mesh.renderOrder = 5; this.trail.mesh.visible = false;
    this.root.add(this.trail.mesh);
  }
  static async load(tier: NdTier = app.render?.tier ?? 'desktop', url = RIG_URL): Promise<NineDragonArms> {
    const render = app.render;
    if (render === null) throw new Error('Held graphs require the render service');
    const owner = resourceScope(), product = await loadFirstPartyProduct('nine-dragon-stack');
    const { meshes, pendants, decal: decalRow, materials: pendantMaterials, params: namesById } = (await product.json<{ readonly view: HeldView }>('weapons/jian-row.json')).view;
    const ids = [...meshes.map(row => row.look), ...new Set(pendantMaterials), 'nine-vm-trail'];
    const looks = await runtimeLookMaterials({ scope: owner, renderer: render.renderer }, product.shardfile, true, ids);
    const params = new Map(ids.map(id => [id, new Set(namesById[id])] as const));
    const rig = await RigArms.load(url, ARMS_CONTRACT, ARMS_BAKE, false, { aliases: ARM_CLIPS, holdRight: rigRows.ARMS.holdRight, holdLeft: rigRows.ARMS.holdLeft, walkRate: rigRows.ARMS.walkRate, lag: rigRows.ARMS.lag });
    const silk = owner.own(restoreWeave(await product.file('looks/plain-weave.r8')));
    let decal = atlases.get(tier);
    if (decal !== undefined && !app.assets.isAcquired(decal)) decal = undefined;
    if (decal === undefined) { decal = retainCachedResources(paintCanvasAtlas(decalRow, plumbingKnob(slugRuntimeProduct('nine-dragon-stack')?.source.plumbing, tier, 'nine.decalScale', 'number'))); atlases.set(tier, decal); }
    ownSceneResource(decal, owner, app.assets);
    const maps = new Map(await Promise.all(rigRows.ARMS_MAPS.map(async name => [name, await Promise.all(['maps', 'nrm'].map(async kind => {
      const path = `${rigRows.ARMS_BASE}${name}-${kind}.webp`;
      const kept = resolved.get(path); if (kept !== undefined && !app.assets.isAcquired(kept)) images.delete(path);
      let loading = images.get(path);
      if (loading === undefined) { loading = (async () => {
        const value = await ktx2Texture(phoneUrl(path)) ?? new Texture(await fetchImage(path, Infinity, false));
        value.colorSpace = NoColorSpace; value.flipY = false; value.minFilter = LinearMipmapLinearFilter; value.anisotropy = 4; value.needsUpdate = true;
        resolved.set(path, value);
        return retainCachedResources(value);
      })(); images.set(path, loading); }
      const texture = await loading;
      ownSceneResource(texture, owner, app.assets); return texture;
    }))] as const)));
    for (const [id, names] of params) {
      if (names.has('uSilk')) looks.setTexture(id, 'uSilk', silk);
      if (names.has('uDecal')) looks.setTexture(id, 'uDecal', decal);
      const material = looks.materials.get(id);
      if (material === undefined) throw new Error(`Missing held material ${id}`);
      if (id.includes('hull')) material.side = BackSide;
      if (id === 'nine-vm-edge' || id === 'nine-vm-trail') material.setValues({ ...BLEND_ADD_KEEP_ALPHA, transparent: true, depthWrite: false });
    }
    for (const mesh of rig.meshes()) {
      const row = meshes.find(entry => entry.name === mesh.name), material = row === undefined ? undefined : looks.materials.get(row.look);
      if (row === undefined || material === undefined) throw new Error(`Missing held mesh row ${mesh.name}`);
      for (const [name, source] of Object.entries(row.channels)) if (mesh.geometry.hasAttribute(source)) { mesh.geometry.setAttribute(name, mesh.geometry.getAttribute(source)); if (source.startsWith('_')) mesh.geometry.deleteAttribute(source); }
      mesh.material = material; material.side = row.hull ? BackSide : row.doubleSide ? DoubleSide : material.side;
      if (row.hull) mesh.renderOrder = -1;
      const [map, normal] = maps.get(row.maps) ?? [];
      if (map !== undefined) looks.setTexture(row.look, 'uMapsTex', map);
      if (normal !== undefined) looks.setTexture(row.look, 'uNrmTex', normal);
    }
    const result = new NineDragonArms(rig, looks, params);
    const loader = new BufferGeometryLoader(), parts = await product.json<Record<string, unknown>>('weapons/jian-cloth.json');
    const geometry = new Map(Object.entries(parts).map(([key, value]) => [key, owner.own(loader.parse(value))]));
    const halo = await product.json<{ readonly geometry: unknown }>('weapons/jian-halo.json');
    geometry.set('edge', owner.own(loader.parse(halo.geometry)));
    const weapon = rig.nodes.get(rigRows.ARMS.weapon);
    if (weapon === undefined) throw new Error('Jian pendant socket is missing');
    weapon.add(createClientScene(pendants, { geometry, materials: looks.materials }).root);
    for (const material of looks.materials.values()) material.onBeforeRender = (_renderer, _scene, camera) => { const p = camera.projectionMatrix.elements; result.set('projection', [p[0], p[5], p[10], p[14]]); };
    owner.own(result.ribbon.geometry);
    return result;
  }
  private set(name: string, value: GraphLiteral): void { for (const [id, names] of this.params) if (names.has(name)) this.looks.setParam(id, name, value); }
  beginTrail(): void {
    const name = this.rig.move ?? 'light'; this.ribbon.reset();
    this.trailLife = (this.rig.meta.clips[name]?.timing?.total ?? rigRows.ARMS.trail.total) * rigRows.ARMS.trail.life;
    this.looks.setParam('nine-vm-trail', 'seed', Math.random() * 100);
  }
  playLeft(name: LeftName, fade = 0.1): void { this.rig.playLeft(name, fade); }
  setClawVisible(on: boolean): void { for (const mesh of this.rig.meshes()) if (mesh.name.startsWith(rigRows.ARMS.claw)) mesh.visible = on; }
  blade(base: Vector3, tip: Vector3, from = 0): void {
    const weapon = this.bones.get(rigRows.ARMS.weapon); if (weapon === undefined) return;
    this.root.updateMatrixWorld(true); this.matrix.copy(this.root.matrixWorld).invert().multiply(weapon.matrixWorld);
    base.set(0, rigRows.ARMS.bladeBase + (rigRows.ARMS.bladeTip - rigRows.ARMS.bladeBase) * from, 0).applyMatrix4(this.matrix);
    tip.set(0, rigRows.ARMS.bladeTip, 0).applyMatrix4(this.matrix);
  }
  resize(bw: number, bh: number, pr: number): void {
    this.set('uRes', [bw, bh]); this.set('uLinePx', Math.max(1, 1.6 * (pr / 2))); this.set('uHullPx', Math.max(1, 2.4 * (pr / 2)));
    this.looks.setParam('nine-vm-edge', 'resolution', [bw, bh]); this.looks.setParam('nine-vm-edge', 'pixels', 7 * pr);
  }
  update(dt: number, s: ArmsState): void { this.rig.update(dt, s); this.advanceLook(dt); }
  advanceLook(dt: number): void {
    this.t += dt; this.set('uTime', this.t); this.looks.setParam('nine-vm-edge', 'time', this.t);
    const name = this.rig.move, clip = name === null ? undefined : this.rig.meta.clips[name], timing = clip?.timing;
    if (timing !== null && timing !== undefined && this.rig.time >= timing.windup && this.rig.time <= timing.slashEnd) {
      const base = new Vector3(), tip = new Vector3();
      const from = clip !== undefined && 'trailFrom' in clip && typeof clip.trailFrom === 'number' ? clip.trailFrom : rigRows.ARMS.trail.from;
      this.blade(base, tip, from); this.ribbon.sample(base, tip, this.t);
    }
    this.trail.mesh.visible = this.ribbon.rebuild(this.t, this.trailLife);
  }
}
/** The shared rig player owns clip blending and the held camera projection. */
export async function jianArms(): Promise<ShardSword> {
  const rig = await NineDragonArms.load(); rig.root.traverse(node => { node.userData['treatAsOpaque'] = true; });
  const arms = swordArmsOf(rig.rig, {});
  return { arms: { ...arms, engineTrail: false,
    play: move => { arms.play(move); rig.beginTrail(); },
    blade: (base, tip) => { rig.blade(base, tip); rig.root.updateMatrix(); base.applyMatrix4(rig.root.matrix); tip.applyMatrix4(rig.root.matrix); },
    playLeft: name => { rig.playLeft(name); }, setClawVisible: visible => { rig.setClawVisible(visible); },
    update: (dt, state) => { const r = state.renderer; rig.resize(r.domElement.width, r.domElement.height, r.getPixelRatio()); arms.update(dt, state); rig.advanceLook(dt); },
  } };
}
