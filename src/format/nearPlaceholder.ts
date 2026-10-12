import * as v from 'valibot';
import type { FilesSchema } from './shardSections';
import type { CommonsCosts } from './commonsCosts';
import { isJsonData } from './json';

/**
 * G342 presentation limits, raised to the measured bakes (2026-10-12, `scripts/bake/near-placeholder.mjs`). Round 3's
 * dense ground (the height field's ~2 m lattice reduced to 0.5 m error) is 1.4–1.9 MB resident a cell (the L1-density
 * ground was 0.77 MB) and a whole cell 5.5–8.1 MB (Pine's 40k props and forest of stand-in trees the most), under the
 * bake's 8.5 MB per-cell ceiling (`@wildshard/sdk/bake/placeholders`'s `NEAR_BAKE.residentBytes`, raised from 6 MB with coordinator approval); four cells at
 * most, 34 MB in all on the near residency line inside the 1.0 GB Explorer envelope. Content may rise again only with a
 * measured budget.
 */
export const NEAR_PLACEHOLDER_LIMITS = Object.freeze({ terrainBytes: 2_500_000, contentBytes: 6_000_000,
  cells: 4, residentBytes: 34_000_000, terrainFiles: 16, contentFiles: 32 });
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const address = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(3));
/** Visual L1 terrain and optional authored low-LOD meshes; never simulation or collider roots. */
export const NearPlaceholderSchema = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only near placeholder'),
  v.strictObject({ version: v.literal(1),
    terrain: v.pipe(v.array(v.strictObject({ x: address, z: address, file: hash })), v.maxLength(NEAR_PLACEHOLDER_LIMITS.terrainFiles)),
    content: v.pipe(v.array(hash), v.maxLength(NEAR_PLACEHOLDER_LIMITS.contentFiles)) }),
  v.check(row => (row.terrain.length === 0 || row.terrain.length === NEAR_PLACEHOLDER_LIMITS.terrainFiles) &&
    new Set(row.terrain.map(tile => `${tile.x}/${tile.z}`)).size === row.terrain.length &&
    new Set([...row.terrain.map(tile => tile.file), ...row.content]).size === row.terrain.length + row.content.length &&
    row.terrain.length + row.content.length > 0, 'complete terrain, unique roots and nonempty near placeholder'));
/** Admitted immutable near presentation; missing sections retain ordinary far proxies. */
export type NearPlaceholder = v.InferOutput<typeof NearPlaceholderSchema>;
/** Persistent decoded/GPU bytes and wire bytes of a deduplicated visual closure. */
export interface NearPlaceholderCost { readonly resident: number; readonly compressed: number; readonly triangles: number; readonly draws: number }
type FileRow = v.InferOutput<typeof FilesSchema>[number];
interface Inventory { readonly files: readonly FileRow[]; readonly requires: { readonly commonsCosts: CommonsCosts; readonly commonsWire: Readonly<Record<string, number>> } }

/** All render-only bundle roots, in declared terrain then content order. */
export function nearPlaceholderRoots(near: NearPlaceholder | undefined): string[] {
  return near === undefined ? [] : [...near.terrain.map(tile => tile.file), ...near.content];
}

/** Charge every visual dependency once; refuse missing roots, executable content and oversized tiers before fetch. */
export function nearPlaceholderCost(near: NearPlaceholder, inventory: Inventory): {
  readonly terrain: NearPlaceholderCost; readonly content: NearPlaceholderCost; readonly total: NearPlaceholderCost;
} {
  const files = new Map(inventory.files.map(file => [file.hash, file]));
  if (files.size !== inventory.files.length) throw new Error('Near placeholder has duplicate file identities');
  for (const tile of near.terrain) {
    const file = files.get(tile.file);
    if (file?.kind !== 'binary' || file.dependencies.length > 0 || file.critical)
      throw new Error('Near terrain requires an independent noncritical binary tile');
  }
  for (const ref of near.content) {
    const file = files.get(ref);
    if (file?.kind !== 'glb' || file.critical) throw new Error('Near content requires a noncritical GLB');
  }
  const closure = (roots: readonly string[]): Set<string> => {
    const visited = new Set<string>(), active = new Set<string>(), pending = roots.map(id => ({ id, leave: false }));
    while (pending.length > 0) {
      const next = pending.pop(); if (next === undefined) continue;
      if (next.leave) { active.delete(next.id); visited.add(next.id); continue; }
      if (active.has(next.id)) throw new Error('Near placeholder dependency cycle');
      if (visited.has(next.id)) continue;
      if (next.id.startsWith('commons:')) {
        if (inventory.requires.commonsCosts[next.id.slice(8)] === undefined || inventory.requires.commonsWire[next.id.slice(8)] === undefined)
          throw new Error('Near placeholder misses its declared commons cost');
        visited.add(next.id); continue;
      }
      const file = files.get(next.id);
      if (file === undefined) throw new Error('Near placeholder has a missing dependency');
      if (file.kind === 'wasm' || file.kind === 'audio' || file.critical)
        throw new Error('Near placeholder dependencies are noncritical visual assets');
      active.add(next.id); pending.push({ id: next.id, leave: true });
      for (const id of file.dependencies) pending.push({ id, leave: false });
    }
    return visited;
  };
  const sum = (refs: ReadonlySet<string>): NearPlaceholderCost => {
    let resident = 0, compressed = 0, triangles = 0, draws = 0;
    for (const ref of refs) {
      const shared = ref.startsWith('commons:') ? inventory.requires.commonsCosts[ref.slice(8)] : undefined;
      const row = shared ?? files.get(ref);
      if (row === undefined) throw new Error('Near placeholder has no admitted cost');
      resident += row.decoded + row.gpu; triangles += row.triangles; draws += row.draws;
      compressed += ref.startsWith('commons:') ? inventory.requires.commonsWire[ref.slice(8)] ?? 0 : files.get(ref)?.compressed ?? 0;
    }
    if (![resident, compressed, triangles, draws].every(Number.isSafeInteger)) throw new Error('Near placeholder cost exceeds safe integers');
    return { resident, compressed, triangles, draws };
  };
  const terrainRefs = closure(near.terrain.map(tile => tile.file)), contentRefs = closure(near.content);
  const terrain = sum(terrainRefs), content = sum(contentRefs), total = sum(new Set([...terrainRefs, ...contentRefs]));
  if (terrain.resident > NEAR_PLACEHOLDER_LIMITS.terrainBytes || content.resident > NEAR_PLACEHOLDER_LIMITS.contentBytes)
    throw new Error('Near placeholder exceeds its terrain or content residency limit');
  return { terrain, content, total };
}

