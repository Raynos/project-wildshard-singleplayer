import { Vector3 } from 'three';
import * as v from 'valibot';
import { parseEliteFeature, type EliteFeatureRows } from '@wildshard/format/eliteFeature';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import { EliteCore, EliteCoreContinuationSchema, memoryElitePersistence } from '../eliteSystem';
import { EliteDecisions } from './eliteDecisions';
import { SpawnScript, readSpawnScript } from '../population/spawnScript';
import type { ShardProduct } from '../shardfile/shardProduct';

const finite = v.pipe(v.number(), v.finite());
const uint = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffffffff));
const stream = v.strictObject({ version: v.literal(1), state: uint, initial: uint, scrambledFork: v.boolean() });
const savedScript = v.strictObject({ id: v.string(), program: v.string(), spawn: stream, phase2: v.boolean() });
const root = v.strictObject({ t: v.pipe(finite, v.minValue(0)), x: finite, y: finite, z: finite });

/** Read admitted JSON and exact v1 bytes using the same owned-script catalogue as population directors. */
export async function readEliteFeature(product: ShardProduct, name: string): Promise<EliteFeatureRows> {
  const rows = parseEliteFeature(JSON.parse(new TextDecoder().decode(await product.file(name))));
  const fights = await Promise.all(rows.fights.map(async fight => {
    const program = await readSpawnScript(product, fight.program.step);
    if (JSON.stringify({ ...program, bytes: '' }) !== JSON.stringify({ ...fight.program, bytes: '' })) throw new Error('Elite program catalogue mismatch');
    return { ...fight, program };
  }));
  return { ...rows, fights };
}

/** Native named encounters take only the real simulation/clock authorities and rows. Fight decisions run in v1 guests. */
export function installNativeEliteFeature(host: SimHost, day: DayCycleClock, input: unknown): {
  readonly core: EliteCore<EliteDecisions>; readonly scripts: readonly EliteDecisions[]; readonly initialize: () => void;
} {
  const rows = parseEliteFeature(input);
  if (rows.fights.some(row => row.def.rule === 'storm')) throw new Error('Storm encounter needs an admitted weather owner');
  const core = new EliteCore<EliteDecisions>({ player: host.player, condition: rule => rule === 'always'
    || (rule === 'dusk' ? day.dusk > 0.5 : rule === 'night' ? day.night > 0.5 : false) }, {}, host.level.id, memoryElitePersistence());
  const scripts = rows.fights.map(row => new EliteDecisions(row, SpawnScript.native(host, row.program), rows, host.level.seed));
  for (const script of scripts) core.add(script);
  const saved = v.strictObject({ version: v.literal(rows.version), ...EliteCoreContinuationSchema.entries, scripts: v.array(savedScript), stun: v.nullable(root) });
  let restored: SimValue | undefined, stun: v.InferOutput<typeof root> | null = null;
  const validateRecords = (records: Readonly<Record<string, unknown>>): void => {
    if (Object.keys(records).length !== scripts.length || scripts.some(script => records[script.def.id] === undefined)) throw new Error('Incompatible elite records');
  };
  const held = new Vector3(), direction = new Vector3();
  host.onStep(rows.step, dt => {
    restored = undefined;
    if (stun !== null) { held.set(stun.x, stun.y, stun.z); host.player.position.copy(held); host.player.motor.resetAt(held); stun.t -= dt; if (stun.t <= 0) stun = null; }
    for (const script of scripts) script.frame(host.player.position, day.dusk, day.night, false, host.player.yaw);
    core.update(dt, host.clock.now);
    for (const script of scripts) for (const effect of script.program.drainEffects()) {
      if (effect.kind === 'cue') { if (rows.view?.cues.find(row => row.id === script.program.cue(effect.id))?.signature === true) core.signature(script.def.id); continue; }
      if (effect.kind !== 'hit') continue;
      const body = script.program.body(effect.actor); if (body === null) throw new Error('Missing elite contact body');
      host.combat.hit({ source: body.combatActor(), sourceTags: [`creature.${body.kind}`, 'feel.blow', 'cover.checked'], target: host.player.health,
        amount: effect.hit.damage, point: body.position.clone(), dir: direction.set(0, 0, 0), throughWalls: effect.hit.throughWalls, cause: { kind: body.kind, label: body.label } });
      if (effect.hit.stun > 0) { const p = host.player.position; stun = { t: effect.hit.stun, x: stun?.x ?? p.x, y: stun?.y ?? p.y, z: stun?.z ?? p.z }; }
    }
  }, {
    snapshot: () => restored ?? { version: rows.version, ...core.snapshot(), stun: stun === null ? null : { ...stun }, scripts: scripts.map(script => ({ id: script.def.id,
      program: script.program.snapshot(), spawn: { ...script.spawnStream.snapshot() }, phase2: script.isPhase2 })) },
    restore: wireInput => {
      if (typeof wireInput === 'object' && wireInput !== null && !Array.isArray(wireInput) && 'version' in wireInput && wireInput['version'] !== rows.version) {
        const mapping = rows.legacy, upgrade = mapping?.upgrades.find(row => row.version === wireInput['version']);
        if (mapping === undefined || upgrade === undefined) throw new Error('Unsupported historical elite wire');
        const envelope: v.ObjectEntries = { version: v.literal(upgrade.version), ...EliteCoreContinuationSchema.entries, [mapping.scripts]: v.array(v.record(v.string(), v.unknown())) };
        if (!upgrade.clearStun) envelope[mapping.stun] = v.nullable(root);
        const raw = upgrade.clearStun ? Object.fromEntries(Object.entries(wireInput).filter(([key]) => key !== mapping.stun)) : wireInput;
        const old = v.parse(v.strictObject(envelope), raw), continuation = v.parse(EliteCoreContinuationSchema, old);
        validateRecords(continuation.records);
        const source = v.parse(v.array(v.record(v.string(), v.unknown())), old[mapping.scripts]);
        if (source.length !== scripts.length) throw new Error('Historical elite roster mismatch');
        const commits = source.map((wire, i) => {
          const script = scripts[i]; if (script === undefined) throw new Error('Missing historical elite');
          const fields = v.parse(v.record(v.string(), v.union([finite, v.boolean(), v.null()])), wire['fields']);
          const state = { ...Object.fromEntries(Object.entries(wire).filter(([key]) => !upgrade.remove.includes(key))),
            ...(upgrade.bindInstalled ? { animal: script.animal?.entityId ?? null } : {}), fields: { ...upgrade.defaults[script.def.id], ...fields } };
          if (state.fields[script.row.legacy.phase] !== continuation.entries[i]?.phase2) throw new Error('Historical elite phase mismatch');
          return script.prepareLegacy(state);
        });
        const commit = core.prepareRestore(continuation), nextStun = upgrade.clearStun ? null : v.parse(v.nullable(root), old[mapping.stun]);
        commit(); for (const restore of commits) restore(); stun = nextStun; restored = structuredClone(wireInput); return;
      }
      const state = v.parse(saved, wireInput); validateRecords(state.records);
      const commitCore = core.prepareRestore(state);
      if (state.scripts.length !== scripts.length || state.scripts.some((row, i) => row.id !== scripts[i]?.def.id
        || row.phase2 !== state.entries[i]?.phase2)) throw new Error('Incompatible elite script roster');
      const commits = state.scripts.map((row, i) => {
        const script = scripts[i]; if (script === undefined) throw new Error('Missing elite script');
        return script.prepareRestore(row);
      });
      commitCore(); for (const commit of commits) commit(); stun = state.stun; restored = structuredClone(wireInput);
    },
  });
  return { core, scripts, initialize: () => { core.initialize(); } };
}
