import { MathUtils, Quaternion, Vector3 } from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { DynamicBodySlots, type Bodies, type BodyLaunchRow } from '@wildshard/engine/physics/bodies';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { DRIFTWOOD_STRIKE_ROWS } from '../data/strikes';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

/** Existing contact profiles evaluated through the shared two-user native strike-row law. */
export const DRIFTWOOD_STRIKES = {
  snap: strikeFromData(DRIFTWOOD_STRIKE_ROWS.snap),
  bite: strikeFromData(DRIFTWOOD_STRIKE_ROWS.bite),
  coconut: strikeFromData(DRIFTWOOD_STRIKE_ROWS.coconut),
  sailor: strikeFromData(DRIFTWOOD_STRIKE_ROWS.sailor),
  swing: strikeFromData(DRIFTWOOD_STRIKE_ROWS.swing),
  second: strikeFromData(DRIFTWOOD_STRIKE_ROWS.second),
  burst: strikeFromData(DRIFTWOOD_STRIKE_ROWS.burst),
};
const contact = new StrikeRunner();
/** What a Driftwood strike reads: the player's feet, the line-of-reach test and the common player damage pipeline.
 * The browser's ThinkCtx satisfies it; a renderer-free host lends its own (SF72). */
export interface DriftwoodContactPorts<A extends AnimalSim> {
  readonly player: A['position'];
  reach: (actor: A) => boolean;
  hurt: (damage: number) => void;
}
/** The manager supplies facing, cover and the common player damage pipeline through these ports. */
export function driftwoodContact<A extends AnimalSim>(actor: A, ctx: DriftwoodContactPorts<A>, spec: StrikeSpec): boolean {
  return contact.contact(spec, { actor, target: ctx.player, canReach: () => ctx.reach(actor), hit: (row) => { ctx.hurt(row.damage); } });
}

export const COCONUTS = 16, COCONUT_R = 0.13;
export interface CoconutThrower { readonly position: Vector3; readonly kind: string; readonly label: string }
export interface CoconutPorts<T extends CoconutThrower> {
  readonly bodies: () => Bodies | null;
  readonly rng: Rng;
  readonly surface: (x: number, z: number) => number | undefined;
  readonly owner: unknown;
  readonly hit: (thrower: T, damage: number, moveId: string) => void;
  readonly sound: (name: 'coconut_hit' | 'coconut_land', at: Vector3) => void;
  readonly splash: (at: Vector3, strength: number) => void;
}

/** The island's private contacts borrow the shared body owner and admitted launch coefficients. */
const volleyAt = new Vector3(), volleyRotation = new Quaternion();
export class CoconutVolley<T extends CoconutThrower> extends DynamicBodySlots<T> {
  private readonly launchPorts: CoconutPorts<T>;
  private readonly profile: BodyLaunchRow;
  constructor(ports: CoconutPorts<T>, launch: BodyLaunchRow) {
    super({count:COCONUTS,clocks:'f32',initial:1,restSpeed:.15,restTime:4,maxAge:16,inclusive:false,
    landing:{impact:1.5,timeout:3,wet:true,clearDistance:.8}}, {
    bodies:ports.bodies,spec:()=>({shape:{ball:COCONUT_R},material:'wood',group:'DEBRIS',density:650,friction:.7,restitution:.35,
      angularDamping:3,ccd:true,expendable:true,float:{surface:ports.surface,buoyancy:1.6,drag:1.5},owner:ports.owner}),
    contact:(body,source,point,player)=>{
      if(player===null)throw new Error('Coconut contact requires the current player pose');
      const cy=MathUtils.clamp(point.y,player.y,player.y+1.75);
      if(!((point.x-player.x)**2+(cy-point.y)**2+(point.z-player.z)**2<.45*.45))return false;
      if(source!==null)ports.hit(source,DRIFTWOOD_STRIKES.coconut.damage,DRIFTWOOD_STRIKES.coconut.id);
      ports.sound('coconut_hit',volleyAt);const velocity=body.rb.linvel();body.launch({x:velocity.x*-.2,y:1.5,z:velocity.z*-.2});return true;
    },
    landed:(body,_point,age)=>{if(age<=3)ports.sound('coconut_land',volleyAt);if(body.wet>0)ports.splash(volleyAt,.3);},
  });
    this.launchPorts = ports; this.profile = launch;
  }
  throw(from: Vector3, to: Vector3, source: T | null): void {
    const ports = this.launchPorts;
    if (ports.bodies() === null) return;
    const body = this.launch(this.profile, from, to, ports.rng.range(0, 6.28), source);
    if (body !== null) body.rb.setAngvel({x:ports.rng.range(-7,7),y:ports.rng.range(-3,3),z:ports.rng.range(-7,7)},true);
  }
  update(dt: number, alpha: number, player: Vector3, draw?: (k: number, at: Vector3 | null, rotation: Quaternion) => void): boolean {
    return this.step(dt,alpha,player,volleyAt,volleyRotation,(k,point)=>draw?.(k,point,volleyRotation));
  }
}
