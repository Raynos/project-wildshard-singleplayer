import * as v from 'valibot';
import { isJsonData } from './json';
import { parseSpawnScript, type SpawnScriptRows } from './spawnScripts';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0));
const radius = v.pipe(nonnegative, v.maxValue(1000));
const text = v.pipe(v.string(), v.maxLength(4096));
const definition = v.strictObject({ id, name: text, epithet: text,
  lair: v.strictObject({ x: finite, z: finite, r: radius }),
  awareR: radius, engageR: radius, leashR: radius,
  rule: v.picklist(['always', 'dusk', 'night', 'storm']), respawnMin: nonnegative,
  once: v.exactOptional(v.boolean()), signature: text, phase2: text,
  drop: v.strictObject({ skin: v.nullable(id), skinName: text, weapon: id, blurb: text, trophyName: v.exactOptional(text) }),
});
const observation = v.strictObject({ field: id, source: v.picklist([
  'engaged', 'leashing', 'phase2', 'clock', 'god', 'dusk', 'night',
]) });
const schema = v.strictObject({
  step: id, version: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  bounds: v.tuple([finite, finite, finite, finite]),
  streams: v.strictObject({ spawn: id, fight: id, pickup: id }),
  ordinary: v.record(id, v.pipe(v.array(id), v.minLength(1), v.maxLength(64))),
  legacy: v.exactOptional(v.strictObject({ versions: v.array(v.pipe(v.number(), v.safeInteger(), v.minValue(1))), scripts: id, stun: id, upgrades: v.array(v.strictObject({ version: v.pipe(v.number(), v.integer()), bindInstalled: v.boolean(), clearStun: v.boolean(), remove: v.array(id), defaults: v.record(id, v.record(id, v.union([finite, v.boolean(), v.null()]))) })) })),
  view: v.exactOptional(v.strictObject({
    puffPool: v.strictObject({ capacity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16)), segments: v.tuple([v.pipe(v.number(), v.integer(), v.minValue(3), v.maxValue(64)), v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(64))]), order: finite }),
    tellColor: v.tuple([finite, finite, finite]), puffColor: v.tuple([finite, finite, finite]),
    cues: v.array(v.strictObject({ id, voice: v.exactOptional(id), trauma: v.exactOptional(v.pipe(finite, v.minValue(0), v.maxValue(1))), signature: v.exactOptional(v.boolean()),
      effect: v.exactOptional(v.variant('kind', [
        v.strictObject({ kind: v.literal('puff'), at: v.picklist(['body', 'head']), height: finite, speed: nonnegative,
          size: nonnegative, lifetime: nonnegative, opacity: v.pipe(finite, v.minValue(0), v.maxValue(1)) }),
        v.strictObject({ kind: v.literal('dirt'), height: finite, count: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(256)) }),
      ])),
    })),
  })),
  fights: v.pipe(v.array(v.strictObject({
    def: definition, kind: id, variant: id, main: id, spawn: id, program: v.unknown(),
    observations: v.pipe(v.array(observation), v.maxLength(16)),
    forces: v.record(id, finite), defaultForce: finite,
    modes: v.pipe(v.array(id), v.minLength(1), v.maxLength(32)),
    mode: id,
    legacy: v.strictObject({
      fields: v.pipe(v.array(v.strictObject({ field: id, slot: id, kind: v.picklist(['number', 'boolean']),
        never: v.exactOptional(finite) })), v.maxLength(16)),
      rivals: v.pipe(v.array(v.strictObject({ slot: id, field: id, charge: id })), v.maxLength(4)),
      actorPrefix: id, phase: id, hidden: v.exactOptional(id), lanes: v.array(v.strictObject({ slot: id, strike: id })), rivalMode: finite,
    }),
  })), v.minLength(1), v.maxLength(8)),
});
type RawRows = v.InferOutput<typeof schema>;
/** Named encounter content and v1 actor programs. Every observation names a platform fact, never a shard hook. */
export type EliteFeatureRows = Omit<RawRows, 'fights'> & {
  fights: (Omit<RawRows['fights'][number], 'program'> & { program: SpawnScriptRows })[];
};
/** Admit identities, historical slot mappings and actor ownership before installing any encounter. */
export function parseEliteFeature(input: unknown): EliteFeatureRows {
  if (!isJsonData(input)) throw new Error('Elite feature must be plain JSON');
  const rows = v.parse(schema, input);
  if (rows.bounds[0] >= rows.bounds[1] || rows.bounds[2] >= rows.bounds[3]
    || new Set(rows.fights.map(row => row.def.id)).size !== rows.fights.length) throw new Error('Invalid elite feature bounds or identity');
  const fights = rows.fights.map(fight => {
    const program = parseSpawnScript(fight.program), recipe = program.spawns.find(row => row.id === fight.spawn);
    const site = program.sites.find(row => row.id === recipe?.site), species = program.species.find(row => row.id === recipe?.species);
    if (site?.slot !== fight.main || species?.kind !== fight.kind || species.variant !== fight.variant
      || new Set(fight.modes).size !== fight.modes.length) throw new Error('Invalid elite main identity');
    if (!program.slots.some(slot => slot.id === fight.main) || !program.spawns.some(spawn => spawn.id === fight.spawn)
      || !program.script.state.some(slot => slot.name === fight.mode)
      || fight.observations.some(row => !program.fields.some(field => field.id === row.field && field.source === 'observed'))
      || fight.legacy.fields.some(row => !program.script.state.some(slot => slot.name === row.slot))
      || fight.legacy.rivals.some(row => !program.slots.some(slot => slot.id === row.slot))) throw new Error('Missing elite program reference');
    return { ...fight, program };
  });
  return { ...rows, fights };
}
