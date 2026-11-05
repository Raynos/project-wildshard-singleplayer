import * as v from 'valibot';
import { WeatherProgramSchema, WeatherReactionsSchema, parseWeatherProgram, parseWeatherReactions,
  type WeatherProgram, type WeatherReactionRows } from './weatherProgram.ts';
import { DecisionScriptsSchema, parseDecisionScripts } from './decisionScripts.ts';

/** A continuation and the admitted reaction program that reads its registers. */
export interface WeatherBundle {
  readonly weather: WeatherProgram;
  readonly reactions: WeatherReactionRows;
}

/** Complete streamed weather input. Cross-program references use the same
 * semantic admission as the native continuation and reaction owners. */
export const WeatherBundleSchema: v.GenericSchema<unknown, WeatherBundle> = v.strictObject({
  weather: WeatherProgramSchema,
  reactions: v.strictObject({ ...WeatherReactionsSchema.entries, script: DecisionScriptsSchema.pipe[2].item }),
});

/** Validate both complete programs before a caller creates either owner. */
export function parseWeatherBundle(input: unknown): WeatherBundle {
  const rows = v.parse(WeatherBundleSchema, input);
  const weather = parseWeatherProgram(rows.weather);
  const reactions = parseWeatherReactions(rows.reactions, weather);
  parseDecisionScripts([reactions.script]);
  return { weather, reactions };
}

/** Existing wire forms: a phase program alone, or the same program paired
 * with its reaction guest. Both retain their complete native admission. */
export const WeatherDocumentSchema: v.GenericSchema<unknown, WeatherProgram | WeatherBundle> = v.union([WeatherProgramSchema, WeatherBundleSchema]);

/** Admit either complete native weather wire without changing its representation. */
export function parseWeatherDocument(input: unknown): WeatherProgram | WeatherBundle {
  const rows = v.parse(WeatherDocumentSchema, input);
  return 'weather' in rows ? parseWeatherBundle(rows) : parseWeatherProgram(rows);
}
