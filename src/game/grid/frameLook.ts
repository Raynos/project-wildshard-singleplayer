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
 *
 * The frame binds its port to the page's root scene (`bindFrameLook`), and a region looks it up from the scene it draws
 * into (`frameLookOf`), so no layer names the other. Generic game code (E405): no shard is named here.
 */
import type { Color } from 'three';
import type { RegionGrade } from './frameModel';

/** What a live region contributes as its cell's owner. */
export interface FrameLookContribution {
  /** the region's own fog: what its runtime writes into this colour each frame is the owner's air */
  readonly fog?: { readonly color: Color } | null;
  /** the owner's grade (absent: the declared one) */
  readonly grade?: RegionGrade;
}
/** The one frame's port for live regions; `contribute` returns the release. */
export interface FrameLookPort { readonly contribute: (instance: string, look: FrameLookContribution) => () => void }

const ports = new WeakMap<object, FrameLookPort>();
/** Bind the frame's port to the scene it draws (the page's root scene); returns the unbind. One frame per scene. */
export function bindFrameLook(scene: object, port: FrameLookPort): () => void {
  if (ports.has(scene)) throw new Error('This scene already has a grid frame');
  ports.set(scene, port);
  return () => { if (ports.get(scene) === port) ports.delete(scene); };
}
/** The frame port bound to a scene (null: no grid frame, e.g. Select a shard or a test page). */
export function frameLookOf(scene: object): FrameLookPort | null { return ports.get(scene) ?? null; }

type Rgb = readonly [number, number, number];
/** The grade fields of a level's `GradeSpec` this reads (structural: any level's grade fits). */
interface LevelGrade { readonly saturation: number; readonly brightness: number; readonly contrast: number; readonly shadowTint: Rgb; readonly highTint: Rgb; readonly gain: Rgb }

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** postprocessing's HueSaturationEffect / BrightnessContrastEffect amount (−1..1) as a factor about the mean / mid grey */
const factor = (amount: number, top: number): number => clamp(amount > 0 ? 1 / Math.max(1e-3, 1.001 - amount) : 1 + amount, 0, top);
/** linear mid grey: the frame grade's contrast pivot, and where the brightness offset is read as exposure */
const MID = 0.214;

/**
 * A level's own grade (its `grade` with its look layer's grade over it) as the frame's uniform grade: saturation and
 * contrast as the engine chain's effects apply them, the brightness offset as exposure about mid grey, and the split
 * tone's average (shadow and highlight tints) times the gain as the tint. The level's LUT, curve and vibrance have no
 * uniform equivalent and stay with a page that boots the level as its home.
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
