import type { SimHost } from '@wildshard/engine/sim';
import type { QuestData } from '@wildshard/game/shardfile/quests';
import { DeclaredQuests } from '@wildshard/game/quest/declared';
import { installInteractionRows, InteractionRules, type InteractionSpot } from '@wildshard/game/quest/interactionRows';
import { SCOUT_AT } from '../data/flags';
import { SIGNAL_INTERACT, SIGNAL_INTERACTIONS } from '../quests/interactions';

/** The interactions' fixed-step adapter id (transient well / oil / brazier / fire marks). */
export const INTERACTIONS_STEP = 'sunscar.interactions';
/** Sefa's talk: her head stands 1.62 m over her feet (quest/scout.ts) and her prompt reaches 3.5 m (quest/install.ts). */
const SEFA_HEAD = 1.62, SEFA_RADIUS = 3.5;
/** One baked spot (scripts/bake-signal-physics.mjs): where the built world placed a prompt or a crack target. */
export interface SignalSpot extends InteractionSpot { readonly id: string }
export interface SignalSpots { readonly interact: readonly SignalSpot[]; readonly crack: readonly SignalSpot[] }
/** What the quest keeper is lent: the admitted quest rows, the baked spots, the whip's reach and the platform's effect ports. */
export interface SignalQuestPorts {
  readonly quests: QuestData;
  readonly spots: SignalSpots;
  readonly reach: { readonly light: number; readonly heavy: number };
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  /** The world target the whip's crack reached this tick (runtime/whip.ts `cracked`): a crack row lands only then. */
  readonly cracked: () => number | null;
  /** The signal fire caught (the browser's `fire.onLight`): the Matriarch's summons. */
  readonly lit?: () => void;
}

/**
 * "The signal" in the renderer-free host (SF72): the declared quest rows through the game's declared quest path
 * (`DeclaredQuests` on `host.flags`, its fact and five coins through the platform's effect ports), and the declared
 * interaction rows (quests/interactions.ts) through the platform's interaction step, at the spots the built world placed
 * (baked; a crack target's id is `crack.<id>`) and Sefa's head over the ground.
 */
export function installSignalQuest(host: SimHost, ports: SignalQuestPorts): { quests: DeclaredQuests; rules: InteractionRules } {
  const quests = new DeclaredQuests(host, ports.quests, { fact: ports.fact, coins: ports.coins });
  const rules = new InteractionRules(host.flags, SIGNAL_INTERACTIONS);
  const scout = { x: SCOUT_AT.x, y: host.groundHeightAt(SCOUT_AT.x, SCOUT_AT.z) + SEFA_HEAD, z: SCOUT_AT.z, radius: SEFA_RADIUS };
  const spots = Object.fromEntries([['scout', scout], ...ports.spots.interact.map(s => [s.id, s] as const), ...ports.spots.crack.map(s => [`crack.${s.id}`, s] as const)]);
  installInteractionRows(host, rules, { actorId: SIGNAL_INTERACT, stepId: INTERACTIONS_STEP, spots, commands: ports.commands,
    crack: { reach: ports.reach, cracked: ports.cracked }, done: row => { if (row === 'fire') ports.lit?.(); } });
  return { quests, rules };
}
