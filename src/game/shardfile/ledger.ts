import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const natural = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const positive = v.pipe(natural, v.minValue(1));
const origin = v.strictObject({ kind: v.picklist(['engine', 'script']), source: id });
const catalogue = v.strictObject({ kind: v.literal('catalogue'), item: id, tier: natural, quantity: v.pipe(positive, v.maxValue(100)) });
const achievement = v.strictObject({ kind: v.literal('achievement'), id, title: id, threshold: v.pipe(positive, v.maxValue(100_000)) });

/** Facts carry host-assigned identity and provenance; cell coordinates never participate. */
export const LedgerFactSchema = v.strictObject({ instance: id, shard: id, revision: positive, entity: id, tick: natural, ordinal: natural, name: id, origin });
/** One witnessed engine/script outcome, with a stable six-part identity. */
export type LedgerFact = v.InferOutput<typeof LedgerFactSchema>;
/** Profile rewards are approved catalogue objects or achievements/titles; shard coins are excluded. */
export const LedgerRulesSchema = v.pipe(v.array(v.strictObject({ fact: id, origin, rewards: v.pipe(v.array(v.variant('kind', [catalogue, achievement])), v.minLength(1), v.maxLength(16)) })), v.maxLength(128), v.check((rules) => new Set(rules.map((rule) => rule.fact)).size === rules.length, 'unique fact mappings'));
/** Data mapping declared facts to platform-controlled profile rewards. */
export type LedgerRule = v.InferOutput<typeof LedgerRulesSchema>[number];
/** Validate compiled author data before the platform binds its allowed reward mappings. */
export function parseLedgerRules(input: unknown): LedgerRule[] { return v.parse(LedgerRulesSchema, input); }

