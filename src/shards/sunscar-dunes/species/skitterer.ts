import { CreatureBrain, StrikeRunner, NO_FUR, type Animal, type SpeciesLook, type SpeciesRow, type StrikeContext, type StrikeSpec, type ThinkCtx } from '#engine';
import { BoxGeometry, ConeGeometry, IcosahedronGeometry } from 'three';
import { STRINGS } from '../strings';
import { placed, skinParts } from './skin';

/** The pack numbers (metres, m/s, seconds). */
export const SKITTER = { wake: 13, sleep: 34, burst: 0.55, run: 5.6, ring: 2.2, retreat: 1.1, rebury: 5 } as const;
/** The bite: a short point strike after a rear-up telegraph. */
export const BITE: StrikeSpec = { id: 'sunscar.skitterer.bite', shape: { kind: 'point', radius: 1.4 }, windup: 0.38, active: 0.15, recover: 0.45, cooldown: 1.3,
  range: 1.9, damage: 6, tags: ['creature.sandSkitterer'], weight: () => 1 };

/** A stable small integer per animal (its seed hashed), so pack members pick their own ring angles. */
export const slot = (a: Animal, n: number): number => Math.floor(Math.abs(Math.sin(a.seed * 12.9898 + 1.7) * 43758.5)) % n;

type SkitterState = 'buried' | 'burst' | 'hunt' | 'retreat';
/**
 * Waits under the sand (`mem.burrow` = 1 sinks the body bone), bursts out when the player comes near, runs in on a
 * ring around the player (each one at its own angle, so a pack surrounds), rears and bites, darts back, comes again;
 * left alone it burrows again.
 */
export class SkittererBrain extends CreatureBrain<SkitterState> {
  private readonly strikes = new StrikeRunner();
  private clock = 0; private far = 0;
  constructor(actor: Animal) { super(actor, ['buried', 'burst', 'hunt', 'retreat']); actor.mem['burrow'] = 1; }
  private context(ctx: ThinkCtx): StrikeContext {
    const a = this.actor; return { actor: a, target: ctx.player, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); } };
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
    if (this.state === 'buried' && !ctx.calm && d < SKITTER.wake) { this.transition('burst'); this.clock = 0; }
    if (this.state === 'hunt' && !this.strikes.busy && d < BITE.range && ctx.reach(a) && ctx.claim(a)) {
      const c = this.context(ctx), pick = this.strikes.pick([BITE], c); if (pick) this.strikes.start(pick, a, ctx.player);
    }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) { a.mem['burrow'] = 0; return; }
    this.clock += ctx.dt; this.strikes.update(ctx.dt, this.context(ctx));
    const dx = ctx.player.x - a.position.x, dz = ctx.player.z - a.position.z, d = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz);
    const burrow = a.mem['burrow'] ?? 0;
    if (this.state === 'buried') { a.mem['burrow'] = Math.min(1, burrow + ctx.dt * 1.5); ctx.steer(a, a.yaw, 0, 2); return; }
    if (this.state === 'burst') {
      a.mem['burrow'] = Math.max(0, 1 - this.clock / SKITTER.burst); ctx.steer(a, toPlayer, 0, 6);
      if (this.clock >= SKITTER.burst) this.transition('hunt');
      return;
    }
    a.mem['burrow'] = 0;
    this.far = d > SKITTER.sleep || ctx.calm ? this.far + ctx.dt : 0;
    if (this.far > SKITTER.rebury) { this.transition('buried'); return; }
    if (this.strikes.state === 'recover') { this.transition('retreat'); this.clock = 0; }
    if (this.strikes.busy && this.strikes.state !== 'cooldown') { ctx.steer(a, toPlayer, 0, 8); return; }
    if (this.state === 'retreat') {
      ctx.steer(a, toPlayer + Math.PI + (slot(a, 2) === 0 ? 0.6 : -0.6), SKITTER.run, 7);
      if (this.clock > SKITTER.retreat) this.transition('hunt');
      return;
    }
    // Hunt: close on a point on a small ring around the player, at this skitterer's own angle.
    const angle = slot(a, 7) * 0.9 + ctx.t * 0.4, tx = ctx.player.x + Math.sin(angle) * SKITTER.ring, tz = ctx.player.z + Math.cos(angle) * SKITTER.ring;
    const goal = d < SKITTER.ring * 1.4 ? toPlayer : Math.atan2(tx - a.position.x, tz - a.position.z);
    ctx.steer(a, goal, d < 1.2 ? 0 : SKITTER.run, 8);
  }
}
const brains = new WeakMap<Animal, SkittererBrain>();
const brain = (a: Animal): SkittererBrain => { let value = brains.get(a); if (!value) { value = new SkittererBrain(a); brains.set(a, value); } return value; };

export const SAND_SKITTERER: SpeciesRow = { id: 'sunscar.creature.sandSkitterer', kind: 'sandSkitterer', label: STRINGS.skitterer, aggressive: true, blood: false,
  variants: [{ id: 'dusk', label: STRINGS.skitterer, weight: 1, rarity: 'common', scale: [0.9, 1.1], hp: 24 }],
  think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

const SHELL: [number, number, number] = [0.2, 0.09, 0.05], BELLY: [number, number, number] = [0.32, 0.17, 0.09], LEG: [number, number, number] = [0.12, 0.06, 0.04];
/** A low sand beetle: a domed shell, a wedge head with mandibles, three legs a side, a short barbed tail. */
export function skittererGeometry(): ReturnType<typeof skinParts> {
  const parts = [
    { geometry: placed(new IcosahedronGeometry(0.34, 1), 0, 0.26, 0, [1, 0.5, 1.35]), color: SHELL, bone: 0 },
    { geometry: placed(new BoxGeometry(0.4, 0.1, 0.6), 0, 0.14, 0), color: BELLY, bone: 0 },
    { geometry: placed(new IcosahedronGeometry(0.17, 0), 0, 0.22, 0.5, [1.1, 0.7, 1]), color: SHELL, bone: 1 },
    { geometry: placed(new ConeGeometry(0.04, 0.24, 4), 0.09, 0.18, 0.66, [1, 1, 1], [Math.PI / 2, 0, 0.3]), color: BELLY, bone: 1 },
    { geometry: placed(new ConeGeometry(0.04, 0.24, 4), -0.09, 0.18, 0.66, [1, 1, 1], [Math.PI / 2, 0, -0.3]), color: BELLY, bone: 1 },
    { geometry: placed(new ConeGeometry(0.06, 0.5, 4), 0, 0.3, -0.62, [1, 1, 1], [-Math.PI / 2 - 0.5, 0, 0]), color: SHELL, bone: 4 },
  ];
  for (const side of [-1, 1]) for (const z of [-0.22, 0, 0.22]) {
    parts.push({ geometry: placed(new BoxGeometry(0.42, 0.04, 0.04), side * 0.36, 0.12, z, [1, 1, 1], [0, 0, side * -0.5]), color: LEG, bone: side < 0 ? 2 : 3 });
  }
  return skinParts(parts);
}
const bones = (): { name: string; parent: string | null; pos: [number, number, number] }[] => [
  { name: 'body', parent: null, pos: [0, 0.22, 0] }, { name: 'head', parent: 'body', pos: [0, 0.22, 0.42] },
  { name: 'legsL', parent: 'body', pos: [-0.18, 0.14, 0] }, { name: 'legsR', parent: 'body', pos: [0.18, 0.14, 0] }, { name: 'tail', parent: 'body', pos: [0, 0.26, -0.45] },
];
export const SAND_SKITTERER_LOOK: SpeciesLook = { id: 'sunscar.look.sandSkitterer', species: SAND_SKITTERER.id, kind: 'sandSkitterer', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'sunscar.sandSkitterer', sockets: ['body', 'head', 'legsL', 'legsR', 'tail'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => ({ bones: bones(), furParts: [], hardParts: [skittererGeometry()], eyeParts: [],
    dims: { bodyY: 0.22, bodyHalfLen: 0.45, bodyRadius: 0.3, headRadius: 0.17, legLen: 0.2, feet: [], halfWidth: 0.45 } }),
  animate: ({ bones: b, t, alive, deathT, speed, attack, mem }) => {
    const body = b['body'], head = b['head'], left = b['legsL'], right = b['legsR'], tail = b['tail'];
    const burrow = mem['burrow'] ?? 0, scurry = Math.min(1, Math.abs(speed) / 3) * Math.sin(t * 26);
    if (body) {
      // The bind height is kept in `mem` on the first frame: the burrow and the rear move the bone from it.
      const base = mem['bodyY'] ?? body.position.y; mem['bodyY'] = base;
      body.position.y = base - burrow * 0.62 + (attack >= 0 ? attack * 0.12 : 0);
      body.rotation.x = attack >= 0 ? -attack * 0.45 : 0;
      body.rotation.z = alive ? 0 : Math.PI * Math.min(1, Math.max(0, deathT));
    }
    if (left) left.rotation.y = alive ? scurry * 0.5 : 0.6;
    if (right) right.rotation.y = alive ? -scurry * 0.5 : -0.6;
    if (head) head.rotation.y = alive ? Math.sin(t * 9) * 0.08 : 0;
    if (tail) tail.rotation.x = alive ? -0.3 - (attack >= 0 ? attack * 0.5 : 0) : 0;
  },
};
