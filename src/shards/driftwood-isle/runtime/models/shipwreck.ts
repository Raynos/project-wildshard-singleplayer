import { MeshBasicMaterial } from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { libraryModel } from '@wildshard/game/models/libraryModel';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { fixedGeometryReady, loadFixedGeometry, SHIPWRECK_KIT_GEOMETRY, SHIPWRECK_GLOW_GEOMETRY, WRECK_KIT_GEOMETRY, WRECK_GLOW_GEOMETRY } from '../boot/fixedGeometry';
import { WRECK_SITES } from '../../data/wreckSites';
import type { WreckSpec } from '../../assets/contracts/wreck';

/** Select the world landmark or flat-ground Explorer specimen; a new site needs an authored bake. */
export function wreckSiteKind(site: WreckSpec): keyof typeof WRECK_SITES {
  for (const kind of ['world', 'specimen'] as const) {
    const row = WRECK_SITES[kind];
    if (site.x === row.x && site.z === row.z && site.heading === row.heading && site.floorY === row.floorY
      && (site.roll ?? -0.2) === row.roll && (site.pitch ?? 0.05) === row.pitch) return kind;
  }
  throw new Error('Shipwreck site changed; regenerate its authored geometry');
}
/** Retained placement contract; the admitted baked site owns its terrain-dependent shape. */
export interface ShipwreckParams { readonly site: WreckSpec; readonly ground: (x: number, z: number) => number }

const DRAWS = { 'world-kit': WRECK_KIT_GEOMETRY, 'world-glow': WRECK_GLOW_GEOMETRY, 'specimen-kit': SHIPWRECK_KIT_GEOMETRY, 'specimen-glow': SHIPWRECK_GLOW_GEOMETRY };

/** The world copy's colliders and draw are the Wreck site's (world/Wreck.ts: `drawnInto`); this draws its Explorer card. */
export const shipwreck = defineModel<ShipwreckParams>({
  id: 'driftwood-isle/shipwreck', name: 'Shipwreck', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/shipwreck.ts', surface: 'planks',
  defaults: { site: WRECK_SITES.specimen, ground: () => 0 },
  ...libraryModel<ShipwreckParams, 'kit' | 'glow', keyof typeof DRAWS>({
    draws: (p) => { const kind = wreckSiteKind(p.site); return [{ draw: `${kind}-kit`, material: 'kit', castShadow: true, receiveShadow: true }, { draw: `${kind}-glow`, material: 'glow' }]; },
    geometry: (_, draw) => DRAWS[draw].copy(),
    material: (ctx, key) => key === 'kit' ? lowPolyLookMaterial(ctx.sky) : ctx.once('driftwood-isle/shipwreck:lanterns', () => new MeshBasicMaterial({ vertexColors: true })),
    loading: { id: 'driftwood-isle/shipwreck', ready: fixedGeometryReady, load: () => loadFixedGeometry(), size: () => [12, 15, 24] },
  }),
});
