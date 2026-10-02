import { CreatureBrain, StrikeRunner, NO_FUR, type Animal, type SpeciesLook, type SpeciesRow, type StrikeContext, type StrikeSpec, type ThinkCtx } from '#engine';
import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
import { STRINGS } from '../strings';
import { placed, skinParts } from './skin';
import { slot } from './skitterer';

/** The strider's numbers (metres, m/s, seconds). */
export const STRIDE = { notice: 24, charge: 17, walk: 1.1, approach: 2.4, homeR: 16, lose: 40, face: 0.7 } as const;
/** The charge: a long lane, telegraphed by a 1.1 s paw (the front leg lifts and stamps), committed at 11 m/s. */
export const CHARGE: StrikeSpec = { id: 'sunscar.strider.charge', shape: { kind: 'lane', length: 13, width: 2.2 }, windup: 1.1, active: 1.2, recover: 1.8, cooldown: 3.5,
  range: STRIDE.charge, damage: 22, tags: ['creature.duneStrider'], motion: { speed: 11, overshoot: 3 }, weight: (c) => Math.hypot(c.target.x - c.actor.position.x, c.target.z - c.actor.position.z) > 5 ? 2 : 0.2 };
/** Up close: a sweep of the horns. */
export const HORNS: StrikeSpec = { id: 'sunscar.strider.horns', shape: { kind: 'arc', radius: 3.4, halfAngle: 0.9 }, windup: 0.6, active: 0.2, recover: 0.8, cooldown: 1.6,
  range: 3.2, damage: 12, tags: ['creature.duneStrider'], weight: () => 1 };

type StrideState = 'graze' | 'notice' | 'fight';
/**
 * Grazes slowly round its home, notices a walker, turns to face them, then fights: a pawed, committed charge from
 * range (it skids and stands winded after, the time to whip it), a horn sweep up close.
 */
export class StriderBrain extends CreatureBrain<StrideState> {
  private readonly strikes = new StrikeRunner();
  private clock = 0; private readonly homeX: number; private readonly homeZ: number;
  constructor(actor: Animal) { super(actor, ['graze', 'notice', 'fight']); this.homeX = actor.position.x; this.homeZ = actor.position.z; }
  private context(ctx: ThinkCtx): StrikeContext {
    const a = this.actor; return { actor: a, target: ctx.player, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); } };
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (ctx.calm || (this.state !== 'graze' && d > STRIDE.lose)) { if (this.state !== 'graze') this.transition('graze'); return; }
    if (this.state === 'graze' && (d < STRIDE.notice || a.hp < a.maxHp)) { this.transition('notice'); this.clock = 0; }
    if (this.state === 'fight' && !this.strikes.busy && ctx.reach(a) && ctx.claim(a)) {
      const c = this.context(ctx), pick = this.strikes.pick([CHARGE, HORNS], c); if (pick) this.strikes.start(pick, a, ctx.player);
    }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    this.clock += ctx.dt; this.strikes.update(ctx.dt, this.context(ctx));
    const toPlayer = Math.atan2(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    a.mem['paw'] = this.strikes.state === 'windup' && this.strikes.spec?.id === CHARGE.id ? 1 : 0;
    a.mem['winded'] = this.strikes.state === 'recover' && this.strikes.spec?.id === CHARGE.id ? 1 : 0;
    if (this.strikes.busy && this.strikes.state !== 'cooldown') return; // the runner drives the body
    if (this.state === 'graze') {
      // Amble round home on a slow circle of its own.
      const ang = ctx.t * 0.05 + slot(a, 6), tx = this.homeX + Math.sin(ang) * STRIDE.homeR, tz = this.homeZ + Math.cos(ang) * STRIDE.homeR;
      ctx.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), STRIDE.walk, 0.8); return;
    }
    if (this.state === 'notice') {
      ctx.steer(a, toPlayer, 0, 2.2);
      if (this.clock > STRIDE.face) this.transition('fight');
      return;
    }
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    ctx.steer(a, toPlayer, d > STRIDE.charge * 0.8 ? STRIDE.approach : 0, 2);
  }
}
const brains = new WeakMap<Animal, StriderBrain>();
const brain = (a: Animal): StriderBrain => { let value = brains.get(a); if (!value) { value = new StriderBrain(a); brains.set(a, value); } return value; };

export const DUNE_STRIDER: SpeciesRow = { id: 'sunscar.creature.duneStrider', kind: 'duneStrider', label: STRINGS.strider, aggressive: true, blood: false,
  variants: [{ id: 'dusk', label: STRINGS.strider, weight: 1, rarity: 'uncommon', scale: [0.95, 1.1], hp: 150 }],
  think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

const HIDE: [number, number, number] = [0.26, 0.13, 0.08], DARK: [number, number, number] = [0.12, 0.06, 0.04], HORN: [number, number, number] = [0.42, 0.34, 0.24];
const LEGS: readonly [string, number, number][] = [['legFL', -0.42, 0.75], ['legFR', 0.42, 0.75], ['legBL', -0.42, -0.8], ['legBR', 0.42, -0.8]];
/** A tall, slab-bodied grazer on four long legs, a hump, a low neck and a broad horned head. */
export function striderGeometry(): ReturnType<typeof skinParts> {
  const parts = [
    { geometry: placed(new IcosahedronGeometry(0.75, 1), 0, 2.05, 0, [0.85, 0.75, 1.6]), color: HIDE, bone: 0 },
    { geometry: placed(new IcosahedronGeometry(0.45, 0), 0, 2.55, -0.2, [1, 0.8, 1.3]), color: DARK, bone: 0 },
    { geometry: placed(new CylinderGeometry(0.22, 0.32, 1.1, 6), 0, 2.15, 1.35, [1, 1, 1], [1.1, 0, 0]), color: HIDE, bone: 1 },
    { geometry: placed(new BoxGeometry(0.5, 0.42, 0.7), 0, 1.95, 1.95), color: DARK, bone: 1 },
    { geometry: placed(new ConeGeometry(0.09, 0.9, 5), 0.35, 2.3, 1.85, [1, 1, 1], [0.6, 0, -0.9]), color: HORN, bone: 1 },
    { geometry: placed(new ConeGeometry(0.09, 0.9, 5), -0.35, 2.3, 1.85, [1, 1, 1], [0.6, 0, 0.9]), color: HORN, bone: 1 },
    { geometry: placed(new ConeGeometry(0.1, 0.9, 4), 0, 1.9, -1.55, [1, 1, 1], [-2.2, 0, 0]), color: DARK, bone: 6 },
  ];
  LEGS.forEach(([, x, z], i) => {
    parts.push({ geometry: placed(new CylinderGeometry(0.09, 0.13, 1.0, 5), x, 1.35, z), color: HIDE, bone: 2 + i });
    parts.push({ geometry: placed(new CylinderGeometry(0.06, 0.08, 0.95, 5), x, 0.48, z), color: DARK, bone: 2 + i });
  });
  return skinParts(parts);
}
const bones = (): { name: string; parent: string | null; pos: [number, number, number] }[] => [
  { name: 'body', parent: null, pos: [0, 2.0, 0] }, { name: 'head', parent: 'body', pos: [0, 2.2, 1.0] },
  ...LEGS.map(([name, x, z]): { name: string; parent: string; pos: [number, number, number] } => ({ name, parent: 'body', pos: [x, 1.85, z] })),
  { name: 'tail', parent: 'body', pos: [0, 2.0, -1.2] },
];
export const DUNE_STRIDER_LOOK: SpeciesLook = { id: 'sunscar.look.duneStrider', species: DUNE_STRIDER.id, kind: 'duneStrider', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.duneStrider', sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR', 'tail'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => ({ bones: bones(), furParts: [], hardParts: [striderGeometry()], eyeParts: [],
    dims: { bodyY: 2.0, bodyHalfLen: 1.3, bodyRadius: 0.75, headRadius: 0.4, legLen: 1.85, feet: [], halfWidth: 0.7 } }),
  animate: ({ bones: b, t, alive, deathT, speed, phase, mem }) => {
    const body = b['body'], head = b['head'], tail = b['tail'], paw = mem['paw'] ?? 0, winded = mem['winded'] ?? 0;
    const gait = Math.min(1, Math.abs(speed) / 2) * (speed > 6 ? 0.75 : 0.45), swing = Math.sin(phase * Math.PI * 2);
    LEGS.forEach(([name], i) => {
      const leg = b[name]; if (!leg) return;
      const front = i < 2, side = i % 2 === 0 ? 1 : -1;
      leg.rotation.x = alive ? swing * gait * (front === (i % 2 === 0) ? 1 : -1) : -0.3;
      if (front && side > 0 && paw > 0) leg.rotation.x = -0.9 + Math.abs(Math.sin(t * 9)) * 0.9; // the paw: lift and stamp
      leg.rotation.z = alive ? 0 : side * 0.9 * Math.min(1, Math.max(0, deathT));
    });
    if (body) {
      const base = mem['bodyY'] ?? body.position.y; mem['bodyY'] = base;
      body.position.y = base - (alive ? winded * 0.25 : 1.2 * Math.min(1, Math.max(0, deathT)));
      body.rotation.z = alive ? 0 : 0.25 * Math.min(1, Math.max(0, deathT));
    }
    if (head) head.rotation.x = alive ? (paw > 0 ? 0.35 : 0) + winded * 0.5 + Math.sin(t * 1.3) * 0.05 : 0.7;
    if (tail) tail.rotation.y = alive ? Math.sin(t * 2.1) * 0.3 : 0;
  },
};
