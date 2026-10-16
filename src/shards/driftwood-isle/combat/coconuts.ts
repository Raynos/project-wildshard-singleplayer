import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { DynamicBodySlots, type Bodies } from '@wildshard/engine/physics/bodies';
import { DRIFTWOOD_STRIKES } from './strikes';

/** The coconut slots (the browser's one InstancedMesh holds this many). */
export const COCONUTS = 16;
export const COCONUT_R = 0.13;
const G = 9.81, REST_T = 4, MAX_AGE = 16;
/** a knock this hard (m/s of velocity change) in flight is the landing */
const LAND_IMPACT = 1.5;
/** below this speed (m/s) a landed coconut counts as resting */
const REST_SPEED = 0.15;
/** the feet → head segment a flying coconut must pass within */
const HIT_R = 0.45, PLAYER_H = 1.75;
/** a coconut's body (PHYSICS P7): a light ball that bounces a little, rolls (its spin damped so it stops on the flat) and
 *  floats (lighter than water); DEBRIS in flight; removed, not frozen, when the body cap is full. The volley gives it the
 *  sea surface it floats on (`CoconutPorts.surface`); this row's own surface is dry land. */
export const COCONUT_BODY = {
  shape: { ball: COCONUT_R }, material: 'wood', group: 'DEBRIS', density: 650, friction: 0.7, restitution: 0.35,
  angularDamping: 3, ccd: true, expendable: true, float: { surface: (): number | undefined => undefined, buoyancy: 1.6, drag: 1.5 },
} as const satisfies Omit<Parameters<Bodies['spawn']>[0], 'owner'>;

/** What a thrower is to the volley: where it stands (a hit's point), its kind and label (the death cause). */
export interface CoconutThrower { readonly position: Vector3; readonly kind: string; readonly label: string }
/** The volley's world: the body service, the spin stream, the sea, the body's owner tag, and what a hit / landing does. */
export interface CoconutPorts<T extends CoconutThrower> {
  /** the dynamic-body service the coconuts live in (null: no physics yet, a throw releases nothing) */
  readonly bodies: () => Bodies | null;
  /** the stream each throw's spin draws from (the browser's placement stream `Rng(seed ^ 0xe11e)`, past placement) */
  readonly rng: Rng;
  /** the sea surface a coconut floats on at (x, z), or undefined over dry land */
  readonly surface: (x: number, z: number) => number | undefined;
  /** the collider's owner tag */
  readonly owner: unknown;
  /** a flying coconut struck the player: file the thrower's 8-damage blow */
  readonly hit: (thrower: T, damage: number, moveId: string) => void;
  /** presentation: the hit / landing voice and the water splash */
  readonly sound: (name: 'coconut_hit' | 'coconut_land', at: Vector3) => void;
  readonly splash: (at: Vector3, strength: number) => void;
}
const _v = new Vector3(), _q = new Quaternion(), _e = new Euler(), _vel = { x: 0, y: 0, z: 0 };

/**
 * Driftwood's coconuts, view-free (PHYSICS P7), shared by the browser (creatures/Enemies.ts draws each slot from
 * `step`'s pose) and the renderer-free runtime (runtime/keeper.ts). A monkey's throw lobs one on a ballistic arc to land
 * where the player stood in 0.8–1.5 s (the time grows with the range), spun from the placement stream. In flight it is
 * DEBRIS (the world only) and a hit is the ball passing within 0.45 m of the player's feet→head segment (8 damage, the
 * thrower's blow; it bounces off); a knock past 1.5 m/s, the sea or 3 s of flight is the landing, from which it is an ITEM
 * the player nudges. A landed coconut goes after resting 4 s, or at 16 s old.
 */
export class Coconuts<T extends CoconutThrower> extends DynamicBodySlots<T> {
  private readonly launchPorts: CoconutPorts<T>;
  constructor(ports: CoconutPorts<T>) {
    super({count:COCONUTS,clocks:'f32',initial:1,restSpeed:REST_SPEED,restTime:REST_T,maxAge:MAX_AGE,inclusive:false,
      landing:{impact:LAND_IMPACT,timeout:3,wet:true,clearDistance:.8}}, {
      bodies:()=>ports.bodies(),spec:()=>({...COCONUT_BODY,float:{...COCONUT_BODY.float,surface:ports.surface},owner:ports.owner}),
      contact:(body,thrower,at,player)=>{
        if(player===null)throw new Error('Coconut contact requires the current player pose');
        const cy=MathUtils.clamp(at.y,player.y,player.y+PLAYER_H);
        if(!((at.x-player.x)**2+(cy-at.y)**2+(at.z-player.z)**2<HIT_R*HIT_R))return false;
        if(thrower!==null)ports.hit(thrower,DRIFTWOOD_STRIKES.coconut.damage,DRIFTWOOD_STRIKES.coconut.id);
        ports.sound('coconut_hit',_v);const vel=body.rb.linvel();body.launch({x:vel.x*-.2,y:1.5,z:vel.z*-.2});return true;
      },
      landed:(body,_at,age)=>{if(age<=3)ports.sound('coconut_land',_v);if(body.wet>0)ports.splash(_v,.3);},
    });
    this.launchPorts = ports;
  }

  /** lob a coconut from `from` to land on `to` (the slots are reused round-robin, the oldest goes) */
  throw(from: Vector3, to: Vector3, thrower: T | null): void {
    const bodies = this.launchPorts.bodies(), rng = this.launchPorts.rng;
    if (bodies === null) return;
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const T = MathUtils.clamp(Math.hypot(dx, dz) / 9, 0.8, 1.5);
    const spin = rng.range(0, 6.28);
    _q.setFromEuler(_e.set(spin, spin * 0.7, 0));
    _vel.x = dx / T; _vel.y = dy / T + 0.5 * G * T; _vel.z = dz / T;
    const b = this.spawn(from,_vel,_q,thrower);
    if(b===null)return;
    b.rb.setAngvel({ x: rng.range(-7, 7), y: rng.range(-3, 3), z: rng.range(-7, 7) }, true);
  }

  /** Read the bodies after the world stepped (`alpha` of the way from the previous fixed step to the latest), strike the
   *  player at `player` (feet), land, rest and retire them. `draw` gets each live slot's pose, or null for a freed one;
   *  the answer is whether it drew any. */
  update(dt: number, alpha: number, player: Vector3, draw?: (k: number, at: Vector3 | null, rot: Quaternion) => void): boolean {
    return this.step(dt,alpha,player,_v,_q,(k,at)=>draw?.(k,at,_q));
  }
}
