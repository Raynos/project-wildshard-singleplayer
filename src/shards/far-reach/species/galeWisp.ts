import { CreatureBrain } from '@wildshard/engine/ai/CreatureBrain';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { StrikeRunner, type StrikeContext, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { Animal } from '@wildshard/engine/entities/Animal';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { IcosahedronGeometry, OctahedronGeometry, TorusGeometry, Vector3 } from 'three';
import { KEEPER } from '../layout';
import { STRINGS } from '../strings';
import { homeOf, hull, pushPlayer, yawTo } from './rig';

/** The burst: the wisp darts at the chest and bursts in a small sphere that shoves you back (G24 `WISP.shove`). */
export const BURST: StrikeSpec = { id: 'far.wisp.burst', shape: { kind: 'sphere', radius: 1.4 }, windup: 0.7, active: 0.7, recover: 1.2, cooldown: 3.5,
  range: 9, damage: 6, tags: ['creature.galeWisp'], units: 'world', weight: () => 1 };
export const WISP = { circle: 5, dart: 13, notice: 14, shove: 7, lift: 2.5 } as const;
type WispState = 'drift' | 'dart';

/** A gale wisp drifts in a small circle 3 m over its island; when you come close it gathers, darts at your chest and bursts. */
export class GaleWispBrain extends CreatureBrain<WispState> {
  private readonly strikes = new StrikeRunner(); private angle = 0; private dart = 0; private readonly chest = new Vector3();
  constructor(actor: Animal) { super(actor, ['drift', 'dart']); }
  private strike(ctx: ThinkCtx): StrikeContext { const a = this.actor; this.chest.copy(ctx.player); this.chest.y += 1.2;
    return { actor: a, target: this.chest, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); pushPlayer(yawTo(a, ctx.player.x, ctx.player.z), WISP.shove, WISP.lift); } }; }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive || this.state === 'dart') return;
    if (!ctx.calm && a.position.distanceTo(ctx.player) < WISP.notice && !this.strikes.busy && ctx.claim(a)) {
      this.strike(ctx); this.strikes.start(BURST, a, this.chest); this.dart = 0; this.transition('dart');
    }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const home = homeOf(a, { x: KEEPER.x, z: KEEPER.z, r: 7, y: KEEPER.y + 3 });
    if (this.state === 'dart') {
      const s = this.strike(ctx); this.dart += ctx.dt;
      ctx.flight.steer(a, yawTo(a, this.chest.x, this.chest.z), this.dart < BURST.windup ? 0 : WISP.dart, this.chest.y, 6);
      this.strikes.update(ctx.dt, s);
      if (!this.strikes.busy) this.transition('drift');
      return;
    }
    this.angle += (ctx.dt * WISP.circle) / home.r;
    ctx.flight.steer(a, yawTo(a, home.x + Math.cos(this.angle) * home.r, home.z + Math.sin(this.angle) * home.r), WISP.circle, home.y, 3);
  }
}
const brains = new WeakMap<Animal, GaleWispBrain>();
const brain = (a: Animal): GaleWispBrain => { let value = brains.get(a); if (!value) { value = new GaleWispBrain(a); brains.set(a, value); } return value; };
export const GALE_WISP: SpeciesRow = { id: 'far.creature.galeWisp', kind: 'galeWisp', label: STRINGS.wisp, aggressive: true, blood: false,
  flight: { altitude: 33, above: 'world', climbRate: 8, diveRate: 10, lockRange: 20 },
  variants: [{ id: 'gale', label: STRINGS.wisp, weight: 1, rarity: 'common', scale: [1, 1], hp: 18 }],
  think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

export const GALE_WISP_LOOK: SpeciesLook = { id: 'far.look.galeWisp', species: GALE_WISP.id, kind: 'galeWisp', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.galeWisp', sockets: ['body', 'head', 'swirl'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => ({
    bones: [{ name: 'body', parent: null, pos: [0, 0, 0] }, { name: 'head', parent: 'body', pos: [0, 0.1, 0.2] }, { name: 'swirl', parent: 'body', pos: [0, 0, 0] }],
    furParts: [], eyeParts: [],
    hardParts: [hull([
      { geometry: new IcosahedronGeometry(0.45, 0), bone: 0, color: 0xeaf8ff },
      { geometry: new OctahedronGeometry(0.2, 0), bone: 1, color: 0x9fe6f2, at: [0, 0.1, 0.32] },
      { geometry: new TorusGeometry(0.75, 0.05, 3, 10), bone: 2, color: 0xcdeff8, rot: [Math.PI / 2, 0, 0] },
      { geometry: new TorusGeometry(0.55, 0.04, 3, 8), bone: 2, color: 0xffffff, rot: [Math.PI / 2.6, 0.4, 0] },
    ])],
    dims: { bodyY: 0, bodyHalfLen: 0.4, bodyRadius: 0.45, headRadius: 0.2, legLen: 0.1, feet: [], halfWidth: 0.75 } }),
  animate: ({ bones, t, alive }) => { const swirl = bones['swirl'], body = bones['body'];
    if (swirl) swirl.rotation.y = t * (alive ? 6 : 1); if (body) body.scale.setScalar(alive ? 1 + Math.sin(t * 7) * 0.08 : 0.5); },
};
