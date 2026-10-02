import { CreatureBrain, StrikeRunner, NO_FUR, type Animal, type SpeciesLook, type SpeciesRow, type StrikeContext, type StrikeSpec, type ThinkCtx } from '#engine';
import { BoxGeometry, ConeGeometry } from 'three';
import { WINDMILL, apothem } from '../layout';
import { STRINGS } from '../strings';
import { homeOf, hull, yawTo } from './rig';

/** The ram: a short lane straight ahead, telegraphed by a head-down windup. */
export const RAM: StrikeSpec = { id: 'far.goat.ram', shape: { kind: 'lane', length: 4, width: 1.4 }, windup: 0.8, active: 0.5, recover: 0.9, cooldown: 3,
  range: 5, damage: 12, tags: ['creature.skyGoat'], weight: () => 1 };
export const GOAT = { graze: 1.2, ram: 7.5, notice: 9, rimMargin: 2.5 } as const;
type GoatState = 'graze' | 'threat' | 'ram';

/**
 * A sky goat walks its island top. It flies at altitude 0 over the ground (ENGINE §19 ground-relative flight), so it
 * follows the island colliders; a GUST over the rim leaves it with no floor and it drops through the kill height.
 */
export class SkyGoatBrain extends CreatureBrain<GoatState> {
  private readonly strikes = new StrikeRunner();
  private wanderYaw = 0; private wanderT = 0; private ramYaw = 0;
  constructor(actor: Animal) { super(actor, ['graze', 'threat', 'ram']); }
  private strike(ctx: ThinkCtx): StrikeContext { const a = this.actor; return { actor: a, target: ctx.player, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); } }; }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const d = a.position.distanceTo(ctx.player), level = Math.abs(ctx.player.y - a.position.y) < 2.5;
    if (this.state === 'ram') return;
    this.transition(!ctx.calm && level && d < GOAT.notice ? 'threat' : 'graze');
    this.wanderT -= ctx.dt; if (this.wanderT <= 0) { this.wanderT = ctx.rng.range(2, 5); this.wanderYaw = ctx.rng.range(-Math.PI, Math.PI); }
    if (this.state === 'threat' && !this.strikes.busy && d < RAM.range && ctx.claim(a)) {
      this.ramYaw = yawTo(a, ctx.player.x, ctx.player.z); this.strikes.start(RAM, a, ctx.player); this.transition('ram');
    }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive || a.hasImpulse) return;
    const home = homeOf(a, { x: WINDMILL.x, z: WINDMILL.z, r: apothem(WINDMILL), y: WINDMILL.y }), out = Math.hypot(a.position.x - home.x, a.position.z - home.z) > home.r - GOAT.rimMargin;
    if (this.state === 'ram') {
      this.strikes.update(ctx.dt, this.strike(ctx));
      // The windup holds still (head down); the active window charges along the committed heading.
      ctx.flight.steer(a, this.ramYaw, this.strikes.busy && !out ? GOAT.ram * Math.min(1, Math.max(0, this.strikes.time - RAM.windup) * 4) : 0, 0, 6);
      if (!this.strikes.busy) this.transition('graze');
      return;
    }
    const toHome = yawTo(a, home.x, home.z);
    if (out) ctx.flight.steer(a, toHome, GOAT.graze * 1.5, 0, 3);
    else if (this.state === 'threat') ctx.flight.steer(a, yawTo(a, ctx.player.x, ctx.player.z), 1.6, 0, 3);
    else ctx.flight.steer(a, this.wanderYaw, GOAT.graze, 0, 1.5);
  }
}
const brains = new WeakMap<Animal, SkyGoatBrain>();
const brain = (a: Animal): SkyGoatBrain => { let value = brains.get(a); if (!value) { value = new SkyGoatBrain(a); brains.set(a, value); } return value; };
export const SKY_GOAT: SpeciesRow = { id: 'far.creature.skyGoat', kind: 'skyGoat', label: STRINGS.goat, aggressive: true, blood: false,
  flight: { altitude: 0, above: 'ground', climbRate: 6, diveRate: 14 },
  variants: [{ id: 'cloud', label: STRINGS.goat, weight: 1, rarity: 'common', scale: [0.95, 1.1], hp: 40 }],
  think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

const BODY = 0, LEG_FL = 2, LEG_FR = 3, LEG_BL = 4, LEG_BR = 5;
export const SKY_GOAT_LOOK: SpeciesLook = { id: 'far.look.skyGoat', species: SKY_GOAT.id, kind: 'skyGoat', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.skyGoat', sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => ({
    bones: [{ name: 'body', parent: null, pos: [0, 0.85, 0] }, { name: 'head', parent: 'body', pos: [0, 1.15, 0.6] },
      { name: 'legFL', parent: 'body', pos: [0.22, 0.7, 0.4] }, { name: 'legFR', parent: 'body', pos: [-0.22, 0.7, 0.4] },
      { name: 'legBL', parent: 'body', pos: [0.22, 0.7, -0.4] }, { name: 'legBR', parent: 'body', pos: [-0.22, 0.7, -0.4] }],
    furParts: [], eyeParts: [],
    hardParts: [hull([
      { geometry: new BoxGeometry(0.62, 0.5, 1.15), bone: BODY, color: 0xece4da, at: [0, 0.88, 0] },
      { geometry: new BoxGeometry(0.66, 0.2, 1.05), bone: BODY, color: 0xd9cfc4, at: [0, 1.15, -0.02] },
      { geometry: new BoxGeometry(0.3, 0.34, 0.42), bone: 1, color: 0xe4dbd1, at: [0, 1.18, 0.74] },
      { geometry: new ConeGeometry(0.06, 0.4, 4), bone: 1, color: 0x4a3d48, at: [0.1, 1.42, 0.62], rot: [-0.7, 0, 0.3] },
      { geometry: new ConeGeometry(0.06, 0.4, 4), bone: 1, color: 0x4a3d48, at: [-0.1, 1.42, 0.62], rot: [-0.7, 0, -0.3] },
      { geometry: new BoxGeometry(0.12, 0.22, 0.12), bone: 1, color: 0xc9bdb0, at: [0, 0.96, 0.86] },
      ...[[LEG_FL, 0.22, 0.4], [LEG_FR, -0.22, 0.4], [LEG_BL, 0.22, -0.4], [LEG_BR, -0.22, -0.4]].map(([bone, x, z]) => ({
        geometry: new BoxGeometry(0.13, 0.66, 0.13), bone: bone ?? BODY, color: 0x5a4b55, at: [x ?? 0, 0.36, z ?? 0] as const })),
    ])],
    dims: { bodyY: 0.85, bodyHalfLen: 0.6, bodyRadius: 0.35, headRadius: 0.22, legLen: 0.7, feet: [], halfWidth: 0.35 } }),
  animate: ({ bones, t, alive, speed }) => {
    const swing = alive ? Math.sin(t * 9) * Math.min(1, speed / 2) * 0.6 : 0;
    const fl = bones['legFL'], fr = bones['legFR'], bl = bones['legBL'], br = bones['legBR'], head = bones['head'];
    if (fl) fl.rotation.x = swing; if (br) br.rotation.x = swing; if (fr) fr.rotation.x = -swing; if (bl) bl.rotation.x = -swing;
    if (head) head.rotation.x = alive ? Math.sin(t * 1.3) * 0.08 : 0.5;
  },
};
