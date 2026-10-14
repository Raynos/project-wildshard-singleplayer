import type { Material } from 'three';
import type { GraphLiteral } from '@wildshard/format/materialGraph';

/**
 * Pine Hollow's compiled look.materials graphs (the hearth particles, data/hearthLook.ts; the cave shaft,
 * data/caveShaftLook.ts) and their live params, lent by the world hook (runtime/index.ts) before the cabins and crags build.
 */
let looks: { readonly materials: ReadonlyMap<string, Material>; readonly setParam: (id: string, name: string, value: GraphLiteral) => void } | null = null;

/** lend the compiled looks (`runtimeLookMaterials`) */
export function lendPineLooks(lent: NonNullable<typeof looks>): void { looks = lent; }

/** a compiled look by its look.materials id; throws when none was lent */
export function pineLook(id: string): Material {
  const m = looks?.materials.get(id);
  if (m === undefined) throw new Error(`[pine-hollow] no compiled look ${id}`);
  return m;
}

/** set a lent look's param (checked against its declared type and range); a no-op before any were lent */
export function setPineLookParam(id: string, name: string, value: GraphLiteral): void { looks?.setParam(id, name, value); }
