/**
 * One frame for the grid (SHARD-PLATFORM SF19a, re-aimed by G158; on for everyone since Jake's G175 pick, E450): inside
 * EXPERIMENTAL Wildshard the shard you stand in owns the whole frame, and on the road the neutral road look does (`frameModel.ts`). There is no per-pixel region and no shard-id
 * buffer: one look per frame, blended across 16 m at the cell edge.
 *
 * - **One clock, one sky, one sun**: the home look's backdrop is the world clock and draws the one dome and key light;
 *   the engine chain's tone mapping, bloom and vignette stay on.
 * - **The owner's air on everything**: before the scene draws, the scene fog's colour is the owner's air (the home
 *   look's live fog, a neighbour owner's declared haze, the neutral road air, by the owners' weights), and every far
 *   proxy hazes toward that one air, neighbours included (G158: the owner's fog applies to everything on screen).
 * - **The owner's grade on every pixel**: the home look's grade effects (saturation, contrast, split tone, the learned
 *   LUT) fade with the home's weight (their blend opacity), and one small effect appended to the engine's one colour
 *   pass applies the rest of the frame's grade (a neighbour owner's declared exposure / saturation / contrast / tint,
 *   the road's G75 grey-blue) uniformly. No extra pass, no extra target.
 * - **The road's sky** (G165, Jake: "A, road light over everything"): on the road the home look's sky gives way to the
 *   road's own calm grey-blue dome (`roadSky.ts`, the road owner's first stack), so neighbours and sky alike sit under the
 *   road look; a shard's own sky shows only once you are inside its cell (blended across the edge band).
 * - **Live regions** (`frameLook.ts`, E452): an admitted neighbour runtime contributes its own fog object and grade while
 *   resident; what its weather writes into that fog is its air (then the base goes back), its level's grade replaces the
 *   declared one. Still one fog, one dome, one sun.
 * - **A region's whole grade chain** (G232): on a neutral page shell (G226's owned home) the page's own grade effects carry
 *   the live owner region's grade instead of fading to nothing: inside its cell they hold its level's saturation,
 *   brightness, contrast and split tone (its runtime and its sky clock then drive them as standalone), and two effects
 *   compiled once at install, right after the page's split tone, add its look layer's S-curve and vibrance and its learned
 *   LUT (a neutral LUT until a region brings one; a LUT swap is a uniform, never a recompile). All of it fades with the
 *   owner's weight across the edge band, and the page's values go back when the region leaves the frame.
 * - **A cinematic region's shafts, fringe and grain** (SF63 follow-up): the shell runs the clean chain, so the three
 *   effects only the cinematic chain has are compiled into its colour pass at install, neutral (`regionCinematic.ts`); a
 *   carried region on the cinematic chain turns them on by its weight, its clock drives the shafts, and the march's target
 *   is allocated only while it carries them.
 * - **Owner stacks** (`FrameStack`): each owner may hang a stack on the frame that is told its weight every frame. The
 *   home's grade fade is the first; SF59's per-shard post stacks (catalogue effects as data) hang here the same way.
 * Select a shard never builds this (grid page mode only).
 */
import { Color, Data3DTexture, NoColorSpace, SRGBColorSpace, Uniform, UnsignedByteType, Vector3, WebGLRenderTarget, type Camera, type Scene, type Texture } from 'three';
import { BlendFunction, Effect, EffectAttribute, EffectPass, LookupTexture, LUT3DEffect, type EffectComposer } from 'postprocessing';
import type { Scope } from '@wildshard/engine/app/scope';
import { GradeLookEffect, type GradeEffect } from '@wildshard/engine/core/Grade';
import { LUT_SIZE } from '@wildshard/engine/render/lut';
import type { FarProxyView } from './farView';
import { RoadSky } from './roadSky';
import { bindFrameLook, type FrameLookContribution, type FramePost, type FrameSkyLayer, type RegionChain, type RegionPost } from './frameLook';
import { NEUTRAL_GRADE, dominantOwner, frameFog, frameGrade, frameOwners, type FrameCell, type FullGrade, type RegionGrade, type RegionWeights } from './frameModel';

/** What the frame reads from the page: the scene and camera, the engine's composer and its grade effects (late-bound). */
export interface GridFrameHost {
  readonly scene: Scene;
  readonly camera: Camera;
  /** the engine's composer (throws before it is built: the frame then retries next frame) */
  readonly composer: () => EffectComposer;
  /** the engine chain's grade effects (null for a level whose look builds its own chain) */
  readonly post: () => FramePostEffects | null;
  /** the one sun's direction (a carried cinematic region's shafts start from it; absent: they wait for its clock) */
  readonly sunDir?: () => Vector3;
  /** a cinematic chain's shafts, fringe and grain for the shell's colour pass (the engine's `RegionCinematic`; absent: none) */
  readonly cinematic?: () => FrameCinematic;
  /** the page's scene pass draws into the depth slices (E142): its scene target's depth is the world's */
  readonly slices?: () => boolean;
}
/** The engine chain's grade effects the frame fades, and on a neutral shell writes a region's grade into (G232). */
export interface FramePostEffects {
  readonly grade: Effect & Pick<GradeEffect, 'set' | 'hold'>;
  readonly saturation: Effect & { saturation: number };
  readonly contrast: Effect & { brightness: number; contrast: number };
  /** SF63: the chain's bloom, vignette and god rays (null: the chain has none), whose knobs a carried region's chain sets */
  readonly bloom?: Effect & { intensity: number; readonly luminanceMaterial: { threshold: number; smoothing: number } };
  readonly vignette?: Effect & { darkness: number };
  readonly rays?: Effect | null;
}

/** The carried shafts, fringe and grain (the engine's `RegionCinematic`, `regionCinematic.ts`), as the frame drives them. */
export interface FrameCinematic {
  readonly place: (effects: Effect[], grainAfter: Effect, hasConvolution: boolean) => () => void;
  readonly depthFrom: (source: { readonly pass: Texture | null; readonly scene: WebGLRenderTarget | null }) => void;
  readonly warm: () => void;
  readonly port: (instance: string) => NonNullable<FramePost['vol']>;
  readonly forget: (instance: string) => void;
  readonly take: (instance: string, start: { readonly strength: number; readonly sunColor: readonly [number, number, number]; readonly sunDir?: Vector3 | undefined; readonly fog?: Color | undefined }) => void;
  readonly weight: (w: number) => void;
  readonly release: () => void;
  readonly state: () => FrameCinematicState;
  readonly dispose: () => void;
}
/** Its readout: carrier, weight, shafts' opacity and strength, fringe offset, grain opacity, march target, depth source. */
export interface FrameCinematicState {
  readonly carrier: string | null; readonly weight: number; readonly vol: readonly [number, number]; readonly chroma: number; readonly grain: number;
  readonly target: readonly [number, number] | null; readonly depth: 'pass' | 'scene' | 'none'; readonly sceneDepth: boolean;
}

/** The frame's readout (tests, the harness, the board). */
export interface GridFrameState {
  readonly installed: boolean;
  /** how many of the home look's grade effects fade with its weight */
  readonly faded: number;
  /** the owner holding most of the frame (null: the road look) */
  readonly owner: string | null;
  readonly highway: number;
  readonly weights: Readonly<Record<string, number>>;
  readonly air: readonly [number, number, number];
  /** the frame's own grade on top of the home's: exposure, saturation, contrast, then the tint */
  readonly grade: readonly [number, number, number, number, number, number];
  /** the road sky's drawn opacity (G165: 1 on the road, 0 inside a cell) */
  readonly roadSky: number;
  /** G223: the regions' own skies laid over the one sky (instance → its readout); empty with the Debug row on A */
  readonly skies: Readonly<Record<string, ReturnType<FrameSkyLayer['state']>>>;
  /**
   * G232: the region whose whole grade chain the page's grade carries (null: none), its weight, whether its LUT is drawn,
   * and the page's grade values as drawn: saturation, brightness, contrast, curve, vibrance
   */
  readonly chain: { readonly owner: string | null; readonly weight: number; readonly lut: boolean; readonly values: readonly [number, number, number, number, number];
    /** SF63: the page chain's knobs as drawn: bloom intensity, threshold, smoothing, vignette darkness, god rays' opacity (−1: none) */
    readonly post: readonly [number, number, number, number, number];
    /** SF63 follow-up: a cinematic region's shafts, fringe and grain in the page's colour pass (null: not installed) */
    readonly fx: FrameCinematicState | null };
}

/**
 * Something an owner hangs on the frame (SF59's post stack is one): told the owner's weight (0..1) once per frame, before
 * the scene draws. A stack at weight 0 must cost nothing visible.
 */
export interface FrameStack { readonly weight: (w: number) => void; readonly dispose?: () => void }

/** The frame's grade, one small effect at the end of the colour pass: exposure, saturation, contrast, tint, uniform. */
export class FrameGradeEffect extends Effect {
  /** x exposure (stops), y saturation, z contrast */
  readonly grade: Vector3;
  /** linear RGB multiplier (white = none) */
  readonly tint: Vector3;
  constructor() {
    const grade = new Vector3(NEUTRAL_GRADE.exposure, NEUTRAL_GRADE.saturation, NEUTRAL_GRADE.contrast), tint = new Vector3(1, 1, 1);
    super('GridFrameGrade', /* glsl */`
      uniform vec3 uGrade;
      uniform vec3 uTint;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * exp2(uGrade.x);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = max(mix(vec3(l), c, uGrade.y), 0.0);
        c = max((c - 0.214) * uGrade.z + 0.214, 0.0); // pivot: mid grey in linear light
        outputColor = vec4(c * uTint, inputColor.a);
      }`, { blendFunction: BlendFunction.SRC, uniforms: new Map<string, Uniform>([['uGrade', new Uniform(grade)], ['uTint', new Uniform(tint)]]) });
    this.grade = grade; this.tint = tint;
  }
  /** Set the grade. */
  set(grade: RegionGrade): void {
    this.grade.set(grade.exposure, grade.saturation, grade.contrast);
    const tint = grade.tint ?? [1, 1, 1]; this.tint.set(tint[0], tint[1], tint[2]);
  }
}

/**
 * Fade effects with a weight through their blend opacity (the home look's grade under the frame). An opacity someone
 * else wrote since the last frame becomes the new full value; dispose puts every full value back.
 */
export function opacityFade(effects: readonly Effect[]): FrameStack & { readonly dispose: () => void } {
  const read = (u: Uniform): number => { const v: unknown = u.value; return typeof v === 'number' ? v : 1; };
  const entries = effects.map((effect) => ({ opacity: effect.blendMode.opacity, full: read(effect.blendMode.opacity), written: Number.NaN }));
  return {
    weight: (w) => {
      for (const e of entries) {
        const now = read(e.opacity);
        if (now !== e.written) e.full = now;
        e.written = e.full * w; e.opacity.value = e.written;
      }
    },
    dispose: () => { for (const e of entries) e.opacity.value = e.full; },
  };
}

/** A 33³ RGBA8 identity LUT, the texture type every learned LUT has (`world/lut.ts`), so a swap never changes the defines. */
export function neutralLut(): LookupTexture {
  const n = LUT_SIZE, data = new Uint8Array(n * n * n * 4);
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
    const i = ((b * n + g) * n + r) * 4;
    data[i] = Math.round((r / (n - 1)) * 255); data[i + 1] = Math.round((g / (n - 1)) * 255); data[i + 2] = Math.round((b / (n - 1)) * 255); data[i + 3] = 255;
  }
  const lut = new LookupTexture(data, n);
  lut.type = UnsignedByteType; lut.colorSpace = NoColorSpace; lut.name = 'grid-frame-neutral-lut'; lut.needsUpdate = true;
  return lut;
}
/** A LUT the frame's compiled LUT effect can sample by a uniform swap: the same size, type and domain as the neutral one. */
export function swappableLut(lut: Texture): boolean {
  if (!(lut instanceof Data3DTexture) || lut.type !== UnsignedByteType) return false;
  const { width, height, depth } = lut.image;
  if (width !== LUT_SIZE || height !== LUT_SIZE || depth !== LUT_SIZE) return false;
  return !(lut instanceof LookupTexture) || (lut.domainMin.x === 0 && lut.domainMin.y === 0 && lut.domainMin.z === 0 && lut.domainMax.x === 1 && lut.domainMax.y === 1 && lut.domainMax.z === 1);
}

/** Every entry an Effect: the narrowing keeps the array itself, never a copy. */
function isEffectList(list: unknown): list is Effect[] {
  return Array.isArray(list) && list.every((e) => e instanceof Effect);
}

/**
 * The effects of an EffectPass (its list is private in the typings; read at run time and checked). It is the pass's own
 * live array, so an effect pushed into it is drawn on the next recompile (a filtered copy dropped the frame grade).
 */
export function passEffects(pass: EffectPass): Effect[] | null {
  const found: unknown = Reflect.get(pass, 'effects');
  return isEffectList(found) ? found : null;
}

/**
 * SF63: a carried region's engine chain knobs on the page's same effects: bloom's intensity, threshold and smoothing, the
 * vignette's darkness and the god rays' opacity, each moved from the page's value toward the region's by the owner weight
 * every frame (all uniforms: nothing compiles). The region's clock may drive the rays' opacity itself (`FramePost.rays`):
 * a value written since the last frame is the region's own and is kept. `restore` puts the page's values back. Null when
 * the region carries no knobs (a 'replace' look).
 */
export function chainKnobs(post: FramePostEffects, knobs: RegionPost | undefined): { readonly weight: (w: number) => void; readonly restore: () => void } | null {
  if (knobs === undefined) return null;
  const bloom = post.bloom, vignette = post.vignette, rays = post.rays ?? null;
  const read = (u: Uniform): number => { const v: unknown = u.value; return typeof v === 'number' ? v : 1; };
  const page = { intensity: bloom?.intensity ?? 0, threshold: bloom?.luminanceMaterial.threshold ?? 0, smoothing: bloom?.luminanceMaterial.smoothing ?? 0,
    darkness: vignette?.darkness ?? 0, rays: rays === null ? 0 : read(rays.blendMode.opacity) };
  // the rays' full value: the region's chain's own, or what its clock wrote since the last frame
  let raysOwn = knobs.rays, raysWritten = Number.NaN;
  const mix = (a: number, b: number, w: number): number => a + (b - a) * w;
  return {
    weight: (w) => {
      if (bloom !== undefined) {
        bloom.intensity = mix(page.intensity, knobs.bloomIntensity, w);
        bloom.luminanceMaterial.threshold = mix(page.threshold, knobs.bloomThreshold, w);
        bloom.luminanceMaterial.smoothing = mix(page.smoothing, knobs.bloomSmoothing, w);
      }
      if (vignette !== undefined) vignette.darkness = mix(page.darkness, knobs.vignette, w);
      if (rays !== null) {
        const now = read(rays.blendMode.opacity);
        if (!Number.isNaN(raysWritten) && now !== raysWritten) raysOwn = now;
        raysWritten = mix(page.rays, raysOwn, w); rays.blendMode.opacity.value = raysWritten;
      }
    },
    restore: () => {
      if (bloom !== undefined) { bloom.intensity = page.intensity; bloom.luminanceMaterial.threshold = page.threshold; bloom.luminanceMaterial.smoothing = page.smoothing; }
      if (vignette !== undefined) vignette.darkness = page.darkness;
      if (rays !== null) rays.blendMode.opacity.value = page.rays;
    },
  };
}

/** The live one frame. Built by the grid session for every host with a frame (G175); disposed with the level scope. */
export class GridFrame {
  private readonly host: GridFrameHost;
  private readonly cells: readonly FrameCell[];
  private readonly homeInstance: string | null;
  private readonly half: number;
  private readonly band: number | undefined;
  private readonly feet: () => { readonly x: number; readonly z: number };
  private readonly hazes = new Map<string, readonly [number, number, number]>();
  private readonly grades = new Map<string, RegionGrade>();
  /** live regions' contributions (instance → its look), and the airs the owners bring this frame */
  private readonly live = new Map<string, FrameLookContribution>();
  private readonly owned = new Map<string, RegionGrade>();
  private readonly airs = new Map<string, readonly [number, number, number]>();
  private readonly proxies = new Set<FarProxyView>();
  /** G223: live regions' own skies (instance → its layer) */
  private readonly skies = new Map<string, FrameSkyLayer>();
  /** owner (an instance, or null for the road) → its stacks */
  private readonly stacks = new Map<string | null, Set<FrameStack>>();
  private readonly effect = new FrameGradeEffect();
  /** G232: a carried region's look layer and learned LUT, after the page's split tone (shell pages only) */
  private readonly lookEffect = new GradeLookEffect();
  private readonly neutral = neutralLut();
  private readonly lutEffect = new LUT3DEffect(this.neutral, { inputColorSpace: SRGBColorSpace, tetrahedralInterpolation: true });
  /** the page's grade effects (set at install on a shell page: chains are carried) and their fade by the carried weight */
  private chainPost: FramePostEffects | null = null;
  private chainFade: FrameStack | null = null;
  private carrier: { readonly instance: string; readonly chain: RegionChain; readonly restore: () => void; readonly knobs: ((w: number) => void) | null } | null = null;
  private chainWeight = 0;
  private chainLut = false;
  /** SF63 follow-up: a cinematic region's shafts, fringe and grain, compiled into the shell's colour pass at install */
  private cine: FrameCinematic | null = null;
  private readonly roadSky = new RoadSky();
  private readonly restore: (() => void)[] = [];
  private faded = 0;
  private installed = false;
  private weights: RegionWeights = { cells: new Map(), highway: 0 };
  private graded: FullGrade = { ...NEUTRAL_GRADE, tint: [1, 1, 1] };
  private readonly air = new Color();
  private readonly homeFog = new Color();
  private readonly written = new Color(Number.NaN, Number.NaN, Number.NaN);
  private readonly eye = new Vector3();

  constructor(options: { host: GridFrameHost; scope: Scope; cells: readonly FrameCell[]; home: FrameCell; homeIsFrame?: boolean; half: number; band?: number; feet: () => { readonly x: number; readonly z: number } }) {
    const { host, scope, home } = options;
    this.host = host; this.cells = options.cells; this.homeInstance = options.homeIsFrame === false ? null : home.instance; this.half = options.half; this.band = options.band; this.feet = options.feet;
    this.weights = { cells: new Map([[home.instance, 1]]), highway: 0 };
    // the scene fog is the owner's air while the scene draws (the backdrop has written its own by then)
    const prev = host.scene.onBeforeRender.bind(host.scene);
    host.scene.onBeforeRender = (...args) => { this.beforeScene(); prev(...args); };
    // G165: the road's own sky, its opacity the road's weight
    const detachSky = this.roadSky.attach(host.scene);
    this.stack(null, { weight: (w) => { this.roadSky.weight(w); } });
    this.lookEffect.blendMode.opacity.value = 0; this.lutEffect.blendMode.opacity.value = 0;
    const unbind = bindFrameLook(host.scene, { contribute: (instance, look) => this.contribute(instance, look), sky: (instance, layer) => this.sky(instance, layer),
      post: (instance?: string): FramePost | null => (this.chainPost === null ? null : { hueSat: this.chainPost.saturation, rays: this.chainPost.rays ?? null,
        vol: instance === undefined || this.cine === null ? null : this.cine.port(instance) }) });
    scope.onDispose(() => {
      unbind(); this.live.clear(); this.skies.clear();
      host.scene.onBeforeRender = prev; this.uninstall(); this.effect.dispose(); this.lookEffect.dispose(); this.lutEffect.dispose(); this.neutral.dispose();
      this.cine?.dispose(); this.cine = null;
      detachSky(); this.roadSky.dispose();
      for (const set of this.stacks.values()) for (const stack of set) stack.dispose?.();
      this.stacks.clear();
    });
  }

  /** A neighbour's declared look (its haze and grade), as its far proxy arrives (or before): what it brings as owner. */
  declare(instance: string, look: { readonly haze: { readonly colour: readonly [number, number, number] }; readonly grade?: RegionGrade | undefined }): void {
    if (instance === this.homeInstance) return;
    this.hazes.set(instance, look.haze.colour);
    this.grades.set(instance, look.grade ?? NEUTRAL_GRADE);
  }

  /**
   * A live region's look as its cell's owner (`frameLook.ts`): its fog object's colour as written each frame is the
   * owner's air, its grade replaces the declared one. Returns the release (the declared look applies again).
   */
  contribute(instance: string, look: FrameLookContribution): () => void {
    if (instance === this.homeInstance) throw new Error('The home look is the frame itself; only a neighbour region contributes');
    if (this.live.has(instance)) throw new Error(`Grid frame already has a live look for ${instance}`);
    this.live.set(instance, look);
    const declared = this.hazes.get(instance);
    if (declared !== undefined) look.fog?.color.setRGB(...declared); // start from the base (else its own colour until the first draw)
    return () => {
      if (this.live.get(instance) !== look) return;
      this.live.delete(instance);
      if (this.carrier?.instance === instance) this.drop(); // at once: its LUT may be freed right after
      this.cine?.forget(instance);
    };
  }

  /**
   * A live region's own sky (`regionSky.ts`, G223): told its cell's owner weight each frame (1 inside, blended across the
   * edge band, 0 on the road). Returns the release.
   */
  sky(instance: string, layer: FrameSkyLayer): () => void {
    if (instance === this.homeInstance) throw new Error('The home look owns the one sky; only a neighbour region lays its own over it');
    if (this.skies.has(instance)) throw new Error(`Grid frame already has a sky for ${instance}`);
    this.skies.set(instance, layer);
    const unstack = this.stack(instance, { weight: (w) => { layer.weight(w); } });
    return () => { if (this.skies.get(instance) === layer) this.skies.delete(instance); unstack(); layer.weight(0); };
  }

  /** A drawn far proxy: its haze follows the owner's air. Returns the release. */
  proxy(view: FarProxyView): () => void {
    this.proxies.add(view);
    return () => { this.proxies.delete(view); };
  }

  /** Hang a stack on an owner (an instance, or null for the road look); it is told that owner's weight each frame. */
  stack(owner: string | null, stack: FrameStack): () => void {
    let set = this.stacks.get(owner);
    if (set === undefined) { set = new Set(); this.stacks.set(owner, set); }
    set.add(stack);
    return () => { if (this.stacks.get(owner)?.delete(stack) === true) stack.dispose?.(); };
  }

  /** Once per frame (the page's late phase): the owners from the player's feet, then the install once the composer exists. */
  frame(): void {
    const at = this.feet();
    this.weights = frameOwners(this.cells, at.x, at.z, this.half, this.band);
    if (this.chainPost !== null) this.carry();
    this.graded = frameGrade(this.weights, this.homeInstance, this.ownerGrades());
    this.effect.set(this.graded);
    for (const [owner, set] of this.stacks) {
      const w = owner === null ? this.weights.highway : this.weights.cells.get(owner) ?? 0;
      for (const stack of set) stack.weight(w);
    }
    if (!this.installed) this.install();
  }

  private install(): void {
    let composer: EffectComposer;
    try { composer = this.host.composer(); } catch { return; } // not built yet: next frame
    this.installed = true;
    const post = this.host.post();
    if (post === null) return; // a level that builds its own chain: the air still follows the owner, the grade stays the home's
    for (const pass of composer.passes) {
      if (!(pass instanceof EffectPass)) continue;
      const effects = passEffects(pass);
      if (effects === null || !effects.includes(post.saturation)) continue;
      const home = effects.filter((effect) => effect === post.saturation || effect === post.contrast || effect === post.grade || effect instanceof LUT3DEffect);
      this.faded = home.length;
      let unstack: () => void;
      if (this.homeInstance === null) {
        // neutral shell: every cell supplies its own grade. Its grade effects carry a live owner region's (G232), by its
        // weight; the shell's own LUT stays out; the region's look layer and LUT go right after the split tone
        const own: Effect[] = [post.saturation, post.contrast, post.grade];
        const carried = opacityFade(home.filter((effect) => own.includes(effect))), rest = opacityFade(home.filter((effect) => !own.includes(effect)));
        carried.weight(0); rest.weight(0);
        this.chainFade = carried; this.chainPost = post;
        const at = Math.max(...own.map((effect) => effects.indexOf(effect))) + 1;
        effects.splice(at, 0, this.lookEffect, this.lutEffect);
        // SF63 follow-up: a cinematic region's shafts, fringe and grain, neutral until one carries them
        const unplace = this.placeCinematic(composer, pass, effects);
        unstack = () => {
          this.drop(); this.chainPost = null; this.chainFade = null; carried.dispose(); rest.dispose();
          for (const effect of [this.lookEffect, this.lutEffect]) { const i = effects.indexOf(effect); if (i !== -1) effects.splice(i, 1); }
          unplace();
        };
      } else {
        const fade = opacityFade(home);
        unstack = this.stack(this.homeInstance, fade);
      }
      effects.push(this.effect);
      this.restore.push(() => { unstack(); const i = effects.indexOf(this.effect); if (i !== -1) effects.splice(i, 1); pass.recompile(); });
      pass.recompile();
      return;
    }
  }

  /**
   * The cinematic chain's shafts, fringe and grain in the shell's colour pass (`regionCinematic.ts`): placed now, compiled by
   * the install's one recompile, the march's program warmed. Returns the removal.
   */
  private placeCinematic(composer: EffectComposer, pass: EffectPass, effects: Effect[]): () => void {
    const cine = this.host.cinematic?.();
    if (cine === undefined) return () => undefined;
    const convolution = effects.some((effect) => (effect.getAttributes() & EffectAttribute.CONVOLUTION) !== 0);
    const unplace = cine.place(effects, this.lutEffect, convolution);
    const scene: unknown = this.host.slices?.() === true ? composer.inputBuffer : null;
    cine.depthFrom({ pass: pass.getDepthTexture(), scene: scene instanceof WebGLRenderTarget ? scene : null });
    cine.warm();
    this.cine = cine;
    return () => { unplace(); cine.release(); };
  }

  /** the owners' grades: a live region's own over its declared one; neutral for one whose whole chain is carried */
  private ownerGrades(): ReadonlyMap<string, RegionGrade> {
    if (this.live.size === 0) return this.grades;
    this.owned.clear();
    for (const [instance, grade] of this.grades) this.owned.set(instance, grade);
    for (const [instance, look] of this.live) {
      if (this.chainPost !== null && look.chain !== undefined) this.owned.set(instance, NEUTRAL_GRADE);
      else if (look.grade !== undefined) this.owned.set(instance, look.grade);
    }
    return this.owned;
  }

  /** G232: the live region with the most weight that brings a chain carries the page's grade, faded by its weight. */
  private carry(): void {
    let best: string | null = null, top = 0, chain: RegionChain | null = null;
    for (const [instance, look] of this.live) {
      const w = look.chain === undefined ? 0 : this.weights.cells.get(instance) ?? 0;
      if (w > top && look.chain !== undefined) { best = instance; top = w; chain = look.chain; }
    }
    if (this.carrier !== null && this.carrier.instance !== best) this.drop();
    if (best !== null && chain !== null && this.carrier === null) this.take(best, chain);
    this.chainWeight = top;
    this.chainFade?.weight(top);
    this.carrier?.knobs?.(top);
    this.cine?.weight(top);
    this.lookEffect.blendMode.opacity.value = top;
    const lut = this.carrier?.chain.lut() ?? null, drawn = lut !== null && swappableLut(lut);
    this.lutUniform(drawn ? lut : this.neutral);
    this.lutEffect.blendMode.opacity.value = drawn ? top : 0;
    this.chainLut = drawn;
  }

  /** the compiled LUT effect samples another LUT of the same kind: a uniform, so the pass never recompiles */
  private lutUniform(lut: Texture): void {
    const u = this.lutEffect.uniforms.get('lut');
    if (u !== undefined && u.value !== lut) u.value = lut;
  }

  /** a region takes the page's grade: the page's values are held, its level's chain written (its clocks drive them on) */
  private take(instance: string, chain: RegionChain): void {
    const post = this.chainPost;
    if (post === null) return;
    const saturation = post.saturation.saturation, brightness = post.contrast.brightness, contrast = post.contrast.contrast, undoGrade = post.grade.hold();
    const g = chain.grade, rgb = (c: readonly [number, number, number]): [number, number, number] => [c[0], c[1], c[2]];
    post.saturation.saturation = g.saturation; post.contrast.brightness = g.brightness; post.contrast.contrast = g.contrast;
    post.grade.set({ shadowTint: rgb(g.shadowTint), highTint: rgb(g.highTint), lift: rgb(g.lift), gain: rgb(g.gain), gamma: g.gamma });
    this.lookEffect.set(chain.look);
    const knobs = chainKnobs(post, chain.post);
    // SF63 follow-up: a cinematic chain's shafts, fringe and grain, its clock driving the shafts
    const volumetric = chain.post?.volumetric;
    if (volumetric !== undefined) this.cine?.take(instance, { strength: volumetric.strength, sunColor: volumetric.sunColor, sunDir: this.host.sunDir?.(), fog: this.live.get(instance)?.fog?.color });
    this.carrier = { instance, chain, knobs: knobs?.weight ?? null, restore: () => {
      knobs?.restore();
      post.saturation.saturation = saturation; post.contrast.brightness = brightness; post.contrast.contrast = contrast; undoGrade();
    } };
  }

  /** the carrying region leaves the frame: the page's grade values back, its look layer and LUT neutral and off */
  private drop(): void {
    const carrier = this.carrier;
    if (carrier === null) return;
    this.carrier = null;
    carrier.restore();
    this.cine?.release();
    this.lookEffect.set({ curve: 0, vibrance: 0 }); this.lookEffect.blendMode.opacity.value = 0;
    this.lutUniform(this.neutral); this.lutEffect.blendMode.opacity.value = 0;
    this.chainFade?.weight(0); this.chainWeight = 0; this.chainLut = false;
  }

  private uninstall(): void { for (const undo of this.restore.splice(0).reverse()) undo(); this.faded = 0; }

  /** Before the scene draws: the scene fog becomes the owner's air, every far proxy hazes toward it. */
  private beforeScene(): void {
    const live = this.host.scene.fog?.color ?? null;
    // the backdrop rewrites the fog each frame; if it did not, keep the home value it wrote last
    if (live !== null && !live.equals(this.written)) this.homeFog.copy(live);
    const home = { instance: this.homeInstance, fog: [this.homeFog.r, this.homeFog.g, this.homeFog.b] as const };
    let hazes: ReadonlyMap<string, readonly [number, number, number]> = this.hazes;
    if (this.live.size > 0) {
      // a live region's air is what its runtime wrote into its own fog this frame; the base goes back for the next frame
      this.airs.clear();
      for (const [instance, colour] of this.hazes) this.airs.set(instance, colour);
      for (const [instance, look] of this.live) {
        const fog = look.fog;
        if (fog === undefined || fog === null) continue;
        this.airs.set(instance, [fog.color.r, fog.color.g, fog.color.b]);
        fog.color.setRGB(...(this.hazes.get(instance) ?? home.fog));
      }
      hazes = this.airs;
    }
    const [r, g, b] = frameFog(this.weights, home, hazes);
    this.air.setRGB(r, g, b);
    if (live !== null) { live.copy(this.air); this.written.copy(this.air); }
    for (const view of this.proxies) view.hazeColour(this.air);
    this.roadSky.frame(this.host.camera.getWorldPosition(this.eye), this.air);
  }

  /** the page's grade values as drawn (saturation, brightness, contrast, curve, vibrance; zeros before install) */
  private chainValues(): readonly [number, number, number, number, number] {
    const post = this.chainPost, look = this.lookEffect.values, r = (n: number): number => Math.round(n * 1e4) / 1e4;
    return post === null ? [0, 0, 0, 0, 0] : [r(post.saturation.saturation), r(post.contrast.brightness), r(post.contrast.contrast), r(look.curve), r(look.vibrance)];
  }

  /** the page chain's knobs as drawn (bloom intensity, threshold, smoothing, vignette, rays; −1 where the chain has none) */
  private postValues(): readonly [number, number, number, number, number] {
    const post = this.chainPost, r = (n: number | undefined): number => (n === undefined ? -1 : Math.round(n * 1e4) / 1e4);
    const rays: unknown = post?.rays?.blendMode.opacity.value;
    return [r(post?.bloom?.intensity), r(post?.bloom?.luminanceMaterial.threshold), r(post?.bloom?.luminanceMaterial.smoothing), r(post?.vignette?.darkness), r(typeof rays === 'number' ? rays : undefined)];
  }

  /** The readout. */
  state(): GridFrameState {
    const round = (n: number): number => Math.round(n * 1000) / 1000, g = this.graded;
    return {
      installed: this.installed, faded: this.faded, owner: dominantOwner(this.weights), highway: round(this.weights.highway),
      weights: Object.fromEntries([...this.weights.cells].map(([k, w]) => [k, round(w)])),
      air: [round(this.air.r), round(this.air.g), round(this.air.b)],
      grade: [round(g.exposure), round(g.saturation), round(g.contrast), round(g.tint[0]), round(g.tint[1]), round(g.tint[2])],
      roadSky: round(this.roadSky.drawn),
      skies: Object.fromEntries([...this.skies].map(([k, layer]) => [k, layer.state()])),
      chain: { owner: this.carrier?.instance ?? null, weight: round(this.chainWeight), lut: this.chainLut, values: this.chainValues(), post: this.postValues(), fx: this.cine?.state() ?? null },
    };
  }
}
