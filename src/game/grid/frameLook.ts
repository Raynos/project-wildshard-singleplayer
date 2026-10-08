/**
 * A live region's part in the one grid frame (SHARD-PLATFORM SF19a / G175, M3 / E452): what an admitted neighbour runtime
 * brings as its cell's owner, beside the look its far proxy declared.
 *
 * - **Its air**: the region's own fog object (`scene.fog` of its scene subtree). Its runtime's weather and scripted rooms
 *   write that fog's colour as they do standalone (a boss seal darkening it, rain greying it); the frame reads what was
 *   written as the owner's air before the scene draws, blends it by the owner's weight like any owner's air, and then
 *   writes the base (the owner's declared haze, else the home air) back, so the next frame's writes start from the base.
 *   There is still one fog, one sky dome and one sun: the region's fog object is never drawn itself.
 * - **Its grade**: the region level's own grade (`regionGrade`), which replaces the far proxy's declared grade (or the
 *   neutral one) while the region is resident.
 * - **Its whole grade chain** (G232, `regionChain`): on a page whose own grade is a neutral shell (G226's owned home), the
 *   region's level grade is carried exactly as a standalone boot of that level applies it: the page's engine grade
 *   effects (saturation, brightness and contrast, the split tone) take the level's values and its look layer's S-curve and
 *   vibrance, then its learned LUT, all faded with the cell's owner weight; its runtime and its sky's clock then drive
 *   those effects as they do standalone (`post`). The uniform grade then stays neutral for it.
 *
 * The frame binds its port to the page's root scene (`bindFrameLook`), and a region looks it up from the scene it draws
 * into (`frameLookOf`), so no layer names the other. Generic game code (E405): no shard is named here.
 */
import type { Color, Texture } from 'three';
import { ENGINE_CHAIN_TUNING, type EngineChainKind, type SkyBackdropPost } from '@wildshard/engine/render/look';
import type { RegionGrade } from './frameModel';

type Rgb = readonly [number, number, number];

/** What a live region contributes as its cell's owner. */
export interface FrameLookContribution {
  /** the region's own fog: what its runtime writes into this colour each frame is the owner's air */
  readonly fog?: { readonly color: Color } | null;
  /** the owner's grade (absent: the declared one) */
  readonly grade?: RegionGrade;
  /** its level's whole grade chain, carried exactly where the page's own grade is a neutral shell (G232) */
  readonly chain?: RegionChain;
}
/** The engine grade's values a level declares (its `GradeSpec`'s grade fields, its look layer's over them). */
export interface ChainGrade {
  /** HueSaturationEffect's saturation (−1..1) */
  readonly saturation: number;
  /** BrightnessContrastEffect's brightness and contrast (−1..1) */
  readonly brightness: number;
  readonly contrast: number;
  /** GradeEffect's split tone */
  readonly shadowTint: Rgb; readonly highTint: Rgb; readonly lift: Rgb; readonly gain: Rgb; readonly gamma: number;
}
/** A level's grade chain as a standalone boot of it builds it (`Game.buildComposer`): grade, look layer, learned LUT. */
export interface RegionChain {
  readonly grade: ChainGrade;
  /** its look layer's S-curve and vibrance (0 and 0 without one) */
  readonly look: { readonly curve: number; readonly vibrance: number };
  /** its learned LUT once loaded (33³ RGBA8, `world/lut.ts`); null: none (yet) */
  readonly lut: () => Texture | null;
  /**
   * its engine chain's own knobs (SF63): bloom's intensity, threshold and smoothing, the vignette's darkness and the god
   * rays' opacity, as its level's grade and its chain kind (`ENGINE_CHAIN_TUNING`) set them standalone; absent: a level
   * whose look builds its whole chain itself ('replace'), whose knobs the page's chain has no equivalent of
   */
  readonly post?: RegionPost;
}
/** A level's engine chain knobs (`Game.buildComposer`): what the page's same effects carry inside its cell. */
export interface RegionPost {
  readonly kind: EngineChainKind;
  readonly bloomIntensity: number; readonly bloomThreshold: number; readonly bloomSmoothing: number;
  readonly vignette: number;
  readonly rays: number;
  /**
   * a cinematic chain's volumetric shafts as its level's atmosphere starts them (strength, sun colour): with the fringe and
   * the grain the page carries them inside its cell (`regionCinematic.ts`, SF63 follow-up); absent on the clean chain
   */
  readonly volumetric?: { readonly strength: number; readonly sunColor: Rgb };
}
/** What a region's sky clock drives of the page's post while the region carries its chain (`SkyBackdropPost`'s hue). */
export interface FramePost {
  readonly hueSat: { saturation: number };
  /** the page's god rays when its chain has them (SF63: the region's clock turns their opacity as standalone); else null */
  readonly rays: { readonly blendMode: { readonly opacity: { value: number } } } | null;
  /** the carried volumetric shafts this region's clock drives (kept per region, live while it carries); null: none */
  readonly vol: SkyBackdropPost['vol'] | null;
}
/** A live region's own sky laid over the frame's one sky (`regionSky.ts`, G223): told its owner's weight each frame. */
export interface FrameSkyLayer {
  readonly weight: (w: number) => void;
  /** the readout: its drawn weight, whether it draws, and the GPU bytes it holds against the bytes it reserved */
  readonly state: () => { readonly weight: number; readonly drawn: boolean; readonly bytes: number; readonly reserved: number };
}
/** The one frame's port for live regions; `contribute` and `sky` return the release. */
export interface FrameLookPort {
  readonly contribute: (instance: string, look: FrameLookContribution) => () => void;
  /** hang a region's own sky on its cell's owner weight (absent on a port with no frame weights) */
  readonly sky?: (instance: string, layer: FrameSkyLayer) => () => void;
  /**
   * the page's grade effects a live region's sky clock may drive while it owns the frame (a day clock turning the
   * saturation, as standalone): non-null only where chains are carried (the page's own grade is a neutral shell); the frame
   * holds the page's values when the region takes the frame and puts them back when it leaves
   */
  readonly post?: (instance?: string) => FramePost | null;
}

const ports = new WeakMap<object, FrameLookPort>();
/** Bind the frame's port to the scene it draws (the page's root scene); returns the unbind. One frame per scene. */
export function bindFrameLook(scene: object, port: FrameLookPort): () => void {
  if (ports.has(scene)) throw new Error('This scene already has a grid frame');
  ports.set(scene, port);
  return () => { if (ports.get(scene) === port) ports.delete(scene); };
}
/** The frame port bound to a scene (null: no grid frame, e.g. Select a shard or a test page). */
export function frameLookOf(scene: object): FrameLookPort | null { return ports.get(scene) ?? null; }

/** The grade fields of a level's `GradeSpec` this reads (structural: any level's grade fits). */
interface LevelGrade { readonly saturation: number; readonly brightness: number; readonly contrast: number; readonly shadowTint: Rgb; readonly highTint: Rgb; readonly gain: Rgb }
/** The fields a level's grade chain reads (structural). */
interface ChainLevel {
  readonly grade: ChainGrade & { readonly bloomIntensity: number; readonly bloomThreshold: number };
  /** its atmosphere's volumetric medium and sun colour (the cinematic chain's shafts) */
  readonly atmosphere?: { readonly volumetricSunColor: Rgb; readonly volumetric?: { readonly strength: number } | undefined };
  readonly lookLayer?: { readonly grade: Partial<ChainGrade & { readonly bloomIntensity: number; readonly bloomThreshold: number }>; readonly curve: number; readonly vibrance: number } | undefined;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** postprocessing's HueSaturationEffect / BrightnessContrastEffect amount (−1..1) as a factor about the mean / mid grey */
const factor = (amount: number, top: number): number => clamp(amount > 0 ? 1 / Math.max(1e-3, 1.001 - amount) : 1 + amount, 0, top);
/** linear mid grey: the frame grade's contrast pivot, and where the brightness offset is read as exposure */
const MID = 0.214;

/**
 * A level's own grade (its `grade` with its look layer's grade over it) as the frame's uniform grade: saturation and
 * contrast as the engine chain's effects apply them, the brightness offset as exposure about mid grey, and the split
 * tone's average (shadow and highlight tints) times the gain as the tint. The level's LUT, curve and vibrance have no
 * uniform equivalent: where the page's own grade is a neutral shell the whole chain carries them (`regionChain`).
 */
export function regionGrade(level: { readonly grade: LevelGrade; readonly lookLayer?: { readonly grade: Partial<LevelGrade> } | undefined }): RegionGrade {
  const g = { ...level.grade, ...level.lookLayer?.grade };
  const tint = (i: 0 | 1 | 2): number => clamp(((g.shadowTint[i] + g.highTint[i]) / 2) * g.gain[i], 0.5, 1.5);
  return {
    exposure: clamp(Math.log2(Math.max(0.25, 1 + g.brightness / MID)), -2, 2),
    saturation: factor(g.saturation, 3), contrast: factor(g.contrast, 3),
    tint: [tint(0), tint(1), tint(2)],
  };
}

/**
 * A level's grade chain (G232): its grade with its look layer's grade over it (`resolveGrade`'s merge), the look's
 * S-curve and vibrance, and its LUT as `lut` reads it (late: the region loads it).
 */
export function regionChain(level: ChainLevel, lut: () => Texture | null, kind?: EngineChainKind): RegionChain {
  const g = { ...level.grade, ...level.lookLayer?.grade };
  const tuning = kind === undefined ? null : ENGINE_CHAIN_TUNING[kind];
  return {
    grade: { saturation: g.saturation, brightness: g.brightness, contrast: g.contrast, shadowTint: g.shadowTint, highTint: g.highTint, lift: g.lift, gain: g.gain, gamma: g.gamma },
    look: { curve: level.lookLayer?.curve ?? 0, vibrance: level.lookLayer?.vibrance ?? 0 },
    lut,
    ...(kind === undefined || tuning === null ? {} : { post: { kind, bloomIntensity: g.bloomIntensity, bloomThreshold: g.bloomThreshold, bloomSmoothing: tuning.bloomSmoothing, vignette: tuning.vignette, rays: tuning.rays,
      // the cinematic chain's shafts start from its atmosphere (`Game.buildComposer`: `setMedium`, the sun colour; 0.55 without a medium)
      ...(kind === 'cinematic' ? { volumetric: { strength: level.atmosphere?.volumetric?.strength ?? 0.55, sunColor: level.atmosphere?.volumetricSunColor ?? [1, 0.7, 0.4] } } : {}) } }),
  };
}
/** The engine chain a level's look runs on (SF63): its declared kind, the cinematic chain without one, none for a 'replace' look. */
export function lookChainKind(look: { readonly mode?: 'extend' | 'replace'; readonly chain?: EngineChainKind } | null): EngineChainKind | undefined {
  if (look === null) return 'cinematic';
  return look.mode === 'replace' ? undefined : look.chain ?? 'cinematic';
}
