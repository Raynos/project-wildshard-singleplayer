import * as v from 'valibot';
import { MoverTrackSchema, MoverTriggerSchema, MoverDriverSchema, lowerMoverMotion } from './moverMotion';

const finite = v.pipe(v.number(), v.finite()), coordinate = v.pipe(finite, v.minValue(-250), v.maxValue(250));
const vector = v.strictObject({ x: coordinate, y: coordinate, z: coordinate });
const angle = v.pipe(finite, v.minValue(-Math.PI), v.maxValue(Math.PI));
const euler = v.strictObject({ x: angle, y: angle, z: angle });
const positive = v.pipe(finite, v.minValue(0.005), v.maxValue(250));
const quaternion = v.pipe(v.strictObject({ x: finite, y: finite, z: finite, w: finite }), v.check((q) => Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-5));
const box = v.strictObject({ x: coordinate, y: coordinate, z: coordinate, hx: positive, hy: positive, hz: positive, rot: quaternion });
const chain = v.strictObject({ segments: v.pipe(v.array(v.strictObject({ x: coordinate, y: coordinate, z: coordinate, rot: quaternion, hz: positive })), v.minLength(2), v.maxLength(40)), hx: positive, hy: positive, mass: v.pipe(finite, v.minValue(0.1), v.maxValue(1000)) });
/** Physics owns the primitive; an admitted script owns its pose/activation. All colliders are numeric, local boxes. */
export const MoversSchema = v.pipe(v.array(v.strictObject({ id: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128)), entity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), module: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)), kind: v.picklist(['platform', 'chain', 'static']), at: vector, euler, enabled: v.boolean(), boxes: v.pipe(v.array(box), v.maxLength(128)), chain: v.exactOptional(chain), track: v.exactOptional(MoverTrackSchema), trigger: v.exactOptional(MoverTriggerSchema), driver: v.exactOptional(MoverDriverSchema), input: v.pipe(v.array(v.pipe(finite, v.minValue(-10000), v.maxValue(10000))), v.maxLength(64)) })), v.maxLength(32));
/** Validated mover declarations; no render object, collision callback or authored TypeScript occurs in the format. */
export type MoverData = v.InferOutput<typeof MoversSchema>;
/** Admission proves identity, primitive shape and aggregate solver/body limits before allocating anything. */
export function parseMovers(input: unknown): MoverData {
  const data = v.parse(MoversSchema, input);
  if (new Set(data.map((m) => m.id)).size !== data.length || new Set(data.map((m) => m.entity)).size !== data.length) throw new Error('Duplicate mover identity');
  if (data.reduce((n, m) => n + (m.chain?.segments.length ?? 0), 0) > 40) throw new Error('Mover chain body cap');
  for (const m of data) if (m.kind === 'chain' ? m.chain === undefined || m.boxes.length > 0 : m.chain !== undefined || m.boxes.length === 0) throw new Error('Mover primitive shape');
  return data.map(row => {
    const { track, trigger, driver, ...compiled } = row;
    if (track !== undefined || trigger !== undefined || driver !== undefined) {
      const lowered = lowerMoverMotion({ ...(track === undefined ? {} : { track }), trigger, driver }, row);
      if (lowered.module !== row.module || JSON.stringify(lowered.input) !== JSON.stringify(row.input)) throw new Error('Mover motion and executable ABI disagree');
    }
    return compiled;
  });
}
