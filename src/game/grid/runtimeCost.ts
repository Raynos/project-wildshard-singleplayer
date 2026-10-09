import * as v from 'valibot';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { contentCost, type ContentCostInput } from '@wildshard/engine/core/contentCost';

const mb = v.pipe(v.number(), v.finite(), v.minValue(0));
/** Reviewed trusted-runtime measurements, kept with their shard rather than presenting an empty data budget as its cost. */
export const MemoryMeasurementSchema = v.strictObject({
  webContentMB: mb, glMB: mb, engineBaseMB: mb,
  /** Matched settled pre-entry resident set. When present, subtract it instead of the dated engine-only calibration. */
  residentBaseMB: v.exactOptional(mb),
  rev: v.pipe(v.string(), v.regex(/^[a-f0-9]{9,40}$/u)),
  device: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  evidence: v.pipe(v.string(), v.regex(/^progress\/memory\/[a-zA-Z0-9/_-]+\.json$/u)),
});
/** The current runtime measurement may retain its separate images-first reading for cold phone texture selection. */
export const RuntimeCostSchema = v.strictObject({ ...MemoryMeasurementSchema.entries, imagesFirst: v.optional(MemoryMeasurementSchema) });
/** Decimal MB; GL bytes accompany WebContent, never the GPU process as a replacement. */
export type RuntimeCost = v.InferOutput<typeof RuntimeCostSchema>;

/**
 * SF22a / G144 / G258: remove the matched resident baseline (or legacy engine base) and undo the allocator's calibration exactly once. The allocator adds
 * its current engine base and applies residentFactor when this home claim joins libraries, neighbours and the platform.
 * Round upward to whole bytes; no computed cost is stored in the shardfile. Refuse measurements without content.
 */
export function runtimeAccountedBytes(input: unknown): number {
  const row = v.parse(RuntimeCostSchema, input);
  const baseline = row.residentBaseMB ?? row.engineBaseMB;
  if (baseline < row.engineBaseMB) throw new RangeError('Runtime resident baseline must include its engine base');
  const measured = (row.webContentMB + row.glMB - baseline) * 1_000_000;
  if (measured <= 0) throw new RangeError('Runtime measurement must exceed its resident baseline');
  const bytes = Math.ceil(measured / CONTENT_CAPS.residentFactor);
  if (!Number.isSafeInteger(bytes)) throw new RangeError('Runtime measurement exceeds safe resident accounting');
  return bytes;
}

/** G188: images-first playing envelope. Grid callers include their current residents; omitted residents retain standalone Auto. */
export function imagesFirstPlayingBytes(input: RuntimeCost | undefined, residents?: Readonly<ContentCostInput>): number | undefined {
  if (input === undefined) return undefined;
  const row = v.parse(RuntimeCostSchema, input);
  const base = residents ?? { l0: 0, l1: 0, far: 0, libraries: 0, commons: 0, sims: 0, overlap: CONTENT_CAPS.overlap };
  return contentCost({ ...base, sims: base.sims + runtimeAccountedBytes(row.imagesFirst ?? row) }).playing;
}

/**
 * SF57: a reviewed reading of what one admitted regional shardfile sim really keeps resident (JS heap, its buffers and its
 * share of Rapier's linear memory, the generated ground included; its checkpoint basis is charged separately as
 * `sim-basis:`). The declared `budgets.sim.resident` stays the validated authoring ceiling (scripts at their growth limit);
 * this row only replaces the ceiling in the allocator's charge, and never raises it.
 */
export const RegionalSimCostSchema = v.strictObject({
  residentMB: v.pipe(mb, v.minValue(0.001)),
  rev: v.pipe(v.string(), v.regex(/^[a-f0-9]{9,40}$/u)),
  device: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  evidence: v.pipe(v.string(), v.regex(/^progress\/memory\/[a-zA-Z0-9/_-]+\.json$/u)),
});
/** Decimal MB, measured per admitted regional sim. */
export type RegionalSimCost = v.InferOutput<typeof RegionalSimCostSchema>;

/**
 * The bytes a regional shardfile sim charges: its measured resident reading with the calibration undone once (the allocator
 * applies `residentFactor` again in the predicted total), plus the platform-installed extras the reading did not include,
 * never more than the declared ceiling. Without a reviewed reading the declared ceiling is the charge.
 */
export function regionalSimAccountedBytes(declaredIdentity: string, declaredBytes: number, extraBytes: number, manifest: { readonly slug: string; readonly regionalSimCost?: RegionalSimCost } | undefined): number {
  if (!Number.isSafeInteger(declaredBytes) || declaredBytes <= 0 || !Number.isSafeInteger(extraBytes) || extraBytes < 0) throw new RangeError('Invalid regional sim cost');
  const ceiling = declaredBytes + extraBytes;
  if (manifest?.regionalSimCost === undefined) return ceiling;
  const { slug: registeredIdentity } = manifest;
  if (registeredIdentity !== declaredIdentity) throw new Error('Regional sim measurement differs from its shard');
  const row = v.parse(RegionalSimCostSchema, manifest.regionalSimCost);
  const measured = Math.ceil(row.residentMB * 1_000_000 / CONTENT_CAPS.residentFactor);
  if (!Number.isSafeInteger(measured)) throw new RangeError('Regional sim measurement exceeds safe resident accounting');
  return Math.min(ceiling, measured + extraBytes);
}
