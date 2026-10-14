import { SKY_SPOTS } from './questPrompts';
import { SKY_NATIVE_POPULATION } from './population';
import { ROC_OWNER } from './rocFight';
import { DECK, SPAWN } from './layout';
import { SKY_ANALYTIC_FLOOR } from './spawns';
import { SKY_MOVER_BINDING, SKY_CLIENT_MOTION, SKY_NATIVE_MOVER_COMPOSITION } from './moverBindings';
import { FAN_ID, SKY_ITEM_ROLE } from './items';

/** Native collision, spawn and motion facts; the shared host installs their original owners. */
export const SKY_NATIVE_WORLD = { runtime: { weapon: { id: FAN_ID, stowOnBoard: true, worldReactionAction: 2 }, quest: { spots: { interact: SKY_SPOTS, crack: [] }, summons: [] }, columns: true }, population: { rows: SKY_NATIVE_POPULATION, sources: 'actors', seed: 'identity', owner: ROC_OWNER }, terrain: 'none', floor: 'solids', ground: { size: 500, height: SKY_ANALYTIC_FLOOR },
  player: { at: [SPAWN.x, DECK, SPAWN.z], yaw: SPAWN.yaw, speed: 5 }, motion: {
    ...SKY_CLIENT_MOTION, skipPrefix: SKY_MOVER_BINDING.staticPrefix,
    composition: SKY_NATIVE_MOVER_COMPOSITION.content, rules: SKY_NATIVE_MOVER_COMPOSITION.rules, itemRole: SKY_ITEM_ROLE,
    observations: [{ name: 'winch-up', mover: SKY_MOVER_BINDING.winch }],
    actions: [{ name: 'winch', mover: SKY_MOVER_BINDING.winch, command: 1 }],
  } } as const;
