import * as v from 'valibot';
import { isJsonData } from './json';
import { LightEmittersSchema } from './lightEmitters';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128), v.regex(/^[a-zA-Z][a-zA-Z0-9.-]*$/u));
/** Client-only declarations select compiled platform features, never modules, owners or property paths. */
export const ClientFeatureSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('strings.register') }),
  v.strictObject({ kind: v.literal('world.scenes') }),
  v.strictObject({ kind: v.literal('light.emitters'), rows: LightEmittersSchema }),
  v.strictObject({ kind: v.literal('debug.expose'), name: id }),
]);
/** Rows are unordered. Phase, rank and lifetime belong exclusively to the compiled registry. */
export const ClientPlanSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Client plan requires plain JSON'), v.strictObject({ version: v.literal(1), features: v.pipe(v.array(ClientFeatureSchema), v.maxLength(64)) }),
  v.check(plan => new Set(plan.features.map(row => row.kind === 'debug.expose' ? `${row.kind}:${row.name}` : row.kind)).size === plan.features.length, 'Duplicate client feature'));
export type ClientPlan = v.InferOutput<typeof ClientPlanSchema>;
export type ClientFeatureRow = ClientPlan['features'][number];
export type ClientFeatureKind = ClientFeatureRow['kind'];
/** Strict admission rejects unknown kinds and executable/reflected settings before installing any feature. */
export function parseClientPlan(input: unknown): ClientPlan { return v.parse(ClientPlanSchema, input); }
