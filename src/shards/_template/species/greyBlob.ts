import { CreatureBrain, StrikeRunner, canReach, NO_FUR, type SpeciesRow, type SpeciesLook, type Animal, type ThinkCtx, type StrikeSpec, type StrikeContext } from '#engine';
import { SphereGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { STRINGS } from '../strings';

export const BLOB_STRIKES: readonly StrikeSpec[] = [
  { id: 'template.blob.bump', shape: { kind: 'point', radius: 1.8 }, windup: 0.7, active: 0.15, recover: 0.8, cooldown: 1, range: 2, damage: 8, tags: ['creature.greyBlob'], weight: () => 2 },
  { id: 'template.blob.lane', shape: { kind: 'lane', length: 5, width: 1.4 }, windup: 1, active: 0.6, recover: 1, cooldown: 3, range: 6, damage: 12, tags: ['creature.greyBlob'], motion: { speed: 5 }, weight: () => 1 },
];
export class GreyBlobBrain extends CreatureBrain<'idle' | 'fight'> {
  private readonly strikes = new StrikeRunner();
  constructor(actor: Animal) { super(actor, ['idle', 'fight']); }
  private context(ctx: ThinkCtx): StrikeContext { const a = this.actor;
    return { actor: a, target: ctx.player, canReach: () => canReach(a, ctx.player), hit: (strike) => { ctx.hurt(strike.damage); } }; }
  override think(ctx: ThinkCtx): void { const a = this.actor; if (!a.alive || ctx.calm) { this.transition('idle'); return; }
    this.transition(a.position.distanceTo(ctx.player) < 10 ? 'fight' : 'idle');
    if (this.state === 'fight' && !this.strikes.busy) { const c = this.context(ctx), pick = this.strikes.pick(BLOB_STRIKES, c); if (pick) this.strikes.start(pick, a, ctx.player); }
  }
  override act(ctx: ThinkCtx): void { const a = this.actor; this.strikes.update(ctx.dt, this.context(ctx));
    if (!this.strikes.busy) ctx.steer(a, Math.atan2(ctx.player.x - a.position.x, ctx.player.z - a.position.z), this.state === 'fight' ? 1 : 0, 3); }
}
const brains = new WeakMap<Animal, GreyBlobBrain>();
const brain = (a: Animal): GreyBlobBrain => { let value = brains.get(a); if (!value) { value = new GreyBlobBrain(a); brains.set(a, value); } return value; };
export const GREY_BLOB: SpeciesRow = { id: 'template.creature.greyBlob', kind: 'greyBlob', label: STRINGS.blob, aggressive: true, blood: false,
  variants: [{ id: 'grey', label: STRINGS.blob, weight: 1, rarity: 'common', scale: [1, 1], hp: 60 }, { id: 'big', label: STRINGS.boss, weight: 0, rarity: 'rare', scale: [1.8, 1.8], hp: 180 }],
  think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };
export const GREY_BLOB_LOOK: SpeciesLook = { id: 'template.look.greyBlob', species: GREY_BLOB.id, kind: 'greyBlob', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'template.greyBlob', sockets: ['body', 'head'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
  build: () => { const geometry = new SphereGeometry(0.65, 10, 6); geometry.translate(0, 0.65, 0);
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('color', new Float32BufferAttribute(Array.from({ length: count * 3 }, () => 0.45), 3));
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    const weights = new Float32Array(count * 4); for (let i = 0; i < count; i++) weights[i * 4] = 1;
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    return { bones: [{ name: 'body', parent: null, pos: [0, 0.65, 0] }, { name: 'head', parent: 'body', pos: [0, 1, 0] }], furParts: [], hardParts: [geometry], eyeParts: [],
      dims: { bodyY: 0.65, bodyHalfLen: 0.4, bodyRadius: 0.55, headRadius: 0.3, legLen: 0.6, feet: [], halfWidth: 0.65 } }; },
  animate: ({ bones, t, alive }) => { const body = bones['body']; if (body) body.scale.set(1, alive ? 1 + Math.sin(t * 4) * 0.08 : 0.4, 1); },
};
