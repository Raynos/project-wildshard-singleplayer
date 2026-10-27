import * as v from 'valibot';

/** Build-time topology ordinals and the optional shared grid emitted by the SDK whole-shape producer. */
export interface WholePartitionRows {
  id: string; vertices: number[]; triangles: number[]; vertexCount: number; indexCount: number; index: 'none' | 'u16' | 'u32';
  grid?: { origin: [number, number, number]; step: number };
}
/** Portable source channels accepted by an offline float-channel reconstruction. */
export interface WholeSourceChannel {
  semantic: string; storage: 'Float32Array' | 'Int16Array' | 'Int8Array' | 'Uint8Array'; normalized: boolean; itemSize: number;
}
const ordinal = v.pipe(v.number(), v.integer(), v.minValue(0));
const ordinals = v.union([v.array(ordinal), v.pipe(v.strictObject({ runs: v.array(ordinal) }),
  v.check(row => row.runs.length % 2 === 0 && row.runs.every((n, i) => i % 2 === 0 || n > 0)
    && row.runs.reduce((sum, n, i) => sum + (i % 2 === 1 ? n : 0), 0) <= 1 << 24),
  v.transform(row => { const result: number[] = []; for (let i = 0; i < row.runs.length; i += 2) {
    const start = row.runs[i] ?? 0, count = row.runs[i + 1] ?? 0;
    for (let k = 0; k < count; k++) result.push(start + k);
  } return result; }))]);
const partition = v.strictObject({ id: v.string(), vertices: ordinals, triangles: ordinals,
  vertexCount: v.pipe(ordinal, v.minValue(1)), indexCount: ordinal, index: v.picklist(['none', 'u16', 'u32']),
  grid: v.exactOptional(v.strictObject({ origin: v.tuple([v.pipe(v.number(), v.finite()), v.pipe(v.number(), v.finite()), v.pipe(v.number(), v.finite())]),
    step: v.pipe(v.number(), v.minValue(1 / 4096), v.maxValue(1)) })) });
const channels = v.record(v.string(), v.pipe(v.strictObject({ semantic: v.string(), storage: v.picklist(['Float32Array', 'Int16Array', 'Int8Array', 'Uint8Array']),
  normalized: v.boolean(), itemSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)) }),
v.check(row => row.storage === 'Float32Array' ? !row.normalized
  : row.storage === 'Int16Array' ? row.semantic === 'POSITION' && row.itemSize === 3 && !row.normalized
    : row.storage === 'Int8Array' ? row.semantic === 'NORMAL' && row.itemSize === 3 && row.normalized
      : row.semantic === 'COLOR_0' && row.normalized)));

/** Strict topology/grid intake; retains the original bounded ordinal-run expansion. */
export function parseWholePartition(input: unknown): WholePartitionRows { return v.parse(partition, input); }
/** Only the SDK's portable native/compact float-reconstruction channel forms. */
export function parseWholeSourceChannels(input: unknown): Record<string, WholeSourceChannel> { return v.parse(channels, input); }
