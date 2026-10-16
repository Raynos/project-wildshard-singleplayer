import type { Material, Texture } from 'three';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import type { DaySkyGraphs } from '@wildshard/sdk/looks/graphDaySky';

/**
 * Pine Hollow's compiled look.materials graphs (the hearth particles, data/hearthLook.ts; the cave shaft,
 * data/caveShaftLook.ts) and their live params, lent by the world hook (runtime/index.ts) before the cabins and crags build.
 */
let looks: {
  readonly materials: ReadonlyMap<string, Material>; readonly setParam: (id: string, name: string, value: GraphLiteral) => void;
  readonly setTexture: (id: string, name: string, texture: Texture) => void; readonly bindMeshMap: (id: string, map: Texture | Material) => Material;
} | null = null;

/** lend the compiled looks (`runtimeLookMaterials`) */
export function lendPineLooks(lent: NonNullable<typeof looks>): void { looks = lent; }

/** the lent looks themselves (a channel group's graph param push); throws when none were lent */
export function pineLooks(): Pick<DaySkyGraphs, 'setParam'> {
  if (looks === null) throw new Error('[pine-hollow] no compiled looks');
  return looks;
}

/** a compiled look by its look.materials id; throws when none was lent */
export function pineLook(id: string): Material {
  const m = looks?.materials.get(id);
  if (m === undefined) throw new Error(`[pine-hollow] no compiled look ${id}`);
  return m;
}

/** a lent look worn over `source`'s own maps (a material's colour, normal, roughness, AO; a texture as the colour map), one per
 *  look and source; throws when none was lent */
export function pineMappedLook(id: string, source: Texture | Material): Material {
  if (looks === null) throw new Error(`[pine-hollow] no compiled look ${id}`);
  return looks.bindMeshMap(id, source);
}

/** set a lent look's param (checked against its declared type and range); a no-op before any were lent */
export function setPineLookParam(id: string, name: string, value: GraphLiteral): void { looks?.setParam(id, name, value); }

/** lend a look's `role: 'lent'` texture param a texture the runtime made (no program change); throws when none was lent */
export function setPineLookTexture(id: string, name: string, texture: Texture): void {
  if (looks === null) throw new Error(`[pine-hollow] no compiled look ${id}`);
  looks.setTexture(id, name, texture);
}
