import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import type { QuestData } from '@wildshard/game/shardfile/quests';
import { DeclaredQuests } from '@wildshard/game/quest/declared';
import { SCOUT_AT, SCOUT_FLAG } from '../data/flags';
import { SignalInteractions } from './interactions';

/** The script command actor that carries Signal's interactions (`{ kind: 'script', actorId, value: SIGNAL_ACT.* }`). */
export const SIGNAL_INTERACT = 'sunscar.interact';
/** The interactions' fixed-step adapter id (transient well / oil / brazier / fire state). */
export const INTERACTIONS_STEP = 'sunscar.interactions';
/**
 * The interaction indices a command's value names: the browser's [E] prompts (talk, logbook, well, one per waymark, the
 * tower fire) and the whip's cracks on the world (the crank's double crack, one per waymark bowl).
 */
export const SIGNAL_ACT = { talk: 0, logbook: 1, well: 2, pour: 3, fire: 6, crank: 100, light: 101 } as const;
/** The browser player's eye above the feet (engine Player EYE): prompts pick by eye distance (Interactables.pickInteractable). */
const EYE = 1.68;
/** Sefa's talk: her head stands 1.62 m over her feet (quest/scout.ts) and her prompt reaches 3.5 m (quest/install.ts). */
const SEFA_HEAD = 1.62, SEFA_RADIUS = 3.5;
/** The whip row's light / heavy reach (data/items.ts): a crack reaches a world target this far, plus its radius. */
export interface SignalCrackReach { readonly light: number; readonly heavy: number }
/** One baked spot (scripts/bake-signal-physics.mjs): where the built world placed a prompt or a crack target. */
export interface SignalSpot { readonly id: string; readonly x: number; readonly y: number; readonly z: number; readonly radius: number }
export interface SignalSpots { readonly interact: readonly SignalSpot[]; readonly crack: readonly SignalSpot[] }
/** What the quest keeper is lent: the admitted quest rows, the baked spots, the whip's reach and the platform's effect ports. */
export interface SignalQuestPorts {
  readonly quests: QuestData;
  readonly spots: SignalSpots;
  readonly braziers: number;
  readonly reach: SignalCrackReach;
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  /** The world target the whip's crack reached this tick (runtime/whip.ts `cracked`): a crack command lands only then. */
  readonly cracked: () => number | null;
  /** The signal fire caught (the browser's `fire.onLight`): the Matriarch's summons. */
  readonly lit?: () => void;
}
const MAX_COMMANDS = 1024;

/**
 * "The signal" in the renderer-free host (SF72): the declared quest rows through the game's declared quest path
 * (`DeclaredQuests` on `host.flags`, its fact and five coins through the platform's effect ports), and the actual
 * interaction rules (`SignalInteractions`) driven by `script` commands at the browser's prompt radii from the player's
 * eye, at the spots the built world placed (baked). Sefa's talk sets the scout flag; the well's crank needs the whip's
 * heavy double crack (its second lash pulls); a waymark lights on a crack once oiled (both cracks are the whip item's,
 * gated by its cooldown); the tower fire lights by hand once
 * all three burn. The prompts' line-of-sight check is not modelled (the spots stand in the open).
 */
export function installSignalQuest(host: SimHost, ports: SignalQuestPorts): { quests: DeclaredQuests; interactions: SignalInteractions } {
  const n = ports.braziers, interact = ports.spots.interact, crack = ports.spots.crack;
  if (interact.length !== n + 3 || crack.length !== n + 1 || SIGNAL_ACT.fire !== SIGNAL_ACT.pour + n) throw new Error('Signal spots do not match the declared waymarks');
  const quests = new DeclaredQuests(host, ports.quests, { fact: ports.fact, coins: ports.coins });
  const interactions = new SignalInteractions(host.flags, n), eye = new Vector3(), at = new Vector3();
  const near = (spot: SignalSpot | undefined, reach = 0): boolean => {
    if (spot === undefined) return false;
    eye.copy(host.player.position); eye.y += EYE;
    return at.set(spot.x, spot.y, spot.z).distanceTo(eye) < spot.radius + reach;
  };
  const sefa = (): boolean => {
    eye.copy(host.player.position); eye.y += EYE;
    return at.set(SCOUT_AT.x, host.groundHeightAt(SCOUT_AT.x, SCOUT_AT.z) + SEFA_HEAD, SCOUT_AT.z).distanceTo(eye) < SEFA_RADIUS;
  };
  const act = (value: number): void => {
    if (value === SIGNAL_ACT.talk) { if (sefa() && !host.flags.has(SCOUT_FLAG)) host.flags.set(SCOUT_FLAG); return; }
    if (value === SIGNAL_ACT.logbook) { if (near(interact[0])) interactions.readLogbook(); return; }
    if (value === SIGNAL_ACT.well) { if (near(interact[1])) interactions.takeOil(); return; }
    if (value >= SIGNAL_ACT.pour && value < SIGNAL_ACT.fire) { const i = value - SIGNAL_ACT.pour; if (near(interact[2 + i])) interactions.pour(i); return; }
    if (value === SIGNAL_ACT.fire) { if (near(interact[n + 2]) && interactions.allLit && interactions.lightFire()) ports.lit?.(); return; }
    // the double crack's first lash wraps the crank and its second pulls (world/build.ts); a light crack only rattles it
    // a crack lands only if the whip fired on it this tick (its row's cooldown gates it, as the browser's crack)
    if (value === SIGNAL_ACT.crank) { if (ports.cracked() === value && near(crack[0], ports.reach.heavy)) interactions.pullWell(); return; }
    if (value >= SIGNAL_ACT.light && value < SIGNAL_ACT.light + n) { const i = value - SIGNAL_ACT.light; if (ports.cracked() === value && near(crack[1 + i], ports.reach.light)) interactions.light(i); }
  };
  host.onStep(INTERACTIONS_STEP, () => {
    const list = ports.commands();
    for (let i = 0; i < MAX_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      if (command.actorId === SIGNAL_INTERACT) act(command.value);
    }
  }, { snapshot: () => interactions.snapshot(), restore: value => { interactions.restore(v.parse(v.string(), value)); } });
  return { quests, interactions };
}
