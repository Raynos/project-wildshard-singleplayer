import { Rng } from '@wildshard/engine/core/rng';
import { WeightedTable } from '@wildshard/engine/ai/weighted';
import { ENEMY_SPECIES_METADATA } from './enemySpecies';
import { BOAR } from '@wildshard/game/systems/species/boar';
import { BEAR } from '@wildshard/game/systems/species/bear';
import physics from '../data/physics.generated.json' with { type: 'json' };
import { DRIFTWOOD_NATIVE_FAUNA } from './nativeFauna';
import type { enemyPlacements } from './enemyPlacement';
import type { NativeKeeperRows } from '../sim/baked';
import ecology from '../data/ecology.json' with { type: 'json' };

/** Compile immutable roster joins and initial rolls; live floors and later spawns remain keeper-owned.
 * Each enemy checkpoint is the creature stream immediately before its original materialization. */
export function keeperRows(placement: ReturnType<typeof enemyPlacements>): Omit<NativeKeeperRows, 'fauna'> & { fauna: typeof DRIFTWOOD_NATIVE_FAUNA } {
  const fauna = DRIFTWOOD_NATIVE_FAUNA, source = physics.actors.filter(row => row.kind === 'boar' || row.kind === 'bear');
  if (placement.seed !== fauna.seed || source.length !== fauna.rows.length || source.some((actor, i) => {
    const row = fauna.rows[i]; return row === undefined || row.id !== actor.id || row.herd !== actor.herd || row.seed !== actor.seed;
  })) throw new Error('Fauna placement diverges from the authored boot');
  const tables = new Map([['crab', ENEMY_SPECIES_METADATA.crab.variants], ['sailor', ENEMY_SPECIES_METADATA.sailor.variants],
    ['monkey', ENEMY_SPECIES_METADATA.monkey.variants], ['boar', BOAR.variants], ['bear', BEAR.variants]]);
  const variants = [...tables].map(([kind, rows]) => ({ kind, rows: rows.map(row => ({ id: row.id, scale: row.scale })) }));
  const bodies: NativeKeeperRows['bodies'] = source.map(actor => {
    const at = fauna.rows.find(row => row.id === actor.id); if (at === undefined) throw new Error('Missing authored fauna');
    return { id: actor.id, kind: actor.kind, variant: actor.variant, herd: actor.herd, x: at.x, z: at.z, yaw: at.yaw,
      seed: actor.seed, scale: actor.scale, fauna: true, practice: false, stream: null };
  });
  const rng = new Rng(fauna.seed + 31); rng.restore(fauna.stream);
  for (const [i, row] of placement.native.enemies.entries()) {
    const table = tables.get(row.kind); if (table === undefined) throw new Error('Missing enemy variants');
    const variant = row.variant ?? new WeightedTable({ mode: 'weighted', rows: table.map(item => ({ item, weight: item.weight })) }).pick(undefined, rng.next())?.item.id;
    const range = table.find(item => item.id === variant)?.scale;
    if (variant === undefined || range === undefined) throw new Error('Enemy rolled no variant');
    const scale = rng.range(range[0], range[1]); rng.next(); const seed = rng.next(); rng.next(); rng.next(); rng.next();
    bodies.push({ id: `creature:${String(source.length + i)}`, kind: row.kind, variant,
      herd: row.herd < 0 ? -1 : row.herd + fauna.centres.length, x: row.x, z: row.z, yaw: row.yaw,
      seed, scale, fauna: false, practice: row.practice === true, stream: { ...rng.snapshot(), version: 1 } });
  }
  const herds: NativeKeeperRows['herds'] = physics.herds.slice(0, fauna.centres.length).map((row, i) => {
    const at = fauna.centres[i]; if (at === undefined) throw new Error('Missing fauna herd');
    return { kind: row.kind, x: at[0], z: at[1] };
  });
  placement.native.centres.forEach((at, i) => { herds.push({ kind: physics.herds[fauna.centres.length + i]?.kind ?? 'crab', x: at.x, z: at.z }); });
  if (herds.length !== physics.herds.length || bodies.length !== 34 || bodies.filter(row => row.practice).length !== 1) throw new Error('Divergent keeper boot roster');
  return { seed: fauna.seed, volley: placement.volley, ecology, fauna, variants, herds, bodies };
}
