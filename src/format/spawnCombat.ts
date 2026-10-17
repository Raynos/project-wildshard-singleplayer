import * as v from 'valibot';
import { isJsonData } from './json';
import { CreatureStrikeSchema } from './creatures';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const amount = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(60));
/** V1 strike capabilities use the existing contact kernel. Effects and presentation edges are rows, never hooks. */
export const SpawnCombatSchema = v.pipe(v.unknown(), v.check(isJsonData, 'plain JSON scripted strikes'), v.array(v.strictObject({ id, row: CreatureStrikeSchema,
  trauma: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)), stun: amount,
  tell: v.exactOptional(v.picklist(['lane', 'ring'])), startCue: v.exactOptional(id), activeCue: v.exactOptional(id), doneCue: v.exactOptional(id),
})), v.maxLength(32), v.check(rows => new Set(rows.map(row => row.id)).size === rows.length
  && new Set(rows.map(row => row.row.id)).size === rows.length, 'unique scripted strikes'));
export type SpawnCombat = v.InferOutput<typeof SpawnCombatSchema>;
