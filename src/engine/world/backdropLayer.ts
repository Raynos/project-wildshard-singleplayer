/**
 * A second sky backdrop laid over a page's own by a weight (SHARD-PLATFORM G223, SF19a's one frame): a grid region whose
 * level's sky is a whole backdrop (a day clock driving a key dome, a PMREM environment, the lights, fog and haze), not
 * keys a region can hand over, draws that sky on the page's ONE sky rig while you are inside its cell, and blends it with
 * the page's own across the 16 m edge band.
 *
 * - **Its own targets**: the layered backdrop is bound to a private copy of the rig's targets (`SkyBackdropTargets`), so
 *   its clock writes only those. Each frame the page's own backdrop runs first and writes the shared state as always;
 *   then the layer runs its clock and moves every shared value it lights (the key light, the fill, the fog uniforms, the
 *   sun disc and halo, the cloud and far-haze uniforms, the environment intensity) toward its own by the weight; the
 *   environment texture swaps at half weight (a PMREM cube cannot be mixed). At the start of the next frame every value
 *   it moved is put back exactly before anything else runs, so the page's backdrop always finds its own state, and at
 *   weight 0 the shared state is the page's to the bit.
 * - **Its air**: given a fog object of its own (`air`, a grid region's fog: the one frame reads it as the owner's air and
 *   blends it by the owners' weights), the layer's clock writes its fog colour there and leaves the scene fog alone;
 *   without one it blends the scene fog's colour like the rest.
 * - **Its dome**: whatever the backdrop adds to the layer's `holder` scene (its sky dome) moves to the page scene, drawn
 *   after the page's own sky pieces (render order −20 … −10) and before the grid road sky (−9), depth-tested (the dome
 *   sits past every world thing), with a constant blend alpha of the weight; at weight 0 it is hidden and its clock is
 *   not run (no cost outside the cell).
 * - **Its dispose**: the dome leaves the page scene, the backdrop's own `dispose` frees its textures and targets, and the
 *   last frame's moved values go back at the next update.
 *
 * The post effects a backdrop drives (`attachPost`) stay the page's: a layered backdrop is never handed them.
 */
import {
  BufferGeometry, Color, ConstantAlphaFactor, CustomBlending, DirectionalLight, Fog, HemisphereLight, Material, Mesh,
  MeshBasicMaterial, OneMinusConstantAlphaFactor, Scene, Sprite, SpriteMaterial, Vector3, type Object3D, type PerspectiveCamera,
} from 'three';
import type { Scope } from '../app/scope';
import { resourceScope } from '../app/resources';
import { ownSceneTree } from '../app/sceneOwnership';
import type { AssetService } from '../app/assets';
import type { SkyBackdrop, SkyBackdropTargets } from '../render/look';

/** the layered dome's render order: after the page's sky pieces (−20 … −10), before the grid road sky (−9) */
export const LAYER_SKY_ORDER = -9.5;
/** below this weight the layer is off: hidden, its clock not run, nothing moved */
const OFF = 0.001;

/** One shared value the layer moves: held before it writes, blended toward its own, put back at the next frame. */
interface Slot { readonly save: () => void; readonly blend: (w: number) => void; readonly undo: () => void }

function colour(real: () => Color, own: Color): Slot {
  const held = new Color();
  return { save: () => { held.copy(real()); }, blend: (w) => { real().lerp(own, w); }, undo: () => { real().copy(held); } };
}
/** a direction: lerped and renormalised (the far side of a swap falls back to the layer's own) */
function direction(real: Vector3, own: Vector3): Slot {
  const held = new Vector3();
  return {
    save: () => { held.copy(real); },
    blend: (w) => { real.lerp(own, w); if (real.lengthSq() > 1e-10) real.normalize(); else real.copy(own); },
    undo: () => { real.copy(held); },
  };
}
function scalar(get: () => number, set: (v: number) => void, own: () => number): Slot {
  let held = 0;
  return { save: () => { held = get(); }, blend: (w) => { const v = get(); set(v + (own() - v) * w); }, undo: () => { set(held); } };
}
function vector(real: Vector3, own: Vector3): Slot {
  const held = new Vector3();
  return { save: () => { held.copy(real); }, blend: (w) => { real.lerp(own, w); }, undo: () => { real.copy(held); } };
}

const basicColour = (mesh: Mesh): Color | null => (mesh.material instanceof MeshBasicMaterial ? mesh.material.color : null);

/** What the layer reads: the rig's live targets and the page scene it draws into. */
export interface BackdropLayerHost {
  readonly targets: SkyBackdropTargets;
  readonly scene: Scene;
}

/** A layered backdrop's readout (tests, captures, the census). */
export interface BackdropLayerState { readonly weight: number; readonly drawn: boolean; readonly attached: boolean; readonly disposed: boolean; readonly bytes: number }

export class BackdropLayer {
  /** the scene the backdrop factory is handed: its dome and its environment land here, never on the page scene */
  readonly holder = new Scene();
  /** the private targets the layered backdrop is bound to */
  readonly targets: SkyBackdropTargets;
  private readonly slots: Slot[];
  private readonly domes: Object3D[] = [];
  private readonly materials: { blendAlpha: number }[] = [];
  private readonly host: BackdropLayerHost;
  private readonly scope: Scope;
  private readonly assets: Pick<AssetService, 'isAcquired'>;
  private backdrop: SkyBackdrop | null = null;
  private weight_ = 0;
  private drawn = false;
  private disposed = false;
  private readonly onDispose: () => void;

  constructor(host: BackdropLayerHost, options: { readonly air?: () => Fog | null; readonly onDispose: () => void; readonly owner?: Scope; readonly assets?: Pick<AssetService, 'isAcquired'> }) {
    this.host = host;
    this.scope = (options.owner ?? resourceScope()).child('BackdropLayer');
    this.assets = options.assets ?? { isAcquired: () => false };
    ownSceneTree(this.holder, this.scope, this.assets);
    const real = host.targets;
    this.onDispose = options.onDispose;
    const ownFog = new Fog(real.fog.color.clone(), 1, 1e6);
    const air = options.air;
    const discMaterial = new MeshBasicMaterial({ color: basicColour(real.disc)?.clone() ?? new Color(1, 1, 1) });
    const disc = new Mesh(new BufferGeometry(), discMaterial);
    disc.scale.copy(real.disc.scale);
    const halo = real.halo === null ? null : new Sprite(new SpriteMaterial({ color: real.halo.material.color.clone(), opacity: real.halo.material.opacity }));
    if (halo !== null && real.halo !== null) halo.scale.copy(real.halo.scale);
    const cloud = { uSunDir: { value: real.cloud.uSunDir.value.clone() }, uSunColor: { value: real.cloud.uSunColor.value.clone() }, uCloudLit: { value: real.cloud.uCloudLit.value.clone() }, uCloudAlpha: { value: real.cloud.uCloudAlpha.value } };
    const far = { uHazeCol: { value: real.far.uHazeCol.value.clone() }, uSeaSky: { value: real.far.uSeaSky.value.clone() }, uSeaSun: { value: real.far.uSeaSun.value.clone() }, uSeaSunDir: { value: real.far.uSeaSunDir.value.clone() } };
    const planet = { uSunDir: { value: real.planet.uSunDir.value.clone() }, uHaze: { value: real.planet.uHaze.value.clone() }, uCrisp: { value: real.planet.uCrisp.value } };
    const fogU = { fogSunDir: { value: real.fogU.fogSunDir.value.clone() }, fogSunColor: { value: real.fogU.fogSunColor.value.clone() }, fogDistDensity: { value: real.fogU.fogDistDensity.value }, fogHeightDensity: { value: real.fogU.fogHeightDensity.value } };
    const lights = real.lights.map((l) => { const own = new DirectionalLight(l.color.clone(), l.intensity); return own; });
    const hemi = new HemisphereLight(real.hemi.color.clone(), real.hemi.groundColor.clone(), real.hemi.intensity);
    this.targets = {
      sunDir: real.sunDir.clone(), sunColor: real.sunColor.clone(), lights, lightDirection: real.lightDirection.clone(), hemi,
      get fog() { return air?.() ?? ownFog; },
      fogU, underwater: real.underwater, disc, halo, cloud, far, planet, shadowBusy: real.shadowBusy,
    };
    const own = this.targets, holder = this.holder, scene = host.scene;
    this.slots = [
      direction(real.sunDir, own.sunDir), colour(() => real.sunColor, own.sunColor), direction(real.lightDirection, own.lightDirection),
      ...real.lights.flatMap((l, i) => {
        const o = lights[i];
        return o === undefined ? [] : [colour(() => l.color, o.color), scalar(() => l.intensity, (v) => { l.intensity = v; }, () => o.intensity)];
      }),
      colour(() => real.hemi.color, hemi.color), colour(() => real.hemi.groundColor, hemi.groundColor), scalar(() => real.hemi.intensity, (v) => { real.hemi.intensity = v; }, () => hemi.intensity),
      direction(real.fogU.fogSunDir.value, fogU.fogSunDir.value), colour(() => real.fogU.fogSunColor.value, fogU.fogSunColor.value),
      scalar(() => real.fogU.fogDistDensity.value, (v) => { real.fogU.fogDistDensity.value = v; }, () => fogU.fogDistDensity.value),
      scalar(() => real.fogU.fogHeightDensity.value, (v) => { real.fogU.fogHeightDensity.value = v; }, () => fogU.fogHeightDensity.value),
      vector(real.disc.scale, disc.scale),
      ...(basicColour(real.disc) === null ? [] : [colour(() => basicColour(real.disc) ?? discMaterial.color, discMaterial.color)]),
      ...(real.halo === null || halo === null ? [] : ((h: Sprite, o: Sprite): Slot[] => [colour(() => h.material.color, o.material.color), vector(h.scale, o.scale),
        scalar(() => h.material.opacity, (v) => { h.material.opacity = v; }, () => o.material.opacity)])(real.halo, halo)),
      direction(real.cloud.uSunDir.value, cloud.uSunDir.value), colour(() => real.cloud.uSunColor.value, cloud.uSunColor.value), colour(() => real.cloud.uCloudLit.value, cloud.uCloudLit.value),
      scalar(() => real.cloud.uCloudAlpha.value, (v) => { real.cloud.uCloudAlpha.value = v; }, () => cloud.uCloudAlpha.value),
      colour(() => real.far.uHazeCol.value, far.uHazeCol.value), colour(() => real.far.uSeaSky.value, far.uSeaSky.value), colour(() => real.far.uSeaSun.value, far.uSeaSun.value),
      direction(real.far.uSeaSunDir.value, far.uSeaSunDir.value),
      direction(real.planet.uSunDir.value, planet.uSunDir.value), colour(() => real.planet.uHaze.value, planet.uHaze.value),
      scalar(() => real.planet.uCrisp.value, (v) => { real.planet.uCrisp.value = v; }, () => planet.uCrisp.value),
      ...(air === undefined ? [colour(() => real.fog.color, ownFog.color)] : []),
      scalar(() => scene.environmentIntensity, (v) => { scene.environmentIntensity = v; }, () => holder.environmentIntensity),
      ((): Slot => {
        let held: Scene['environment'] = null;
        return { save: () => { held = scene.environment; }, blend: (w) => { if (w >= 0.5 && holder.environment !== null) scene.environment = holder.environment; }, undo: () => { scene.environment = held; } };
      })(),
    ];
  }

  /** The built backdrop (made against `holder` and this layer's `targets`): its dome moves to the page scene, its clock binds here. */
  attach(backdrop: SkyBackdrop): void {
    if (this.disposed) { backdrop.dispose?.(); throw new Error('Backdrop layer attached after dispose'); }
    if (this.backdrop !== null) throw new Error('Backdrop layer already has a backdrop');
    this.backdrop = backdrop;
    for (const child of this.holder.children.slice()) {
      ownSceneTree(child, this.scope, this.assets);
      this.holder.remove(child);
      child.visible = false;
      child.traverse((node) => {
        node.renderOrder = LAYER_SKY_ORDER;
        const list: unknown = node instanceof Mesh ? node.material : null;
        for (const m of Array.isArray(list) ? list : [list]) {
          if (!(m instanceof Material)) continue;
          m.transparent = true; m.depthTest = true; m.depthWrite = false;
          m.blending = CustomBlending; m.blendSrc = ConstantAlphaFactor; m.blendDst = OneMinusConstantAlphaFactor; m.blendAlpha = 0;
          m.needsUpdate = true;
          this.materials.push(m);
        }
      });
      this.host.scene.add(child);
      this.domes.push(child);
    }
    backdrop.bind(this.targets);
  }

  /** The owner's weight (0..1), read at the next `apply`. */
  set weight(w: number) { this.weight_ = Number.isFinite(w) ? Math.min(1, Math.max(0, w)) : 0; }
  get weight(): number { return this.weight_; }

  /**
   * Once per frame, after the page's own backdrop wrote the shared state: run the layer's clock and move the shared state
   * toward it by the weight. Returns the undo (call it before the page's backdrop runs next), or null when off.
   */
  apply(dt: number, camera: PerspectiveCamera): (() => void) | null {
    const backdrop = this.backdrop, w = this.weight_;
    const on = backdrop !== null && !this.disposed && w > OFF;
    if (on !== this.drawn) { this.drawn = on; for (const dome of this.domes) dome.visible = on; }
    if (!on) return null;
    backdrop.update(dt, camera);
    for (const m of this.materials) m.blendAlpha = w;
    for (const slot of this.slots) slot.save();
    for (const slot of this.slots) slot.blend(w);
    return () => { for (let i = this.slots.length - 1; i >= 0; i--) this.slots[i]?.undo(); };
  }

  /** after an in-place WebGL restore: the backdrop's own way of rebuilding its textures and environment */
  rebuild(): void { this.backdrop?.rebuild(); }

  /** The GPU bytes the layered backdrop holds now (its own census; 0 when it declares none). */
  bytes(): number { return this.backdrop?.gpuBytes?.() ?? 0; }

  state(): BackdropLayerState {
    return { weight: Math.round(this.weight_ * 1000) / 1000, drawn: this.drawn, attached: this.backdrop !== null, disposed: this.disposed, bytes: this.bytes() };
  }

  /** The dome leaves the page scene and the backdrop frees its textures; the rig puts the last frame's values back. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const dome of this.domes) this.host.scene.remove(dome);
    this.domes.length = 0; this.materials.length = 0;
    this.backdrop?.dispose?.();
    this.backdrop = null;
    const disc = this.targets.disc;
    disc.geometry.dispose();
    if (disc.material instanceof Material) disc.material.dispose();
    this.targets.halo?.material.dispose();
    this.scope.dispose();
    this.onDispose();
  }
}
