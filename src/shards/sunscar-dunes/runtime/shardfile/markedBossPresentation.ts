import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(200));
/**
 * A marked boss fight's browser presentation as a row (SHARD-PLATFORM SF27, SF7f): the arena `floor` its reward burst
 * leaves from; where a player death in the fight returns them (`respawn`, on the ground there); its storm's look — a
 * weather fog of `dist` per metre in `color` closing in eased with the fight's storm strength, and blown-sand shells
 * (`[radius m, opacity]`, the first coarse, the rest fine) riding with the player, their streaks running down `wind`;
 * and its toasts (the summons, the first fall's reward and a later fall's). The boss bar and the name card are the
 * engine's `BossBar`.
 */
export const MarkedBossPresentationSchema = v.strictObject({
  floor: finite,
  respawn: v.strictObject({ x: finite, z: finite, yaw: finite }),
  storm: v.strictObject({ dist: v.pipe(finite, v.minValue(0)), color: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(0xffffff)),
    shells: v.pipe(v.array(v.tuple([v.pipe(finite, v.minValue(0)), v.pipe(finite, v.minValue(0), v.maxValue(1))])), v.maxLength(4)),
    wind: v.strictObject({ x: finite, z: finite }) }),
  toasts: v.strictObject({ summoned: text, reward: text, rewardAgain: text }),
});
/** A validated marked boss presentation row (`MarkedBossPresentationSchema`). */
export type MarkedBossPresentation = v.InferOutput<typeof MarkedBossPresentationSchema>;
/** Compile an authored marked boss presentation row; an unknown field refuses. */
export function parseMarkedBossPresentation(input: unknown): MarkedBossPresentation { return v.parse(MarkedBossPresentationSchema, input); }
