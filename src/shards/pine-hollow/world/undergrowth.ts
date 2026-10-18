import { Group, type BufferGeometry, type Material, type Vector3 } from 'three';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { buildTier, TIER_CONFIG } from '@wildshard/engine/core/tier';
import { plumbingKnob } from '@wildshard/game/shard/declaredPlumbing';
import { loadFirstPartyProduct, slugRuntimeProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { productCoverAppearance, type CoverAppearance, type CoverMaterial } from '@wildshard/game/looks/coverAppearance';
import type { UnderShapes } from '../runtime/world/undergrowthKit';

export interface UnderPlacement { x: number; y: number; z: number; nx: number; ny: number; nz: number; rot: number; scale: number; r: number; g: number; b: number; matrix: readonly number[] }
export type UnderKind = 'ferns' | 'shrubs' | 'litter' | 'stones' | 'moss' | 'reeds';
export type UnderPlacements = Record<UnderKind, UnderPlacement[]>;
export interface UnderKindDraw { readonly geometry: BufferGeometry; readonly material: CoverMaterial; readonly castShadow: boolean; readonly customDepthMaterial?: Material }
const far = (): number => plumbingKnob(slugRuntimeProduct('pine-hollow')?.source.plumbing, buildTier(), 'pine.undergrowthFar', 'number', TIER_CONFIG);
const shadow = (): boolean => plumbingKnob(slugRuntimeProduct('pine-hollow')?.source.plumbing, buildTier(), 'pine.undergrowthShadows', 'boolean', TIER_CONFIG);

/** Pine's original model placement and forest culling law. Maps, materials,
 * vertex channels and live bindings belong to the shared appearance host. */
export class Undergrowth {
  readonly group = new Group();
  private drawn: Readonly<Record<UnderKind, UnderKindDraw>> | undefined;
  get kinds(): Readonly<Record<UnderKind, UnderKindDraw>> {
    if (this.drawn === undefined) throw new Error('Undergrowth is not built'); return this.drawn;
  }
  private appearance: CoverAppearance | undefined;
  constructor(private readonly sky: Sky, readonly view: Forest, private readonly shapes: UnderShapes, readonly layout: UnderPlacements) {}
  cells(): { readonly size: 32; readonly pad: 2.5; readonly far: number } { return { size: 32, pad: 2.5, far: far() + 2 }; }
  async buildAsync(pause: () => Promise<void>): Promise<this> {
    const product = await loadFirstPartyProduct('pine-hollow'), appearance = await productCoverAppearance(product, 'look/cover-appearance.json');
    const reach = far(); appearance.set('fade', [reach, Math.min(25, reach * 0.3)]);
    await appearance.prepare(product); await pause(); this.appearance = appearance;
    const draw = (id: UnderKind): UnderKindDraw => ({ geometry: appearance.geometry(id, this.shapes[id]), material: appearance.mapped(id), castShadow: appearance.row.kinds.find(row => row.id === id)?.shadow === true && shadow() });
    this.drawn = { ferns: draw('ferns'), shrubs: draw('shrubs'), litter: draw('litter'), stones: draw('stones'), moss: draw('moss'), reeds: draw('reeds') };
    return this;
  }
  update(_dt: number, viewer: Vector3): void { this.appearance?.update(viewer, this.group.matrixWorld, this.sky.sunColor); }
}
