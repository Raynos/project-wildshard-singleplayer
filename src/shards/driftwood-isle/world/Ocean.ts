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
import { WaterSurface, waterSurfaceLook, type WaterDryRect, type WaterSurfaceLook } from '@wildshard/sdk/looks/waterSurface';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { buildTier } from '@wildshard/engine/core/tier';
import { HORIZON_RADIUS } from '@wildshard/engine/world/HorizonMatte';
import { OCEAN } from '../world/sites';
import { driftwoodRows } from '../runtime/boot/rows';
import { OCEAN_LOOK } from '../runtime/const';
import { dayLight } from '../runtime/look/toon';

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

let lent: WaterSurfaceLook | null = null;
/** hand the sea its compiled graph (look.materials) before the world builds */
export function setOceanLook(looks: Parameters<typeof waterSurfaceLook>[0]): void { lent = waterSurfaceLook(looks, OCEAN_LOOK); }

export class Ocean extends WaterSurface {
  constructor(_sky: Sky) {
    if (lent === null) throw new Error('Driftwood: the ocean draws only with its look.materials graph (setOceanLook)');
    super(driftwoodRows('custom/oceanSurface').surface, lent);
  }
  /** the baked sea at `level` (its bake's), clipped out of up to four dry rectangles, stopping `edgeInset` m inside its square */
  build(bake: FacetedOceanBake, level = OCEAN.level, dry: readonly WaterDryRect[] = [], edgeInset = 0): this {
    if (bake.level !== level) throw new Error('The baked ocean is for another sea level');
    const caustics: { value: number } = dayLight.uSeaLevel; caustics.value = level; // the caustics under it
    const params: Record<string, GraphLiteral> = { level, deepDepth: OCEAN.deepDepth, shallow: [...OCEAN.shallowColor], deep: [...OCEAN.deepColor], edgeInset, seaEnd: HORIZON_RADIUS };
    return this.draw(bake.grid, { level, floor: bake.floor, dry, params, lent: { night: dayLight.uToonNight } });
  }
}
