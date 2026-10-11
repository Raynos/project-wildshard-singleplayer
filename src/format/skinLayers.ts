import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const trackSchema = v.strictObject({ bone: v.pipe(v.string(), v.maxLength(64)), property: v.picklist(['position', 'rotation', 'scale', 'quaternion']), axis: v.picklist(['x', 'y', 'z']), order: v.picklist(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY']), values: v.pipe(v.array(finite), v.maxLength(300000)) });
/** Independent sampled clocks supplement a base clip; optional phase tables preserve coupled gait and breath. */
export const SkinPoseLayerSchema = v.strictObject({ id: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128)), period: v.pipe(finite, v.minValue(0.01), v.maxValue(120)), times: v.pipe(v.array(finite), v.minLength(2), v.maxLength(4097)), phasePeriod: v.pipe(finite, v.minValue(0.01), v.maxValue(120)), phaseSteps: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(64)), tracks: v.pipe(v.array(trackSchema), v.maxLength(128)) });
/** Callback-free pose samples, bounded and owned by the skin binding. */
export type SkinPoseLayer = v.InferOutput<typeof SkinPoseLayerSchema>;
/** Validate table sizes, periodic endpoints and joint references before compiling float buffers. */
export function validateSkinLayers(layers: readonly SkinPoseLayer[], joints: readonly string[]): void {
  let numbers = 0;
  if (layers.length > 32 || new Set(layers.map((layer) => layer.id)).size !== layers.length) throw new Error('skin layers identities');
  for (const layer of layers) {
    if (layer.times[0] !== 0 || Math.abs((layer.times.at(-1) ?? 0) - layer.period) > 1e-6 || layer.times.some((time, i) => i > 0 && time <= (layer.times[i - 1] ?? 0))) throw new Error('skin layer times');
    const phase = layer.phaseSteps + 1;
    for (const t of layer.tracks) {
      const width = t.property === 'quaternion' ? 4 : 1;
      if (!joints.includes(t.bone) || t.values.length !== layer.times.length * phase * width || (layer.phaseSteps > 0 && width !== 4)) throw new Error('skin layer shape');
      numbers += t.values.length;
      for (let p = 0; p < phase * width; p++) if (Math.abs((t.values[p] ?? 0) - (t.values[(layer.times.length - 1) * phase * width + p] ?? 0)) > 1e-5) throw new Error('skin layer seam');
      if (layer.phaseSteps > 0) for (let frame = 0; frame < layer.times.length; frame++) for (let component = 0; component < 4; component++) if (Math.abs((t.values[frame * phase * 4 + component] ?? 0) - (t.values[(frame * phase + phase - 1) * 4 + component] ?? 0)) > 1e-5) throw new Error('skin layer phase seam');
      if (width === 4) for (let i = 0; i < t.values.length; i += 4) if (Math.abs(Math.hypot(t.values[i] ?? 0, t.values[i + 1] ?? 0, t.values[i + 2] ?? 0, t.values[i + 3] ?? 0) - 1) > 1e-5) throw new Error('skin layer quaternion');
    }
  }
  if (numbers > 500000) throw new Error('skin layer sample cap');
}

/** Charge serialized tables, numeric arrays and per-state cached transforms before compiling layers. */
export function skinLayerDecoded(layers: Readonly<Record<string, readonly SkinPoseLayer[] | undefined>>, joints: number): number {
  let numbers = 0, states = 0;
  for (const data of Object.values(layers)) { if (data === undefined) continue; states++; for (const layer of data) { numbers += layer.times.length; for (const t of layer.tracks) numbers += t.values.length; } }
  if (states === 0) return 0;
  return new TextEncoder().encode(JSON.stringify(layers)).length * 2 + numbers * 12 + joints * 80 * states;
}

