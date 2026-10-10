import { EliteScriptLane, parseEliteScript, stepEliteScript, type EliteScriptBody as PlatformBody, type EliteScriptData,
  type EliteScriptPorts as PlatformPorts, type EliteScriptStep as PlatformStep } from '@wildshard/game/shardfile/eliteScripts';
import { moduleBytes } from '@wildshard/game/shardfile/speciesScripts';

/** An elite fight script's row (SHARD-PLATFORM SF27): its module's SHA-256, parameters, slots, modes, voices, lanes, contacts and actions. */
export type EliteScriptRow = EliteScriptData;
/** The body an elite script drives. */
export type EliteScriptBody = PlatformBody;
/** One engaged step's view of the fight. */
export type EliteScriptStep<B extends EliteScriptBody> = PlatformStep<B>;
/** What the script's verbs do in the shard's world. */
export type EliteScriptPorts = PlatformPorts;
/** One elite's admitted fight script: its slots and its decisions. */
export type EliteScript = EliteScriptLane;

/**
 * Admit one elite's fight script (SF27): the row passes its strict schema, the module (the base64 its bake wrote,
 * scripts/bake/species-scripts.mjs) its SHA-256 and the ABI-v0 ceilings on its own ScriptHost; `random` is the elite's own
 * seeded stream (the script's query 2).
 */
export function eliteScript(row: EliteScriptRow, base64: string, random: () => number): EliteScript {
  return new EliteScriptLane(parseEliteScript(row), moduleBytes(base64), random);
}
/** One engaged step: the row's lanes step, then the script's one pure call, then its verbs in order through `ports`. */
export function stepElite<B extends EliteScriptBody>(script: EliteScript, step: EliteScriptStep<B>, ports: EliteScriptPorts): void {
  stepEliteScript(script, step, ports);
}
