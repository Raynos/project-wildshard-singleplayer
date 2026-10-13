import { Group, InstancedMesh } from 'three';
import { skyBakedGeometry } from './baked';
import { skyLook } from './looks';

/**
 * The falls, one instanced draw: each sheet hung from its isle's lip, facing out, at its baked matrix (generators/placements.ts),
 * in its material graph (data/fallLook.ts, `look.materials.falls`: foam streaks scrolling down a fraying blue-white sheet).
 * Undrawn before the looks are set (the Model Explorer, a test).
 */
export function skyline(falls: readonly number[]): Group {
  const group = new Group(), material = skyLook('falls');
  if (material === undefined) return group;
  // the sheet's geometry is baked (generators/geometries.ts `fall`, 1 m by 1 m): each instance scales it
  const mesh = new InstancedMesh(skyBakedGeometry('fall'), material, falls.length / 16);
  mesh.instanceMatrix.array.set(falls); mesh.computeBoundingSphere(); group.add(mesh);
  return group;
}
