import type { PhasedBossRow } from '@wildshard/sdk/phasedBoss';
import { DUNGEON, CH, COFFIN, NICHES, STREAMS } from '../world/KurganDungeon';
import { KING_DEF_PHASES, KING_LINES, KING_TUNING } from '../data/goldenKingFight';

/**
 * The Golden King's fight as a platform phased boss row (SHARD-PLATFORM SF27; design docs/design/nalati/elites-and-bosses.md
 * §2): the chamber's frame, his coffin and the shield spot, the eight modes (coffin, rising, fight, toCoffin, shield, stun,
 * kneel, dead), the three phases, the akinakes combo and the sunburst, the plaques and the headdress, the balbal adds,
 * the sunburst rings, the sand pours and the sun beam, and the views the chamber binds (combat/goldenKingViews.ts).
 */
export const GOLDEN_KING_ROW: PhasedBossRow = {
  origin: DUNGEON,
  bounds: CH - 0.9,
  rest: { x: COFFIN.x, z: COFFIN.z, plinth: COFFIN.plinthH, lift: 0.12, halfW: COFFIN.wid / 2, halfL: COFFIN.len / 2, inset: 0.05, focusY: 1.5 },
  shieldSpot: { x: COFFIN.x, z: COFFIN.z + COFFIN.len / 2 + KING_TUNING.shieldOffset },
  enragedFrom: 2,
  phases: [
    { at: KING_DEF_PHASES[0]?.at ?? 1, mem: { cape: 1 } },
    { at: KING_DEF_PHASES[1]?.at ?? 1, mem: { cape: 1 }, resume: { shieldSpot: true, mode: 'shield' },
      enter: { roar: { act: 3, seconds: 1.3 }, line: KING_LINES.wakes, lineFirst: true, mode: 'toCoffin', modeT: -1.3, pourDelay: 2.5 } },
    { at: KING_DEF_PHASES[2]?.at ?? 1, mem: { cape: 0 }, resume: { mem: { cape: 0 }, sweep: true },
      enter: { roar: { act: 4, seconds: 1.4, shed: { field: 'cape', from: 0.45, rate: 4 } }, mode: 'fight', modeT: 0, views: [['arena.shield', 0]],
        pourStop: true, sweep: true, crownReset: true, line: KING_LINES.cloak, cooldowns: { combo: 1.6, burst: 3.5 } } },
  ],
  modes: {
    coffin: { damage: 0, shielded: false, look: 0, glows: false, motion: { kind: 'hold' } },
    rising: { damage: 0, shielded: false, look: 1, glows: false, motion: { kind: 'hold' } },
    fight: { damage: 1, shielded: false, look: 1, glows: true, motion: { kind: 'fight' }, timeouts: [{ seconds: 16, phase: 1, to: 'toCoffin' }] },
    toCoffin: { damage: 0, shielded: true, look: 1, glows: true, motion: { kind: 'goto', spot: 'shield', speed: 2.4, turn: 4, arrive: 0.5, roarTurn: 2, next: 'shield' } },
    shield: { damage: 0, shielded: true, look: 1, glows: true, motion: { kind: 'face', yaw: 0, turn: 1.5 },
      enter: { cancel: true, mem: { act: 0, kneel: 1, raise: 1 }, yaw: 0, motion: [0, 0, 3], lockHp: true, views: [['arena.shield', 1]], wave: true } },
    stun: { damage: 1.25, shielded: false, look: 1, glows: true, motion: { kind: 'face', turn: 1.5 },
      timeouts: [{ seconds: 4, to: 'fight', effect: { mem: { kneel: 0, raise: 0 }, cooldowns: { combo: 0.8 } } }] },
    kneel: { damage: 1.25, shielded: false, look: 1, glows: true, motion: { kind: 'face', turn: 1.5 },
      timeouts: [{ seconds: 3, to: 'fight', effect: { mem: { kneel: 0 }, cooldowns: { combo: 0.6 } } }] },
    dead: { damage: 1, shielded: false, look: 1, glows: true, motion: { kind: 'hold' } },
  },
  modeNames: { rest: 'coffin', rising: 'rising', fight: 'fight', dead: 'dead' },
  attacks: {
    burst: { act: 2, min: 2.2, max: 13, seconds: [2.4, 2.0], fireAt: 0.72, rings: [1, 2], after: [[9, 3], [6.5, 2]], comboFloor: 0.6,
      lines: [KING_LINES.sunburst, KING_LINES.sunburstDouble] },
    combo: { act: 1, reach: KING_TUNING.reach, engage: 0.2, count: [3, 4], seconds: [0.95, 0.78], hitAt: 0.62, chain: 2.5, rest: [1.8, 1.1], above: 2.6,
      cuts: KING_TUNING.strikeDamage.map((damage, i) => i >= 2
        ? { damage, reachMul: 1.1, arc: 1.35, shove: 5, painted: true }
        : { damage, reachMul: 1, arc: 0.95, shove: 3, painted: false }) },
    commit: { windup: 0.45, turn: [1.8, 0.2] },
    chase: { stop: 2.3, speed: [1.75, 2.6], turn: 2.8 },
  },
  fields: { act: 'act', strike: 'strike', hitDone: 'hitDone', floorY: 'floorY', floorS: 'floorS', rise: 'rise', pose: 'pose' },
  reset: {
    mem: { pose: 0, rise: 0, lift: 0, kneel: 0, raise: 0, act: 0, strike: 0, crown: 1, deadT: 0, init: 1, noHeadBar: 1 },
    combo: 1.2, burst: [5, 2], pourDelay: 2,
    drifts: { fromPhase: 2, height: 0.6, cap: 0.8, at: KING_TUNING.drifts },
    views: [['arena.lid.open', 0], ['arena.shaft', 0, 0.38], ['arena.shaft', 1, 0], ['victory.heap', 0]],
    glow: 0.01,
  },
  intro: {
    long: { lid: [0.25, 1.35], rise: [1.25, 3.55], pulse: 3.8 },
    short: { lid: [0, 0.3], rise: [0.15, 1.15], pulse: 1.2 },
    shaft: { index: 0, base: 0.38, amp: 0.45 },
    glow: { base: 0.01, peak: 0.2, lead: 0.8, fade: 0.6 },
  },
  begin: { mem: { pose: 1, rise: 1 }, combo: 0.8, burst: [4, 3], views: [['arena.lid.open', 1]] },
  glow: { base: 0.035, glint: 0.22, charge: 0.45, glintFade: 3, chargeFade: 2, burn: [0.07, 0.04, 6] },
  hits: { head: [0.16, 0.14], armour: { melee: 3.8, breaks: 6, ranged: 0.5, line: KING_LINES.plaques } },
  crown: { hp: KING_TUNING.headdressHp, fromPhase: 2, field: 'crown', to: 'kneel', effect: { cancel: true, mem: { act: 0, kneel: 1 }, line: KING_LINES.headdress } },
  rings: { count: 2, start: 0.8, gap: 0.95, speed: KING_TUNING.ringSpeed, max: KING_TUNING.ringMax, band: 0.5, jump: 0.4, damage: KING_TUNING.sunburstDamage,
    push: 9, pushTime: 0.18, strike: 'sunburst' },
  pour: { spots: STREAMS, phase: 1, every: [3.2, 1.6], tell: 1.0, pour: 6, fadeIn: 3, fadeOut: [5.2, 6], pile: { r: 2.4, rate: 0.2, cap: 0.95 },
    hitRadius: 0.55, hitRate: 2, damage: 4, strike: 'sand', reset: 2 },
  sweep: { radius: KING_TUNING.beamRadius, squash: 0.85, offset: -0.5, speed: 0.24, limit: 2.4, start: -2.2, ease: 1.2, hitRadius: KING_TUNING.beamHitRadius,
    damage: KING_TUNING.beamDamage, every: 1, strike: 'beam', boss: { damage: KING_TUNING.beamToKing, every: 3, extra: 0.3, line: KING_LINES.beamSears } },
  adds: { spots: NICHES, push: 0.55, pairs: [[0, 1], [2, 3]], mode: 'shield', reinforce: 25, retireAfter: 2.4,
    cleared: { to: 'stun', effect: { views: [['arena.shield', 0]], mem: { raise: 0, kneel: 1 }, line: KING_LINES.domeBreaks } } },
  victory: { views: [['arena.shield', 0], ['strike.arc.off'], ['arena.shaft', 0, 0.35], ['arena.shaft', 1, 1.4]], crumble: 1.6, drain: 0.3 },
  views: ['arena.lid.open', 'arena.shaft', 'arena.fx.hide', 'arena.shield', 'arena.shield.at', 'adds.spot', 'boss.glow', 'strike.arc', 'strike.arc.off',
    'hazard.ring', 'hazard.ring.off', 'hazard.ring.tell', 'hazard.pour.off', 'hazard.pour.tell', 'hazard.pour.fall', 'hazard.sweep', 'hazard.sweep.off', 'victory.heap'],
};
