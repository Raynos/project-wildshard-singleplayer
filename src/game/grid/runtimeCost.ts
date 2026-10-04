import * as v from 'valibot';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';

const mb = v.pipe(v.number(), v.finite(), v.minValue(0));
/** Reviewed trusted-runtime measurements, kept with their shard rather than presenting an empty data budget as its cost. */
export const RuntimeCostSchema = v.strictObject({
  webContentMB: mb, glMB: mb, engineBaseMB: mb,
  rev: v.pipe(v.string(), v.regex(/^[a-f0-9]{9,40}$/u)),
  device: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  evidence: v.pipe(v.string(), v.regex(/^progress\/memory\/[a-zA-Z0-9/_-]+\.json$/u)),
});
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
