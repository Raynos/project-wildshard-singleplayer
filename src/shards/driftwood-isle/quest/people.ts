import { NpcRig, type NpcRow } from '@wildshard/game/systems/npc/npcRig';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { Castaway, loadWendellFace, type Pos } from '../npc/Castaway';
import { Trader, TRADER_NEAR_R } from '../npc/Trader';

interface CastawayArgs { sky: Sky; feet: Pos; fire: Pos }
export const CASTAWAY_ROW: NpcRow<Castaway, CastawayArgs> = {
  id: 'castaway', idle: 'fire-tend', near: Infinity,
  rig: { skeleton: 'castaway.pivots.v1', clips: ['idle.fire-tend'], sockets: [] },
  model: ({ sky, feet, fire }) => new Castaway(sky, feet, fire).build(),
  face: { load: loadWendellFace, target: (model) => model.faceMesh },
};
export const TRADER_ROW: NpcRow<Trader, Sky> = {
  id: 'trader', idle: 'counter', near: TRADER_NEAR_R,
  rig: { skeleton: 'trader.pivots.v1', clips: ['idle.counter'], sockets: [] },
  model: (sky) => new Trader(sky).build(), visible: (model, near) => { model.setNear(near); },
};
export const castawayRig = (sky: Sky, feet: Pos, fire: Pos): NpcRig<Castaway, CastawayArgs> => new NpcRig(CASTAWAY_ROW, { sky, feet, fire });
export const traderRig = (sky: Sky): NpcRig<Trader, Sky> => new NpcRig(TRADER_ROW, sky);
