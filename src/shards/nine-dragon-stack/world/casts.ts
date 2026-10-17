import type { BufferGeometry } from 'three';
import { createModelLibrary } from '@wildshard/game/plugin/geometry';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import * as v from 'valibot';
import { LayoutRowsSchema, layoutReviver } from './layoutBake';

/** Adopt the exact prepared prop at its former load phase; the caller owns this geometry. */
export async function loadCast(name: string): Promise<BufferGeometry> {
  const bytes = await (await loadFirstPartyProduct('nine-dragon-stack')).file('geometry/cast-channels.json');
  const channels = v.parse(v.pipe(v.array(v.strictObject({ name: v.string(), source: v.string(), width: v.number() })), v.maxLength(16)),
    JSON.parse(new TextDecoder().decode(bytes)));
  const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
    geometryPools: [{ url: `/assets/nine-dragon/baked/casts/${name}.glb`, parts: [name], channels }],
  }, `Nine ${name}`);
  await library.preload();
  const geometry = library.geometry(name, { borrow: true });
  if (geometry === null) throw new Error(`Nine prepared cast ${name} did not load`);
  return geometry;
}

/** Recorded fixed additions; their source author and the geometry are generated together. */
export async function loadFixedRows(): Promise<{ signs: v.InferOutput<typeof LayoutRowsSchema>['signs']; lanterns: number[][] }> {
  const bytes = await (await loadFirstPartyProduct('nine-dragon-stack')).file('geometry/fixed-kits.json');
  return v.parse(v.strictObject({ signs: LayoutRowsSchema.entries.signs, lanterns: v.array(v.array(v.number())) }),
    JSON.parse(new TextDecoder().decode(bytes), layoutReviver));
}
