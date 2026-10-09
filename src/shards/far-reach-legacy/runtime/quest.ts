import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import type { QuestData } from '@wildshard/game/shardfile/quests';
import { DeclaredQuests } from '@wildshard/game/quest/declared';
import { DECK, NOTES, ROOST_RAYS, VANES, WINCH } from '../data/layout';
import { KEEPER_AT } from '../data/quests';
import { FLAGS, vaneFlag } from '../quest/flags';

/** The script command actor that carries Sky's [E] prompts (`{ kind: 'script', actorId: SKY_INTERACT, value: SKY_ACT.* }`). */
export const SKY_INTERACT = 'far.interact';
/** The prompts a command's value names: the keeper's talk, the lectern's notes and the winch. */
export const SKY_ACT = { talk: 0, notes: 1, winch: 2 } as const;
/** The quest keeper's fixed-step id (its whole state is flags, so it carries no continuation of its own). */
export const QUEST_STEP = 'far.quest';
/** The browser player's eye above the feet (engine Player EYE): prompts pick by eye distance (Interactables.pickInteractable). */
const EYE = 1.68;
/**
 * The prompts where the built world places them: the keeper's head 1.8 m over Sunrest's deck with the quest presentation's
 * 3.5 m talk radius (quest/keeper.ts, quest/install.ts), the lectern 1.3 m over its stand at 2.6 m and the winch drum
 * 1.2 m over its deck at 3 m (world/build.ts `notesAt`, `winchAt`).
 */
const PROMPTS = {
  [SKY_ACT.talk]: { at: new Vector3(KEEPER_AT.x, DECK + 1.8, KEEPER_AT.z), radius: 3.5 },
  [SKY_ACT.notes]: { at: new Vector3(NOTES.x, NOTES.y + 1.3, NOTES.z), radius: 2.6 },
  [SKY_ACT.winch]: { at: new Vector3(WINCH.x, WINCH.y + 1.2, WINCH.z), radius: 3 },
} as const;
const MAX_COMMANDS = 1024;
/** The roost's rays and the vanes are finite authored rows; refuse overflow rather than read past the bound. */
const MAX_ROWS = 64;
/** The roost's three rays (runtime/flock.ts ids, layout ROOST_RAYS order). */
export const ROOST_IDS: readonly string[] = ROOST_RAYS.map((_, i) => `far.roost.${String(i)}`);

/** The winch bridge as the quest drives it: queue the winch's raise, and read whether its pose is up. */
export interface SkyWinch { readonly command: () => void; readonly raised: () => boolean }
/** What the quest keeper is lent: the admitted quest rows, the tick's script commands, the effect ports and the winch. */
export interface SkyQuestPorts {
  readonly quests: QuestData;
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  /** The winch bridge's mover. */
  readonly winch: SkyWinch;
}

/** The winch's permission bits, as the browser hands its mover (runtime/index.ts): the roost quiet 1, the vanes turning 2. */
export function skyWinchPermission(flags: Pick<SimHost['flags'], 'has'>): number {
  return Number(flags.has(FLAGS.roost)) + Number(flags.has(FLAGS.vanes)) * 2;
}

/**
 * "The crown bridge" in the renderer-free host (SF72): the declared quest rows through the game's declared quest path
 * (`DeclaredQuests` on `host.flags`, its `far-reach.quest` fact and 10 coins once through the platform's effect ports), and
 * the browser's own step rules (runtime/index.ts): (1) the keeper's talk (his first dialogue sets the notes flag) or the
 * lectern's notes; (2) the roost clears once its three rays are down and the notes are read; (3) the vanes, each turned by
 * a GUST through quest/vanes.ts (runtime/fan.ts), complete the step once all three turn; (4) the winch answers only with
 * the roost quiet and the vanes turning, and the step completes when the winch bridge's pose comes up. Prompts are `script`
 * commands at the browser's radii from the player's eye; their line-of-sight check is not modelled (they stand in the open).
 */
export function installSkyQuest(host: SimHost, ports: SkyQuestPorts): DeclaredQuests {
  if (ROOST_IDS.some(id => host.entities.get(id) === undefined)) throw new Error('Sky Reach installs its quest after the roost rays');
  const quests = new DeclaredQuests(host, ports.quests, { fact: ports.fact, coins: ports.coins });
  const flags = host.flags, eye = new Vector3();
  const near = (prompt: { at: Vector3; radius: number }): boolean => {
    eye.copy(host.player.position); eye.y += EYE;
    return prompt.at.distanceTo(eye) < prompt.radius;
  };
  const act = (value: number): void => {
    if (value === SKY_ACT.talk) { if (near(PROMPTS[SKY_ACT.talk]) && !flags.has(FLAGS.notes)) flags.set(FLAGS.notes); return; }
    if (value === SKY_ACT.notes) { if (near(PROMPTS[SKY_ACT.notes])) flags.set(FLAGS.notes); return; }
    if (value !== SKY_ACT.winch || !near(PROMPTS[SKY_ACT.winch]) || ports.winch.raised()) return;
    // the browser toasts "locked" otherwise; nothing moves
    if (flags.has(FLAGS.roost) && flags.has(FLAGS.vanes)) ports.winch.command();
  };
  const vaneFlags = VANES.map(vane => vaneFlag(vane.id));
  if (vaneFlags.length > MAX_ROWS || ROOST_IDS.length > MAX_ROWS) throw new RangeError('Sky quest rows exceed their finite bound');
  const roostDown = (): boolean => {
    for (let i = 0; i < MAX_ROWS; i++) { const id = ROOST_IDS[i]; if (id === undefined) break; if (host.entities.get(id)?.alive !== false) return false; }
    return true;
  };
  const vanesTurned = (): boolean => {
    for (let i = 0; i < MAX_ROWS; i++) { const flag = vaneFlags[i]; if (flag === undefined) break; if (!flags.has(flag)) return false; }
    return true;
  };
  host.onStep(QUEST_STEP, () => {
    const list = ports.commands();
    for (let i = 0; i < MAX_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      if (command.actorId === SKY_INTERACT) act(command.value);
    }
    if (flags.has(FLAGS.notes) && !flags.has(FLAGS.roost) && roostDown()) flags.set(FLAGS.roost);
    if (!flags.has(FLAGS.vanes) && vanesTurned()) flags.set(FLAGS.vanes);
    if (!flags.has(FLAGS.raised) && ports.winch.raised()) flags.set(FLAGS.raised);
  });
  return quests;
}
