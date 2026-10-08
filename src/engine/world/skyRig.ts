import { SkyBackdropView } from './skyBackdrop';
import { BackdropLayer } from './backdropLayer';
import { resourceScope } from '../app/resources';
import type { Scope } from '../app/scope';
import { captureLookChunks, scopeLookChunks, type LookScopeOptions, type RegionLookParts, type ScopedLook } from '../render/regionLook';
import * as THREE from 'three';
import type { Renderer } from '../render/renderer';
import { TIER, TIER_CONFIG } from '../core/tier';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { cullToSlice, installCascadeCull } from './cascadeCull';
import { fogUniforms, isUnderwater } from './Atmosphere';
import type { LevelSpec } from '../level/spec';
import { SOFT_RADII, installShadowFilter } from './shadowFilter';
import { ShadowFade, installShadowFadeChunk, sunFadeUniform } from './shadowFade';
import { patchPointLightSkip } from './pointLightSkip';
import { registerCascades } from './cascadeLights';
import { patchCSMShaderChunk } from './csmLightBlock';
import type { DayCycleClock } from './dayCycle';
import { ShadowMaps } from './shadowVariants';
import type { LookStrategy, SkyBackdrop, SkyBackdropContext, SkyBackdropFactory, SkyBackdropPost, SkyBackdropTargets, SkyDressing } from '../render/look';
import { setting } from '../ui/Settings';
import { PATCH_ORDER, hasProgramKey, patchShader, takeForeignHook } from '../render/shaderPatches';
import { horizonLight } from './Horizon';
import type { LookupTexture } from 'postprocessing';

/** the key light's shadow direction steps (E89, as a stepped day / night clock's): ≤ ~1 shadow texel about every 1.5 s */
const KEY_SHADOW_STEP = 0.25 * Math.PI / 180;

/** the sun's shadow map(s): cascade count, map size (px), how far they reach (m), the caster margin (m) and, for two
 *  cascades, where the near one ends (m) */
export interface ShadowRig { cascades: number; size: number; far: number; margin: number; /** where each cascade but the last ends (m); empty = CSM's practical splits */ splits: number[]; /** the phone's low-poly rig (E123): normal bias in texels */ phone: boolean }

/** the phone's `phoneSplits` rig (ShadowStyle.rig). E123 (the user's pick `2c2k`, "both 2048 and 2c"): cascades at 2048². E147 (the
 *  user's pick C, crisper near shadows): three of them, to 7 / 22 / 80 m — 0.8 cm a texel near you, half E123's 1.6 cm, for
 *  ~+0.08 ms a frame on the M5 */
// Its filter and radii are shadowFilter.ts's since E138
const PHONE_SHADOW: Omit<ShadowRig, 'margin' | 'phone'> = { cascades: 3, size: 2048, far: 80, splits: [7, 22] };

/**
 * The shadow rig for this tier and the level's shadow style. The phone's portrait camera (94° vertical FOV) makes a cascade's square far
 * wider than its reach: the one 80 m cascade was 189 m across, so a 1024² texel was 18.5 cm and every shadow edge a
 * row of 18 cm steps smeared by the PCF (E123: "blocky, blobby, pixelated, bleeding").
 */
export function shadowRig(phoneSplits: boolean): ShadowRig {
  const T = TIER_CONFIG;
  const base: ShadowRig = { cascades: T.cascades, size: T.shadowMapSize, far: T.shadowFar, margin: T.shadowMargin, splits: [], phone: false };
  if (T.cascades !== 1 || !phoneSplits) return base; // desktop / a level without the split rig: the tier table
  const splits = PHONE_SHADOW.splits;
  return { ...PHONE_SHADOW, cascades: splits.length + 1, splits, margin: base.margin, phone: true };
}

/**
 * Lighting rig: HDRI sky for IBL + background, a cascaded-shadow sun matched to the
 * HDRI's brightest pixel, a visible sun disc (for god rays) and the ringed planet that
 * hangs over every the game level.
 */
export class SkyRig {
  private readonly scope = resourceScope().child('Sky');
  sunDir = new THREE.Vector3(0.3, 0.6, 0.4).normalize();
  /** the level's sun colour (SkySpec.sunColor), set by build() */
  sunColor = new THREE.Color();
  csm!: CSM;
  private readonly visual: SkyBackdropView;
  get sunDisc(): THREE.Mesh { return this.visual.sunDisc; }
  /** where the sun disc (and so the god rays) sits: the light's sun, or a painted sun's direction (E398) */
  get raysDir(): THREE.Vector3 { return this.visual.raysDir ?? this.sunDir; }
  get planet(): THREE.Group { return this.visual.planet; }
  get planetDir(): THREE.Vector3 { return this.visual.planetDir; }
  /** the fill light (ChunkSky.hemiSky / hemiGround / hemiIntensity) — a runtime handle for the day/night clocks */
  hemi!: THREE.HemisphereLight;
  private materials = new Set<THREE.Material>();
  /** the level this sky lights (handed to build()) */
  private level!: LevelSpec;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: Renderer;
  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: Renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
     this.visual = new SkyBackdropView(scene, renderer, this.scope, this); }

  /** the scene the sky lights (the LightPool's home) */
  get sceneRoot(): THREE.Scene { return this.scene; }
  /** the player's camera (world modules cull against it) */
  get viewCamera(): THREE.PerspectiveCamera { return this.camera; }

  /**
   * `look`: the level look's sky parts (01 §13.1) — its light model (`lighting`, installed first, before anything
   * compiles), its shadow style, its backdrop (else the HDRI) and its sky dressing.
   */
  async build(look: Pick<LookStrategy, 'lighting' | 'shadows' | 'backdrop' | 'sky'> | null, backdropData: Pick<SkyBackdropContext, 'level' | 'tier' | 'look'>): Promise<this> {
    this.dressing = look?.sky ?? null;
    this.level = backdropData.level;
    this.visual.configure(this.level, this.dressing);
    const { sky: S, atmosphere: A } = this.level;
    this.sunColor.set(...S.sunColor);
    look?.lighting?.install(); // a level's light model (patched into three's chunks before anything compiles)
    const shadows = look?.shadows ?? null;
    const backdropFactory = look?.backdrop;
    this.backdrop = backdropFactory ? await backdropFactory({ sky: this, scene: this.scene, renderer: this.renderer, ...backdropData }) : null;
    if (this.backdrop) this.lut = this.backdrop.lut;
    const horizon = this.backdrop?.horizon ?? await this.visual.setupHDRI();
    if (this.backdrop === null) this.lut = this.visual.lut;
    this.scene.fog = new THREE.Fog(horizon, 1, 1e6); // distances unused: Atmosphere.ts overrides the maths
    fogUniforms.fogSunDir.value.copy(this.sunDir);
    fogUniforms.fogSunColor.value.set(...S.fogSunColor);
    fogUniforms.fogHeight.value = A.fogHeight;
    fogUniforms.fogHeightFalloff.value = A.fogHeightFalloff;
    fogUniforms.fogHeightDensity.value = A.fogHeightDensity;
    fogUniforms.fogDistDensity.value = A.fogDistDensity;

    const rig = shadowRig(shadows?.rig === 'phoneSplits');
    this.csm = new CSM({
      camera: this.camera, parent: this.scene, cascades: rig.cascades, mode: rig.splits.length > 0 ? 'custom' : 'practical',
      // the near cascade ends at `splits[0]` m: a tight square round the player (the deck, the pier under foot), the last one takes the rest
      customSplitsCallback: (_n: number, _near: number, far: number, out: number[]) => { for (const m of rig.splits) out.push(Math.min(0.9, m / far)); out.push(1); },
      maxFar: rig.far, shadowMapSize: rig.size, lightDirection: this.sunDir.clone().negate(),
      lightIntensity: S.sunIntensity, shadowBias: -0.00012, lightMargin: rig.margin, lightNear: 1, lightFar: 600,
    });
    this.csm.fade = true;
    installCascadeCull(this.csm, this.camera); // each cascade draws only the casters its own slice can see the shadow of (PH-P2)
    if (!TIER_CONFIG.softShadows) this.renderer.shadowMap.type = THREE.PCFShadowMap; // 16-tap PCFSoft → 9-tap PCF on the phone
    // E138: the phone's split rig may filter its shadows with a 7×7 / 5×5 tent, not three's 5 noisy taps
    // (shadowFilter.ts) — here, at boot, before a material compiles
    const filter = shadows?.filter === 'tent' && rig.phone;
    if (filter) this.renderer.shadowMap.type = installShadowFilter();
    patchCSMShaderChunk();
    // E147: a stepped clock's shadow steps may crossfade (shadowFade.ts). E153 (the user's pick A+B, "they all look the
    // same, use the cheapest"): the fading-out ghost is sampled with the 3×3 tent (4 taps)
    if (shadows?.fade === true && installShadowFadeChunk()) {
      this.shadowFade = new ShadowFade(this.csm, this.camera, this.scene);
      for (const [i, g] of this.shadowFade.ghosts.entries()) cullToSlice(this.csm, this.camera, g.shadow, i); // E153: a ghost draws only its cascade's casters
    }
    registerCascades({ csm: this.csm, ghosts: this.shadowFade?.ghosts ?? [], fade: sunFadeUniform }); // SF59: node materials gate the cascades too (cascadeLights.ts)
    if (this.level.tiers?.[TIER]?.pointLightSkip === true) patchPointLightSkip(); // E142: a far / dark point light skips its BRDF (pointLightSkip.ts)
    // a low sun (golden hour, dawn) grazes flat decks: a shadow style may take more normal bias, or the planks speckle with acne
    for (const l of this.csm.lights) { l.color.copy(this.sunColor); l.shadow.normalBias = shadows?.normalBias ?? 0.05; l.shadow.radius = shadows?.radius ?? 2; }
    this.texelBias = shadows?.texelBias === 'phone' && rig.phone;
    this.farEveryOther = this.texelBias && this.csm.lights.length > 1;
    // E174: the phone rig's shadow maps are depth only at 16 bits (Jake's pick C; shadowVariants.ts): 40 MB, not three's 160
    if (shadows?.depth16 === 'phone' && rig.phone) {
      const maps = new ShadowMaps(this.renderer, this.csm, this.shadowFade?.ghosts ?? [], rig.size);
      maps.apply();
      this.shadowMaps = maps;
    }
    if (filter) {
      const [nearR, farR] = SOFT_RADII;
      this.csm.lights.forEach((l, i) => { l.shadow.radius = i === 0 && this.csm.lights.length > 1 ? nearR : farR; });
    }

    this.hemi = new THREE.HemisphereLight(S.hemiSky, S.hemiGround, S.hemiIntensity);
    this.scene.add(this.hemi);

    this.visual.buildSunDisc();
    this.visual.buildPlanet();
    const backdrop = this.backdrop, fog = this.scene.fog, halo = this.visual.sunHalo;
    if (backdrop?.clouds) this.visual.attachClouds(backdrop.clouds); // its own sky layer (a dome): Game.ts keeps `clouds` on the camera
    else this.visual.buildClouds();
    // the backdrop's clock turns every knob above from here on
    if (fog instanceof THREE.Fog) {
      // `fog` is read live: a look that replaces scene.fog after this bind (in its compose) would otherwise leave the
      // backdrop turning a fog nobody draws (E399 council round 21: a dusk fade that never reached the screen)
      const scene = this.scene;
      const liveFog = (): THREE.Fog => (scene.fog instanceof THREE.Fog ? scene.fog : fog);
      this.targets = {
        sunDir: this.sunDir, sunColor: this.sunColor, lights: this.csm.lights, lightDirection: this.csm.lightDirection, hemi: this.hemi,
        get fog() { return liveFog(); },
        fogU: fogUniforms, underwater: isUnderwater, disc: this.sunDisc, halo: halo instanceof THREE.Sprite ? halo : null,
        cloud: this.cloudUniforms, far: horizonLight, planet: this.giantUniforms,
        shadowBusy: () => this.shadowFade?.busy ?? false,
      };
      if (backdrop) {
        backdrop.bind(this.targets);
        this.dayNight = backdrop.clock;
      }
    }
    return this;
  }

  backdrop: SkyBackdrop | null = null;
  /** what a backdrop's clock turns (the lights, fog, disc, clouds, haze): bound to the level's backdrop, mirrored by every layer */
  private targets: SkyBackdropTargets | null = null;
  /** SHARD-PLATFORM G223: the backdrops laid over the level's own (a grid region's sky inside its cell; backdropLayer.ts) */
  private readonly layers = new Set<BackdropLayer>();
  /** the values the layers moved last frame, put back first thing each update */
  private readonly layerUndo: (() => void)[] = [];

  /**
   * SHARD-PLATFORM G223: lay a second backdrop over this sky by a weight (`backdropLayer.ts`). Build the backdrop against the
   * layer's `holder` scene and `targets`, then `attach` it; set its `weight` each frame (a grid region's frame weight: 1
   * inside its cell, blended across the edge band); `dispose` frees it and gives every shared value back. `air`: the
   * owner's own fog object its clock colours (a grid region's: the one frame blends it as the owner's air). Null before
   * the sky is built.
   */
  layerBackdrop(options: { readonly air?: () => THREE.Fog | null } = {}): BackdropLayer | null {
    const targets = this.targets;
    if (targets === null) return null;
    const layer = new BackdropLayer({ targets, scene: this.scene }, { ...options, onDispose: () => { this.layers.delete(layer); } });
    this.layers.add(layer);
    return layer;
  }

  /**
   * G223: build a level's backdrop as a layer over this sky (`layerBackdrop`), only while Settings ▸ Debug ▸ Region sky is
   * B (the region's own): null with the row on A (the default, nothing built) or before the sky is built. The caller
   * attaches the backdrop to the layer (`layer.attach`) once its memory is admitted, or disposes both.
   */
  async layeredBackdrop(factory: SkyBackdropFactory, options: { readonly level: LevelSpec; readonly air?: () => THREE.Fog | null }): Promise<{ layer: BackdropLayer; backdrop: SkyBackdrop } | null> {
    if (setting('regionSky') !== 'own') return null;
    const layer = this.layerBackdrop(options.air === undefined ? {} : { air: options.air });
    if (layer === null) return null;
    try {
      const backdrop = await factory({ sky: this, scene: layer.holder, renderer: this.renderer, level: options.level, tier: TIER, look: options.level.lookLayer ?? null });
      return { layer, backdrop };
    } catch (error) { layer.dispose(); throw error; }
  }

  /**
   * SF63: a level's light model, fog and sky dressing (`LookStrategy.lighting` / `fog` / `sky`) on the materials under
   * `root` only, while Settings ▸ Debug ▸ Region look is B (the region's own), as region-keyed program variants
   * (`render/regionLook.ts`); the page's chunks and programs never change. Null with the row on A (the default) or when
   * the level's installs change nothing on this page. `sweep` patches materials added since (call it before each frame
   * the subtree draws); `frame` runs the look's per-frame parts (its dressing's `update`, its `frame`: call it only while
   * the player is in the cell); the patches leave with `scope`.
   */
  scopeLevelLook(root: THREE.Object3D, level: { readonly id: string }, look: RegionLookParts, scope: Scope, options: LookScopeOptions = {}): ScopedLook | null {
    if (setting('regionSky') !== 'own') return null;
    const chunks = captureLookChunks(level.id, look, { sky: this, cloudField: () => this.visual.cloudField() });
    return chunks === null ? null : scopeLookChunks(root, chunks, scope, options, look);
  }

  attachPost(post: SkyBackdropPost): void { this.backdrop?.attachPost(post); }
  /** 0 = day … 1 = full night; a fixed sky stays at 0 */
  get night(): number { return this.dayNight?.night ?? 0; }
  /** the night lights (cabin windows, lanterns): the clock's 0 by day … 1 by night; the fixed sunset keeps them all lit (1) */
  get lamps(): number { return this.backdrop?.clock.lamps ?? 1; }

  /** the level's learned colour LUT (lut.ts, X1; per level) — Game.buildComposer ends the grade with it; null without a file */
  lut: LookupTexture | null = null;
  /** the day / night clock: the level backdrop's; null on a fixed sky */
  dayNight: DayCycleClock | null = null;

  /**
   * After an in-place WebGL restore (src/engine/core/GpuRecovery.ts, E54): the PMREM environment was a render target, so it came
   * back empty. Render it again — a backdrop's own way, the HDR level's from its background texture.
   */
  rebuildEnvironment(): void {
    this.shadowMaps?.apply(true); // E174: the restored context gave the maps back uninitialised
    for (const layer of this.layers) layer.rebuild();
    if (this.backdrop) { this.backdrop.rebuild(); return; }
    this.visual.rebuildEnvironment();
  }



  /**
   * Shared 1×1 fillers so every plain MeshStandard/Physical material carries the same map slots
   * (map · normal · ao · roughness · metalness) and therefore the same program: three keys a program
   * on WHICH slots exist, not their contents, so a coloured post, a mapped plank and a full PBR set
   * were three ~150 ms Metal compiles on the iPhone for what is one shader with different uniforms.
   * White multiplies by 1, a flat normal leaves the geometry normal; materials with their own
   * shader patch (an own customProgramCacheKey) are left alone.
   */
  private static fillers: { white: THREE.DataTexture; flatNormal: THREE.DataTexture } | null = null;
  private static fillSlots(mat: THREE.Material) {
    const m = mat as THREE.MeshStandardMaterial;
    if (!m.isMeshStandardMaterial || hasProgramKey(mat)) return;
    if (!SkyRig.fillers) {
      const tex = (rgb: [number, number, number], srgb: boolean) => { const t = new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
      SkyRig.fillers = { white: tex([255, 255, 255], true), flatNormal: tex([128, 128, 255], false) };
    }
    const { white, flatNormal } = SkyRig.fillers;
    m.map ??= white;
    m.normalMap ??= flatNormal;
    m.aoMap ??= white;         // ao · roughness · metalness read r · g · b: white = ×1
    m.roughnessMap ??= white;
    m.metalnessMap ??= white;
  }

  /** Wrap CSM's onBeforeCompile so materials keep their own shader patches. */
  setupMaterial(mat: THREE.Material): void {
    if (this.materials.has(mat)) return;
    this.materials.add(mat);
    SkyRig.fillSlots(mat);
    const csmHook = takeForeignHook(mat, () => { this.csm.setupMaterial(mat); });
    const fade = this.shadowFade !== null;
    if (this.shadowFade) mat.defines = { ...mat.defines, CSM_GHOSTS: this.shadowFade.ghosts.length }; // E147: the cascades mix in the fade's ghost shadows
    patchShader(mat, 'engine.csm', PATCH_ORDER.shadows, (shader, renderer) => { csmHook(shader, renderer); if (fade) shader.uniforms['uSunFade'] = sunFadeUniform; }, { key: (k) => `${k}|csm` });
    mat.needsUpdate = true;
  }

  /** the cloud layer(s) — Game.ts keeps them centred on the camera; null when the level's sky dressing paints its own */
  get clouds(): THREE.Object3D | null { return this.visual.clouds; }
  set clouds(value: THREE.Object3D | null) { this.visual.clouds = value; }
  /** the level look's own sky layer (LookStrategy.sky): built in place of / beside the cloud layer, updated every frame */
  private dressing: SkyDressing | null = null;
  private get cloudUniforms(): SkyBackdropView['cloudUniforms'] { return this.visual.cloudUniforms; }
  private get giantUniforms(): SkyBackdropView['giantUniforms'] { return this.visual.giantUniforms; }

  /** E174: the phone rig's shadow maps (shadowVariants.ts); null off the low-poly level's phone rig */
  shadowMaps: ShadowMaps | null = null;
  /** E147: the sun's shadow steps crossfade (shadowFade.ts); null = they pop (the other shards) */
  private shadowFade: ShadowFade | null = null;
  /** where the key light's shadow wants to point (setKeyLight); null on a level nothing moves the sun on */
  private keyShadowWant: THREE.Vector3 | null = null;

  /**
   * E123: on the phone's low-poly rig the normal bias is held in shadow texels, not metres. 0.14 m was ~0.75 of the old
   * 18.5 cm texel; on a finer map the same 0.14 m only lifts contact shadows off the deck (E112 already flips it for
   * two-sided sheets). A cascade's square follows the camera's aspect (a resize, a rotation), so it is read each frame.
   */
  private texelBias = false;
  /**
   * E189 (Jake, iPhone 17 Pro: the warm phone must hold a locked 30 in the grass, "keep the look"; his pick of what may
   * give: "far shadows softer" — redrawn less often): on the phone's low-poly rig the far cascade (22–80 m) is redrawn on
   * every other drawn frame, 15 times a second at the locked 30. A skipped frame keeps the last map AND the matrix it was
   * drawn with (WebGLShadowMap skips a light with autoUpdate off before it updates `shadow.matrix`), so the far shadows sit
   * exactly where they were, one frame old; only a moving caster out there (a palm swaying) steps at 15 Hz. The near and
   * middle cascades (the deck, the pier, the flag, everything within 22 m) are redrawn every frame, as before.
   */
  private farEveryOther = false;
  private farTick = 0;
  private fitNormalBias(): void {
    for (const l of this.csm.lights) {
      const texel = (l.shadow.camera.right - l.shadow.camera.left) / l.shadow.mapSize.x;
      if (Number.isFinite(texel) && texel > 0) l.shadow.normalBias = Math.min(0.14, 0.76 * texel);
    }
  }

  /**
   * E153: place every shadow for the camera as it is now and draw them at the next render — the cascades, their texel
   * bias and the fade's ghosts (Game.warmTurn: the boot draws the world once facing each way).
   */
  warmShadows(): void {
    const far = this.csm.lights[this.csm.lights.length - 1];
    if (this.farEveryOther && far) far.shadow.autoUpdate = true; // the boot's warm-up draws every cascade
    this.csm.update();
    if (this.texelBias) this.fitNormalBias();
    this.shadowFade?.warm();
  }

  update(dt = 0): void {
    // G223: what a layered backdrop moved last frame goes back before the level's own backdrop runs
    for (let i = this.layerUndo.length - 1; i >= 0; i--) this.layerUndo[i]?.();
    this.layerUndo.length = 0;
    const B = this.backdrop;
    if (B !== null && B.updateAt !== 'late') B.update(dt, this.camera); // before the CSM: the clock turns its light
    if (B !== null && B.fadesPlanet !== false) this.visual.fadePlanet(this.night);
    const want = this.keyShadowWant;
    if (want !== null && want.angleTo(this.csm.lightDirection) > KEY_SHADOW_STEP) this.csm.lightDirection.copy(want); // a big jump (a Time of day pick, the sun ↔ moon swap) moves at once
    this.csm.update();
    if (this.texelBias) this.fitNormalBias();
    this.shadowFade?.update(dt); // after the CSM and its bias: each ghost copies its cascade's square
    if (this.farEveryOther) {
      const far = this.csm.lights[this.csm.lights.length - 1];
      this.farTick = (this.farTick + 1) % 2;
      if (far) far.shadow.autoUpdate = this.farTick === 0;
    }
    this.cloudUniforms.uTime.value += dt; this.giantUniforms.uTime.value += dt;
    if (B?.updateAt === 'late') B.update(dt, this.camera); // a clock that steps its own shadow light: after the cascades
    this.dressing?.update?.(dt);
    if (this.layers.size > 0) this.applyLayers(dt);
    this.visual.updateSunHalo(this.camera);
  }

  /** G223: every layer over the level's own state, then the cascades again so the shadows follow the blended key light */
  private applyLayers(dt: number): void {
    for (const layer of this.layers) { const undo = layer.apply(dt, this.camera); if (undo !== null) this.layerUndo.push(undo); }
    if (this.layerUndo.length === 0) return;
    this.csm.update();
    if (this.texelBias) this.fitNormalBias();
  }

  // ── runtime setters (a level's day/night sky rig + weather; nothing calls them on a fixed-time level) ──

  /**
   * Move the key light (the sun, or the moon at night) and recolour it: the CSM direction + colour × intensity, the
   * fog's in-scatter direction, the cloud / planet lighting direction. `sunDir` is updated in place (Game.ts places
   * the sun disc along it every frame; a level's own materials read it from here).
   * The shadow direction moves in KEY_SHADOW_STEP steps, not every frame (E89, as a stepped clock does it: a sun sliding a
   * fraction of a texel per frame made every shadow edge crawl); the disc, the fog and the clouds stay continuous.
   */
  setKeyLight(dir: THREE.Vector3, color: THREE.Color, intensity: number): void {
    this.sunDir.copy(dir).normalize();
    this.sunColor.copy(color);
    this.keyShadowWant = (this.keyShadowWant ?? new THREE.Vector3()).copy(this.sunDir).negate(); // stepped in update(): the frame's last writer wins (the rig, then LightCheat)
    for (const l of this.csm.lights) { l.color.copy(color); l.intensity = intensity; }
    fogUniforms.fogSunDir.value.copy(this.sunDir);
    this.cloudUniforms.uSunDir.value.copy(this.sunDir);
    this.giantUniforms.uSunDir.value.copy(this.sunDir);
  }

  /** the cloud layer's colour toward the sun, and a multiplier over the whole layer (night, a storm's gloom); default white */
  setCloudLight(sunColor: THREE.Color, light: THREE.Color): void {
    this.cloudUniforms.uSunColor.value.copy(sunColor);
    this.cloudUniforms.uLight.value.copy(light);
  }

  /** a multiplier over the ringed giant's colour and its opacity (a storm deck hides it); default white, 1 */
  setPlanetLight(light: THREE.Color, opacity = 1): void {
    this.giantUniforms.uLight.value.copy(light);
    this.giantUniforms.uOpacity.value = opacity;
  }

  /**
   * Hold everything a day clock or a level's own light rig writes on this sky (SHARD-PLATFORM G223: a grid region's runtime
   * lights the page's one sky while it is entered, and must leave it as it found it). The returned function puts back:
   * the key light (`sunDir`, `sunColor`, each cascade light's colour and intensity, the shadow direction and where the
   * stepped shadow wants to go), the cascades' shadow map size (a changed map is freed and redrawn at the held size), the
   * hemisphere fill, the sun disc (shown, scale, colour) and its halo (scale, opacity), and the cloud and planet lighting.
   * The fog's in-scatter direction `setKeyLight` also writes is `fogUniforms` (the caller holds that set).
   */
  holdLight(): () => void {
    const csm = this.csm, cloud = this.cloudUniforms, giant = this.giantUniforms, hemi = this.hemi;
    const sunDir = this.sunDir.clone(), sunColor = this.sunColor.clone(), want = this.keyShadowWant?.clone() ?? null;
    const lightDirection = csm.lightDirection.clone(), mapSize = csm.shadowMapSize;
    const lights = csm.lights.map((l) => ({ l, color: l.color.clone(), intensity: l.intensity, size: l.shadow.mapSize.clone() }));
    const fill = { sky: hemi.color.clone(), ground: hemi.groundColor.clone(), intensity: hemi.intensity };
    const disc = this.sunDisc, discMaterial = disc.material instanceof THREE.MeshBasicMaterial ? disc.material : null;
    const shown = disc.visible, discScale = disc.scale.clone(), discColor = discMaterial?.color.clone() ?? null;
    const halo = this.visual.sunHalo, haloScale = halo?.scale.clone() ?? null, haloOpacity = halo?.material.opacity ?? 1;
    const clouds = { dir: cloud.uSunDir.value.clone(), sun: cloud.uSunColor.value.clone(), light: cloud.uLight.value.clone() };
    const planet = { dir: giant.uSunDir.value.clone(), light: giant.uLight.value.clone(), opacity: giant.uOpacity.value };
    return () => {
      this.sunDir.copy(sunDir); this.sunColor.copy(sunColor);
      this.keyShadowWant = want === null ? null : (this.keyShadowWant ?? new THREE.Vector3()).copy(want);
      csm.lightDirection.copy(lightDirection); csm.shadowMapSize = mapSize;
      for (const { l, color, intensity, size } of lights) {
        l.color.copy(color); l.intensity = intensity;
        if (!l.shadow.mapSize.equals(size)) { l.shadow.mapSize.copy(size); l.shadow.map?.dispose(); l.shadow.map = null; }
      }
      hemi.color.copy(fill.sky); hemi.groundColor.copy(fill.ground); hemi.intensity = fill.intensity;
      disc.visible = shown; disc.scale.copy(discScale);
      if (discMaterial !== null && discColor !== null) discMaterial.color.copy(discColor);
      if (halo !== null && haloScale !== null) { halo.scale.copy(haloScale); halo.material.opacity = haloOpacity; }
      cloud.uSunDir.value.copy(clouds.dir); cloud.uSunColor.value.copy(clouds.sun); cloud.uLight.value.copy(clouds.light);
      giant.uSunDir.value.copy(planet.dir); giant.uLight.value.copy(planet.light); giant.uOpacity.value = planet.opacity;
    };
  }


}
