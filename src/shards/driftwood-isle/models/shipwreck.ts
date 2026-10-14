import { Group, Mesh, MeshBasicMaterial } from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';
import { fixedGeometryReady, loadFixedGeometry, SHIPWRECK_KIT_GEOMETRY, SHIPWRECK_GLOW_GEOMETRY, WRECK_KIT_GEOMETRY, WRECK_GLOW_GEOMETRY } from '../boot/fixedGeometry';
import { WRECK_SITES } from '../data/wreckSites';
import type { WreckSpec } from '../assets/contracts/wreck';

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

function shipParts(ctx:ModelContext,world:boolean):ModelPart[] {
  return [
    { geometry: (world ? WRECK_KIT_GEOMETRY : SHIPWRECK_KIT_GEOMETRY).copy(), material: lowPolyMaterial(ctx.sky),
      castShadow: true, receiveShadow: true, customDepthMaterial: swayDepthMaterial() },
    { geometry: (world ? WRECK_GLOW_GEOMETRY : SHIPWRECK_GLOW_GEOMETRY).copy(),
      material: ctx.once('driftwood-isle/shipwreck:lanterns', () => new MeshBasicMaterial({ vertexColors: true })) },
  ];
}

export const shipwreck = defineModel<ShipwreckParams>({
  id: 'driftwood-isle/shipwreck', name: 'Shipwreck', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/shipwreck.ts', surface: 'planks',
  defaults: { site: WRECK_SITES.specimen, ground: () => 0 }, prepare: loadFixedGeometry,
  build: (ctx, p) => {
    const world = wreckSiteKind(p.site) === 'world';
    if (fixedGeometryReady()) return shipParts(ctx,world);
    return loadingSpecimen('driftwood-isle/shipwreck',[12,15,24],async()=>{
      await loadFixedGeometry();
      const group=new Group();
      for(const part of shipParts(ctx,world)) {
        const mesh=new Mesh(part.geometry,part.material);
        mesh.castShadow=part.castShadow??false;mesh.receiveShadow=part.receiveShadow??false;
        if(part.customDepthMaterial)mesh.customDepthMaterial=part.customDepthMaterial;
        group.add(mesh);
      }
      return group;
    });
  },
});
