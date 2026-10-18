/**
 * Ocean v2: Driftwood Isle's faceted, stylized sea (DRIFTWOOD-REMASTER W1-W3; SHARD-PLATFORM M3, G466 H7) is the sea row
 * (data/oceanLook.ts OCEAN_SURFACE, section `custom/oceanSurface`) on the water-surface host (@wildshard/sdk/looks/waterSurface), wearing its graph
 * (data/oceanLook.ts: Gerstner waves from `waves.ts`, the toon body, Beer-Lambert depth over the baked sea floor, the
 * fresnel sky and glint, the foam bands and rings). The grid (per tier: 2.75 m fine on desktop, 4 m on the phone,
 * coarsening out to ~4 km) and the sea floor are baked (generators/oceanGrid.ts); the colours and depth are OCEAN's.
 *
 *   const ocean = new Ocean(sky).build(await loadOcean(), level, dry, edgeInset);
 *   scene.add(ocean.group); ocean.foamAround(boxes); game.onUpdate((dt) => ocean.update(dt));
 */
import type * as THREE from 'three';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import { WaterSurface, waterSurfaceLook, type WaterDryRect } from '@wildshard/sdk/looks/waterSurface';
import { lentLooksOf } from '@wildshard/sdk/looks/lentLooks';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { buildTier } from '@wildshard/engine/core/tier';
import { HORIZON_RADIUS } from '@wildshard/engine/world/HorizonMatte';
import { driftwoodRows, driftwoodProduct } from '../runtime/boot/rows';
import { toonLookState } from '@wildshard/game/looks/toonLook';

/** the baked sea, loaded: the level it was baked at, the tier's grid and the sea floor's heights (half-float bits) */
export interface FacetedOceanBake { readonly level: number; readonly grid: THREE.BufferGeometry; readonly floor: Uint16Array }
export async function loadOcean(): Promise<FacetedOceanBake> {
  const files = driftwoodRows('custom/oceanSurface').files, grid = modelGeometry(files[buildTier()], { _depth: 'aDepth', _seed: 'aSeed' });
  const [, floor] = await Promise.all([grid.load(), fetch(files.floor, { cache: 'force-cache' }).then(async (r) => {
    if (!r.ok) throw new Error(`Baked sea floor load failed (${String(r.status)})`);
    return new Uint16Array(await r.arrayBuffer());
  })]);
  return { level: files.level, grid: grid.take(), floor };
}

export class Ocean extends WaterSurface {
  constructor(_sky: Sky) {
    super(driftwoodRows('custom/oceanSurface').surface, waterSurfaceLook(lentLooksOf(driftwoodRows('custom/fixedLayouts').nativeView.OCEAN_LOOK), driftwoodRows('custom/fixedLayouts').nativeView.OCEAN_LOOK)); // its lent graph
  }
  /** the baked sea at `level` (its bake's), clipped out of up to four dry rectangles, stopping `edgeInset` m inside its square */
  build(bake: FacetedOceanBake, level = driftwoodRows('custom/fixedLayouts').assembly.ocean.level, dry: readonly WaterDryRect[] = [], edgeInset = 0): this {
    const OCEAN = driftwoodRows('custom/fixedLayouts').assembly.ocean;
    if (bake.level !== level) throw new Error('The baked ocean is for another sea level');
    const caustics: { value: number } = toonLookState(driftwoodProduct()).dayLight.uSeaLevel; caustics.value = level; // the caustics under it
    const params: Record<string, GraphLiteral> = { level, deepDepth: OCEAN.deepDepth, shallow: [...OCEAN.shallowColor], deep: [...OCEAN.deepColor], edgeInset, seaEnd: HORIZON_RADIUS };
    return this.draw(bake.grid, { level, floor: bake.floor, dry, params, lent: { night: toonLookState(driftwoodProduct()).dayLight.uToonNight } });
  }
}
