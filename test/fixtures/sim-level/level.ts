import { BOAR } from '@wildshard/game/systems/species/boar';
import { IRON_SWORD } from '@wildshard/kit/weapons/equipment';
import type { SimCommand, SimLevel } from '@wildshard/engine/sim';

/** A real shared species and iron sword on plain flat ground, with no shard runtime or renderer. */
export const SIM_LEVEL: SimLevel = {
  version: 1, id: 'sim-fixture', seed: 435,
  ground: { size: 32, height: 0 }, player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 3 },
  weapon: { id: IRON_SWORD.id, shape: { kind: 'arc', radius: 2.2, halfAngle: Math.PI / 2 },
    windup: 0.07, active: 0.165, recover: 0.115, cooldown: 0.08, range: 2.2, damage: 28, tags: ['weapon.sword-iron', 'dmg.melee'] },
  entities: [{ id: 'boar:1', seed: 7, scale: 1, at: { x: 0, y: 0, z: 1.6 }, yaw: Math.PI,
    spec: { kind: BOAR.kind, label: BOAR.label, variant: 'boar', rarity: 'common', hp: BOAR.tuning?.hp ?? 100,
      aggressive: BOAR.aggressive ?? false, lockable: BOAR.lockable ?? false,
      dims: { bodyY: 0.6, bodyHalfLen: 0.55, bodyRadius: 0.35, headRadius: 0.2, legLen: 0.55, feet: [], halfWidth: 0.35 },
      mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: BOAR.chargeDamage ?? 25, relentless: false } },
    strike: { id: 'boar.charge', shape: { kind: 'point', radius: 2 }, windup: BOAR.chargeWindup ?? 0.55,
      active: 0.15, recover: 0.8, cooldown: 1, range: 2, damage: BOAR.chargeDamage ?? 25, tags: ['creature.boar'] } }],
  quests: [{ id: 'clear-arena', title: 'Clear arena', steps: [{ id: 'boar', objective: 'Defeat the boar', done: { all: ['dead:boar:1'] } }], completeFlag: 'quest:arena' }],
};
/** Recorded fixture fight: spaced attacks include pending windup, contact and recovery windows. */
export function fightCommand(tick: number): SimCommand {
  return { moveX: 0, moveZ: 0, yaw: 0, ...(tick % 90 === 0 ? { attack: { targetId: 'boar:1' } } : {}) };
}
