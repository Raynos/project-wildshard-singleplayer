/**
 * One frame for the grid (SHARD-PLATFORM SF19a): inside EXPERIMENTAL Wildshard, behind Settings ▸ Debug ▸ "Grid one
 * frame" (default off until a device reading, RENDERING.md), the camera owns the frame's sky, sun, exposure and air,
 * and each pixel keeps its own region's grade.
 *
 * - **One clock, one sky, one sun, one exposure**: the home look's backdrop is the world clock and draws the one dome and
 *   key light; the engine chain's tone mapping, bloom and vignette (the camera's) stay on every pixel.
 * - **Air per region, blended across the edge bands**: before the scene draws, the scene fog's colour is the camera's
 *   air (`frameFog`: the home look's live fog, each neighbour's declared haze, the neutral highway air on the deck, by
 *   the camera's region weights), and every far proxy hazes toward that one air with a trace of its own declared haze,
 *   so distant shards fade into the same horizon.
 * - **A grade per pixel, no new pass**: the scene pass writes each pixel's region slot into the colour buffer's alpha
 *   (`frameModel.ts`); in the engine's one colour pass the home look's grade effects (saturation, contrast, split tone,
 *   the learned LUT) are gated to home pixels by their blend, and one small effect appended to the same pass grades the
 *   deck (neutral) and each neighbour (its declared grade), then restores alpha 1. Painterly grades in-material stay.
 * Select a shard never builds this (grid page mode only), and with the row off nothing here is installed.
 */
import { Color, Uniform, Vector3, type Camera, type Material, type Mesh, type Scene } from 'three';
import { BlendFunction, Effect, EffectPass, LUT3DEffect, type BlendMode, type EffectComposer } from 'postprocessing';
import { patchShader } from '@wildshard/engine/render/shaderPatches';
import type { Scope } from '@wildshard/engine/app/scope';
import type { FarProxyView } from './farView';
import type { FarHaze } from './farProxy';
import { DECK_SLOT, FIRST_NEIGHBOUR_SLOT, LAST_SLOT, MAX_NEIGHBOUR_SLOTS, NEUTRAL_GRADE, frameFog, regionWeights, slotAlpha, type FrameCell, type RegionGrade, type RegionWeights } from './frameModel';

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
  readonly gated: number; readonly installed: boolean; readonly highway: number;
  readonly weights: Readonly<Record<string, number>>; readonly air: readonly [number, number, number];
  readonly slots: Readonly<Record<string, number>>;
}

const GATE_HEAD = `
#ifndef WS_GRID_FRAME_HOME
#define WS_GRID_FRAME_HOME
float wsGridFrameHome() {
  float slot = floor(texture2D(inputBuffer, vUv).a * ${String(16)}.0 + 0.5);
  return slot >= ${DECK_SLOT.toFixed(1)} && slot <= ${LAST_SLOT.toFixed(1)} ? 0.0 : 1.0;
}
#endif`;

/** The custom blend ids the gate uses: past every built-in BlendFunction, one per original function. */
const GATE_ID_BASE = 1000;

/**
 * Gate an effect to home pixels: its blend becomes mix(dst, its own blend, home). The effect is otherwise untouched; the
 * returned function restores it. The pass must recompile afterwards.
 */
export function gateToHome(blendMode: BlendMode): () => void {
  const original = blendMode.getShaderCode(), fn: number = blendMode.blendFunction, id = GATE_ID_BASE + fn;
  const inner = `wsGridFrameInner${String(id)}`;
  const code = `${GATE_HEAD}\n${original.replaceAll(/\bblend\b/g, inner)}\nvec4 blend(const in vec4 dst, const in vec4 src, const in float opacity) { return mix(dst, ${inner}(dst, src, opacity), wsGridFrameHome()); }`;
  Object.defineProperty(blendMode, 'blendFunction', { configurable: true, get: () => id, set: () => undefined });
  Object.defineProperty(blendMode, 'getShaderCode', { configurable: true, value: () => code });
  return () => { Reflect.deleteProperty(blendMode, 'blendFunction'); Reflect.deleteProperty(blendMode, 'getShaderCode'); };
}

/** The region grade, one small effect at the end of the colour pass: slot → exposure, saturation, contrast; alpha → 1. */
export class RegionGradeEffect extends Effect {
  /** x exposure (stops), y saturation, z contrast, per slot (index = slot; home and unused slots stay neutral) */
  readonly grades: Vector3[];
  constructor() {
    const grades = Array.from({ length: LAST_SLOT + 1 }, () => new Vector3(NEUTRAL_GRADE.exposure, NEUTRAL_GRADE.saturation, NEUTRAL_GRADE.contrast));
    super('GridRegionGrade', /* glsl */`
      uniform vec3 uGridRegionGrades[${String(LAST_SLOT + 1)}];
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        float slot = floor(texture2D(inputBuffer, uv).a * 16.0 + 0.5);
        vec3 c = inputColor.rgb;
        if (slot >= ${DECK_SLOT.toFixed(1)} && slot <= ${LAST_SLOT.toFixed(1)}) {
          vec3 g = uGridRegionGrades[int(slot)];
          c *= exp2(g.x);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = max(mix(vec3(l), c, g.y), 0.0);
          c = max((c - 0.214) * g.z + 0.214, 0.0); // pivot: mid grey in linear light
        }
        outputColor = vec4(c, 1.0);
      }`, { blendFunction: BlendFunction.SRC, uniforms: new Map<string, Uniform>([['uGridRegionGrades', new Uniform(grades)]]) });
    this.grades = grades;
  }
  /** Set a slot's grade. */
  set(slot: number, grade: RegionGrade): void { this.grades[slot]?.set(grade.exposure, grade.saturation, grade.contrast); }
}

/** The effects of an EffectPass (its list is private in the typings; read at run time and checked). */
function passEffects(pass: EffectPass): Effect[] | null {
  const found: unknown = Reflect.get(pass, 'effects');
  if (!Array.isArray(found)) return null;
  const list: unknown[] = found;
  return list.every((e) => e instanceof Effect) ? list.filter((e): e is Effect => e instanceof Effect) : null;
}

/** A proxy the frame tags: its view and its own declared haze (linear RGB). */
interface Tagged { readonly view: FarProxyView; readonly haze: FarHaze }
/** How much of a proxy's own declared haze colour survives in the one frame's air. */
const OWN_HAZE = 0.25;

/** The live one frame. Built by the grid session when the row is on; disposed with the level scope. */
export class GridFrame {
  private readonly host: GridFrameHost;
  private readonly cells: readonly FrameCell[];
  private readonly homeInstance: string;
  private readonly homeOrigin: { readonly x: number; readonly z: number };
  private readonly half: number;
  private readonly band: number;
  private readonly slots = new Map<string, number>();
  private readonly hazes = new Map<string, readonly [number, number, number]>();
  private readonly grades = new Map<string, RegionGrade>();
  private readonly tagged = new Map<string, Tagged>();
  private readonly effect = new RegionGradeEffect();
  private readonly restore: (() => void)[] = [];
  private gated = 0;
  private installed = false;
  private weights: RegionWeights = { cells: new Map(), highway: 0 };
  private readonly air = new Color();
  private readonly homeFog = new Color();
  private readonly written = new Color(Number.NaN, Number.NaN, Number.NaN);
  private readonly scratch = new Color();

  constructor(options: { host: GridFrameHost; scope: Scope; cells: readonly FrameCell[]; home: FrameCell; half: number; band: number }) {
    const { host, scope, cells, home } = options;
    this.host = host; this.cells = cells; this.homeInstance = home.instance; this.homeOrigin = home.origin; this.half = options.half; this.band = options.band;
    const neighbours = cells.filter((cell) => cell.instance !== home.instance);
    if (neighbours.length > MAX_NEIGHBOUR_SLOTS) throw new RangeError(`A grid frame has ${String(MAX_NEIGHBOUR_SLOTS)} neighbour slots, not ${String(neighbours.length)}`);
    neighbours.forEach((cell, i) => { this.slots.set(cell.instance, FIRST_NEIGHBOUR_SLOT + i); });
    this.effect.set(DECK_SLOT, NEUTRAL_GRADE);
    // the scene fog is the camera's air while the scene draws (the backdrop has written its own by then)
    const prev = host.scene.onBeforeRender.bind(host.scene);
    host.scene.onBeforeRender = (...args) => { this.beforeScene(); prev(...args); };
    scope.onDispose(() => { host.scene.onBeforeRender = prev; this.uninstall(); this.effect.dispose(); });
  }

  /** The slot a neighbour's pixels write (undefined for the home cell). */
  slot(instance: string): number | undefined { return this.slots.get(instance); }

  /** A neighbour's declared grade and haze, as its far proxy arrives (or before). */
  declare(instance: string, look: { readonly haze: FarHaze; readonly grade?: RegionGrade | undefined }): void {
    const slot = this.slots.get(instance);
    if (slot === undefined) return;
    this.hazes.set(instance, look.haze.colour);
    const grade = look.grade ?? NEUTRAL_GRADE;
    this.grades.set(instance, grade); this.effect.set(slot, grade);
  }

  /** Tag a drawn far proxy: its pixels write its slot and its haze follows the frame's air. Returns the untag. */
  tag(instance: string, view: FarProxyView, haze: FarHaze): () => void {
    const slot = this.slots.get(instance);
    if (slot === undefined) return () => undefined;
    view.frameAlpha(slotAlpha(slot));
    const entry = { view, haze };
    this.tagged.set(instance, entry);
    return () => { if (this.tagged.get(instance) === entry) this.tagged.delete(instance); };
  }

  /** Patch the deck's material to write the highway slot (before its first draw). */
  deck(mesh: Mesh): void {
    const alpha = slotAlpha(DECK_SLOT), material: Material | Material[] = mesh.material;
    for (const m of Array.isArray(material) ? material : [material]) {
      patchShader(m, 'sf19a-deck-slot', 900, (shader): void => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\ngl_FragColor.a = ${alpha.toFixed(6)};`);
      }, { key: 'sf19a-deck-slot' });
    }
  }

  /** Once per frame (the page's late phase): the camera's region weights, then the gate once the composer exists. */
  frame(): void {
    const at = this.host.camera.position;
    this.weights = regionWeights(this.cells, at.x + this.homeOrigin.x, at.z + this.homeOrigin.z, this.half, this.band);
    if (!this.installed) this.install();
  }

  private install(): void {
    let composer: EffectComposer;
    try { composer = this.host.composer(); } catch { return; } // not built yet: next frame
    this.installed = true;
    const post = this.host.post();
    if (post === null) return; // a level that builds its own chain: the air still blends, the grade stays the home's
    for (const pass of composer.passes) {
      if (!(pass instanceof EffectPass)) continue;
      const effects = passEffects(pass);
      if (effects === null || !effects.includes(post.saturation)) continue;
      for (const effect of effects) {
        if (effect !== post.saturation && effect !== post.contrast && effect !== post.grade && !(effect instanceof LUT3DEffect)) continue;
        this.restore.push(gateToHome(effect.blendMode)); this.gated++;
      }
      effects.push(this.effect);
      this.restore.push(() => { const i = effects.indexOf(this.effect); if (i !== -1) effects.splice(i, 1); pass.recompile(); });
      pass.recompile();
      return;
    }
  }

  private uninstall(): void { for (const undo of this.restore.splice(0).reverse()) undo(); this.gated = 0; }

  /** Before the scene draws: the scene fog becomes the camera's air, every tagged proxy hazes toward it. */
  private beforeScene(): void {
    const live = this.host.scene.fog?.color ?? null;
    // the backdrop rewrites the fog each frame; if it did not, keep the home value it wrote last
    if (live !== null && !live.equals(this.written)) this.homeFog.copy(live);
    const home = { instance: this.homeInstance, fog: [this.homeFog.r, this.homeFog.g, this.homeFog.b] as const };
    const [r, g, b] = frameFog(this.weights, home, this.hazes);
    this.air.setRGB(r, g, b);
    if (live !== null) { live.copy(this.air); this.written.copy(this.air); }
    for (const { view, haze } of this.tagged.values()) {
      this.scratch.setRGB(haze.colour[0], haze.colour[1], haze.colour[2]).lerp(this.air, 1 - OWN_HAZE);
      view.hazeColour(this.scratch);
    }
  }

  /** The readout. */
  state(): GridFrameState {
    const round = (n: number): number => Math.round(n * 1000) / 1000;
    return {
      gated: this.gated, installed: this.installed, highway: round(this.weights.highway),
      weights: Object.fromEntries([...this.weights.cells].map(([k, w]) => [k, round(w)])),
      air: [round(this.air.r), round(this.air.g), round(this.air.b)], slots: Object.fromEntries(this.slots),
    };
  }
}
