import * as v from 'valibot';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { contentCost } from '@wildshard/engine/core/contentCost';

const mb = v.pipe(v.number(), v.finite(), v.minValue(0));
/** Reviewed trusted-runtime measurements, kept with their shard rather than presenting an empty data budget as its cost. */
export const MemoryMeasurementSchema = v.strictObject({
  webContentMB: mb, glMB: mb, engineBaseMB: mb,
  rev: v.pipe(v.string(), v.regex(/^[a-f0-9]{9,40}$/u)),
  device: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  evidence: v.pipe(v.string(), v.regex(/^progress\/memory\/[a-zA-Z0-9/_-]+\.json$/u)),
});
/** The current runtime measurement may retain its separate images-first reading for cold phone texture selection. */
export const RuntimeCostSchema = v.strictObject({ ...MemoryMeasurementSchema.entries, imagesFirst: v.optional(MemoryMeasurementSchema) });
/** Decimal MB; GL bytes accompany WebContent, never the GPU process as a replacement. */
export type RuntimeCost = v.InferOutput<typeof RuntimeCostSchema>;

/**
 * SF22a / G144: remove the measured engine base and undo the allocator's calibration exactly once. The allocator adds
 * its current engine base and applies residentFactor when this home claim joins libraries, neighbours and the platform.
 * Round upward to whole bytes; no computed cost is stored in the shardfile. Refuse measurements without content.
 */
export function runtimeAccountedBytes(input: unknown): number {
  const row = v.parse(RuntimeCostSchema, input);
  const measured = (row.webContentMB + row.glMB - row.engineBaseMB) * 1_000_000;
  if (measured <= 0) throw new RangeError('Runtime measurement must exceed its engine base');
  const bytes = Math.ceil(measured / CONTENT_CAPS.residentFactor);
  if (!Number.isSafeInteger(bytes)) throw new RangeError('Runtime measurement exceeds safe resident accounting');
  return bytes;
}

/** G188: the same playing model as residency admission, using the images-first measurement even after a KTX2 refresh. */
export function imagesFirstPlayingBytes(input: RuntimeCost | undefined): number | undefined {
  if (input === undefined) return undefined;
  const row = v.parse(RuntimeCostSchema, input);
  return contentCost({ l0: 0, l1: 0, far: 0, libraries: 0, commons: 0,
    sims: runtimeAccountedBytes(row.imagesFirst ?? row), overlap: CONTENT_CAPS.overlap }).playing;
}
