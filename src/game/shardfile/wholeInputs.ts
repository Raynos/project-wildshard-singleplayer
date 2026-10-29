import type { Shardfile } from '@wildshard/format/shardSchema';

/** Ordered native whole-intake inputs. A named assembly also reads its
 * declared whole library; explicit-reference callers bypass this default. */
export function wholeGeometryInputs(props: Shardfile['props'], includeLibrary: boolean): readonly string[] {
  return [...props?.tiles.filter(row => row.lod === 0).flatMap(row => [row.file].concat(row.additionalFiles ?? [])) ?? [],
    ...includeLibrary ? props?.wholeLibrary ?? [] : []];
}
