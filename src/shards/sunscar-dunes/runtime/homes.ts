import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { installHomeKeeper, type KeptBossBody, type KeptBossRow, type KeptHome } from '@wildshard/game/shardfile/homeKeeper';
import { challengeGrazer } from '@wildshard/sdk/grazers';
import { patrolDiver } from '@wildshard/sdk/flyers';
import { RAY_BRAIN, STRIDER_BRAIN } from '../data/brains';
import { SIGNAL_SPAWNS } from '../data/spawns';
import { RAY_HOME, SEED } from '../data/layout';
import { DUNE_RAY } from './species/duneRay';
import { DUNE_STRIDER } from './species/strider';
import { SKITTERER_DATA } from './species/skitterer';
import { MATRIARCH_DATA } from './species/matriarch';
import { homeBrain } from './homeBrains';

/** The homes keeper's fixed-step id; its continuation also names the live roster to reinstall before restore. */
export const HOMES_STEP = 'sunscar.homes';
/** The browser's 'legacy' decision band: 10 Hz decisions, bodies every frame (AnimalManager scheduler). */
const THINK = { every: 6, dt: 0.1 } as const;
const SCALES = new Map([DUNE_RAY, SKITTERER_DATA, DUNE_STRIDER, MATRIARCH_DATA].map(row => {
  const variant = row.variants[0]; if (variant === undefined) throw new Error(`Signal species ${row.kind} has no variant`);
  return [row.kind, variant.scale] as const;
}));

/** The Matriarch's handle on her body (the platform keeper's boss body). */
export type SignalBossBody = KeptBossBody;
/** What the headless keeper is lent: the baked native specs, the manifest's attack cap and the quest's "held" gate. */
export interface SignalHomesPorts {
  readonly specs: ReadonlyMap<string, AnimalSimSpec>;
  /** `fight.attackers` from the manifest (E297): at most this many creatures hold an attack token at once. */
  readonly attackers: number;
  /** The ray circles its home without striking until the player has met Sefa (R1B-13). */
  readonly held: () => boolean;
  /** The Matriarch's declared row: her body joins the same manager (stream, tokens, cadence) after the homes. */
  readonly boss?: KeptBossRow;
}

/**
 * The 13 declared homes of Signal Dunes (data/spawns.ts) on the platform's renderer-free home keeper (SF72,
 * `installHomeKeeper`: the level-seeded creature stream, attack tokens, respawn clocks, exact restore), with Signal's
 * shipping policies (runtime/homeBrains.ts: the ray's patrol-diver, the skitterer's own brain, the strider's
 * challenge-grazer, the Matriarch's unique policy) on the browser's 10 Hz decision band, and one gate: the ray (home 0)
 * holds its strikes until the player has met Sefa.
 */
export function installSignalHomes(host: SimHost, ports: SignalHomesPorts, saved?: Readonly<SimSnapshot>): { settle: () => void; homes: () => readonly KeptHome[]; boss: SignalBossBody | null } {
  if (SIGNAL_SPAWNS.homes.length !== 13) throw new Error('Signal declares 13 homes');
  const ray = patrolDiver({ ...RAY_BRAIN, home: { x: RAY_HOME.x, z: RAY_HOME.z } }), strider = challengeGrazer(STRIDER_BRAIN);
  return installHomeKeeper(host, { step: HOMES_STEP, seed: SEED, homes: SIGNAL_SPAWNS.homes, ...(ports.boss === undefined ? {} : { boss: ports.boss }),
    specs: ports.specs, scales: SCALES, attackers: ports.attackers, think: THINK,
    policy: (kind, actor, claim) => homeBrain(kind, actor, { host, ray, strider, claim }),
    beforeStep: homes => { const actor = homes[0]?.actor; if (actor) actor.mem['held'] = ports.held() ? 1 : 0; } }, saved);
}
