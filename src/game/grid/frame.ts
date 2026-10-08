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
 * - **Owner stacks** (`FrameStack`): each owner may hang a stack on the frame that is told its weight every frame. The
 *   home's grade fade is the first; SF59's per-shard post stacks (catalogue effects as data) hang here the same way.
 * Select a shard never builds this (grid page mode only).
 */
import { Color, Uniform, Vector3, type Camera, type Scene } from 'three';
import { BlendFunction, Effect, EffectPass, LUT3DEffect, type EffectComposer } from 'postprocessing';
import type { Scope } from '@wildshard/engine/app/scope';
import type { FarProxyView } from './farView';
import { RoadSky } from './roadSky';
import { bindFrameLook, type FrameLookContribution } from './frameLook';
import { NEUTRAL_GRADE, dominantOwner, frameFog, frameGrade, frameOwners, type FrameCell, type FullGrade, type RegionGrade, type RegionWeights } from './frameModel';

/** What the frame reads from the page: the scene and camera, the engine's composer and its grade effects (late-bound). */
export interface GridFrameHost {
  readonly scene: Scene;
  readonly camera: Camera;
  /** the engine's composer (throws before it is built: the frame then retries next frame) */
  readonly composer: () => EffectComposer;
  /** the engine chain's grade effects (null for a level whose look builds its own chain) */
  readonly post: () => { readonly grade: Effect; readonly saturation: Effect; readonly contrast: Effect } | null;
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

/** The live one frame. Built by the grid session for every host with a frame (G175); disposed with the level scope. */
export class GridFrame {
  private readonly host: GridFrameHost;
  private readonly cells: readonly FrameCell[];
  private readonly homeInstance: string;
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
  /** owner (an instance, or null for the road) → its stacks */
  private readonly stacks = new Map<string | null, Set<FrameStack>>();
  private readonly effect = new FrameGradeEffect();
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

  constructor(options: { host: GridFrameHost; scope: Scope; cells: readonly FrameCell[]; home: FrameCell; half: number; band?: number; feet: () => { readonly x: number; readonly z: number } }) {
    const { host, scope, home } = options;
    this.host = host; this.cells = options.cells; this.homeInstance = home.instance; this.half = options.half; this.band = options.band; this.feet = options.feet;
    this.weights = { cells: new Map([[home.instance, 1]]), highway: 0 };
    // the scene fog is the owner's air while the scene draws (the backdrop has written its own by then)
    const prev = host.scene.onBeforeRender.bind(host.scene);
    host.scene.onBeforeRender = (...args) => { this.beforeScene(); prev(...args); };
    // G165: the road's own sky, its opacity the road's weight
    const detachSky = this.roadSky.attach(host.scene);
    this.stack(null, { weight: (w) => { this.roadSky.weight(w); } });
    const unbind = bindFrameLook(host.scene, { contribute: (instance, look) => this.contribute(instance, look) });
    scope.onDispose(() => {
      unbind(); this.live.clear();
      host.scene.onBeforeRender = prev; this.uninstall(); this.effect.dispose(); detachSky(); this.roadSky.dispose();
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
    return () => { if (this.live.get(instance) === look) this.live.delete(instance); };
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
      const unstack = this.stack(this.homeInstance, opacityFade(home));
      effects.push(this.effect);
      this.restore.push(() => { unstack(); const i = effects.indexOf(this.effect); if (i !== -1) effects.splice(i, 1); pass.recompile(); });
      pass.recompile();
      return;
    }
  }

  /** the owners' grades: a live region's own over its declared one */
  private ownerGrades(): ReadonlyMap<string, RegionGrade> {
    if (this.live.size === 0) return this.grades;
    this.owned.clear();
    for (const [instance, grade] of this.grades) this.owned.set(instance, grade);
    for (const [instance, look] of this.live) if (look.grade !== undefined) this.owned.set(instance, look.grade);
    return this.owned;
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

  /** The readout. */
  state(): GridFrameState {
    const round = (n: number): number => Math.round(n * 1000) / 1000, g = this.graded;
    return {
      installed: this.installed, faded: this.faded, owner: dominantOwner(this.weights), highway: round(this.weights.highway),
      weights: Object.fromEntries([...this.weights.cells].map(([k, w]) => [k, round(w)])),
      air: [round(this.air.r), round(this.air.g), round(this.air.b)],
      grade: [round(g.exposure), round(g.saturation), round(g.contrast), round(g.tint[0]), round(g.tint[1]), round(g.tint[2])],
      roadSky: round(this.roadSky.drawn),
    };
  }
}
