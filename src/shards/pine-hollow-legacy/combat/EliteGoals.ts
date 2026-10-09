import type { Vector3 } from 'three';
import type { BrainPoint } from '@wildshard/engine/ai/strikes';
import type { Lane, LaneBody } from './lane';
import { bugleHour, fleeHeading } from './combatMath';
import { PINE_STRIKES, pineContact } from './strikes';

/** What a goal reads of the world, renderer-free (the page's PineCtx satisfies it over its Animal). */
interface GoalEnv<B extends LaneBody> {
  reach: (actor: B, target: BrainPoint) => boolean;
  player: { readonly position: Vector3 };
  trauma: (k: number) => void; god: boolean; dusk: () => number; night: () => number; stun: (s: number) => void;
}
interface GoalHost<B extends LaneBody> {
  env: GoalEnv<B>;
  def: { lair: { x: number; z: number }; leashR: number };
  mode: string; modeT: number; p2: boolean;
  toPlayer: (a: B) => { d: number; yaw: number };
  setMode: (mode: string) => void; sig: () => void;
  hurt: (a: B, damage: number, exempt?: boolean) => void;
  voice: (name: string, a: B) => void;
  next: () => number;
}
interface IronhideGoal<B extends LaneBody> extends GoalHost<B> { lane: Lane<B>; again: boolean }
interface GhostGoal<B extends LaneBody> extends GoalHost<B> {
  cd: number; lastHit: number; fadeT: number; autoT: number;
  fade: (a: B) => void; comeBack: (a: B) => void;
}
interface BlackpawGoal<B extends LaneBody> extends GoalHost<B> {
  lane: Lane<B>; roarCd: number; swipeT: number; readonly ringR: number;
  ring: { setTime: (t: number) => void; ring: (x: number, z: number, radius: number, alpha: number) => void; hide: () => void };
  burstOut: (a: B) => void; roarFx: (a: B) => void;
}
interface ImperialGoal<B extends LaneBody> extends GoalHost<B> {
  lane: Lane<B>; bugledPhase: number; rivals: readonly unknown[];
  tickRivals: (dt: number, t: number) => void; callRivals: (a: B) => void;
}

/** Complete move selectors and clocks, renderer-free over any lane body (SF72); the resident adapters own geometry, tells and effects. */
export function ironhideGoal<B extends LaneBody>(h: IronhideGoal<B>, a: B, dt: number, t: number): void {
    const p = h.env.player.position, { d, yaw } = h.toPlayer(a);
    a.lookTarget.copy(p); a.lookWeight = 1;
    if (h.mode === 'charge') {
      h.lane.update(a, dt, t, p, (dmg) => { h.hurt(a, dmg); h.env.trauma(0.45); });
      if (h.lane.state === 'run' && h.lane.t < dt * 1.5) h.voice('boar_squeal', a);
      if (!h.lane.busy) {
        if (h.again) { h.again = false; h.lane.start(a, p.x, p.z, 0.55, 1.1); return; }
        h.setMode('circle');
      }
      return;
    }
    // circle: trot round you at ~13 m (the tangent, bent in or out to hold the radius), then charge
    const want = 13, side = Math.sin(a.seed * 31) > 0 ? 1 : -1;
    const tangent = yaw + side * Math.PI / 2, bend = Math.max(-1, Math.min(1, (d - want) / 8)) * 0.9 * side;
    a.setMotion(tangent - bend, 4.2, 2.8);
    if (h.mode === 'idle' || h.mode === 'home') h.setMode('circle');
    if (h.modeT > (h.p2 ? 1.4 : 2.6) && d < 30) {
      h.lane.start(a, p.x, p.z, h.p2 ? 0.62 : 0.9, h.p2 ? 1.12 : 1);
      h.again = h.p2 && h.next() < 0.55;
      h.voice('boar_grunt', a);
      h.setMode('charge'); h.sig();
    }
  
}

export function ghostGoal<B extends LaneBody>(h: GhostGoal<B>, a: B, dt: number, t: number): void {
    void t;
    const p = h.env.player.position, { d, yaw } = h.toPlayer(a);
    h.cd -= dt;
    const hit = a.lastHitT > h.lastHit; if (hit) h.lastHit = a.lastHitT;
    if (h.mode === 'faded') {
      h.fadeT -= dt;
      if (h.fadeT <= 0) h.comeBack(a);
      return;
    }
    if (h.cd <= 0 && (hit || d < 12)) { h.fade(a); return; }
    if (h.p2 && h.mode === 'flee') { h.autoT -= dt; if (h.autoT <= 0 && h.cd <= 0) { h.autoT = 3.5 + h.next() * 1.5; h.fade(a); return; } }
    if (h.mode === 'stare') {
      a.setMotion(yaw, 0, 4); a.lookTarget.copy(p); a.lookWeight = 1;
      if (h.modeT > (h.p2 ? 1.1 : 1.6) || hit) h.setMode('flee');
      return;
    }
    if (h.mode !== 'flee') h.setMode('flee');
    const L = h.def.lair;
    a.setMotion(fleeHeading(a.position.x, a.position.z, p.x, p.z, L.x, L.z, h.def.leashR * 0.55), 7, 3.2);
    a.lookWeight = 0;
    if (h.modeT > 2.6 + (a.seed % 1) * 1.4) h.setMode('stare');
  
}

export function blackpawGoal<B extends LaneBody>(h: BlackpawGoal<B>, a: B, dt: number, t: number): void {
    const p = h.env.player.position, { d, yaw } = h.toPlayer(a);
    h.roarCd -= dt;
    h.ring.setTime(t);
    a.lookTarget.copy(p); a.lookWeight = 1;
    if (h.mode === 'lurk') { h.burstOut(a); h.setMode('roar'); a.startAttack(1.1); h.voice('bear_growl', a); return; }
    if (h.mode === 'roar') {
      // the tell: the ring round him swells and pulses; the roar roots anyone still in it
      a.setMotion(yaw, 0, 3);
      const k = Math.min(1, h.modeT / 1.1);
      h.ring.ring(a.position.x, a.position.z, h.ringR * (0.7 + 0.3 * k), 0.35 + 0.6 * k * (0.7 + 0.3 * Math.sin(t * 20)));
      if (h.modeT >= 1.1) {
        h.ring.hide();
        h.voice('bear_roar', a);
        h.roarFx(a);
        h.env.trauma(0.3);
        if (!h.env.god) pineContact(a, p, h.p2 ? PINE_STRIKES.roarPhase2 : PINE_STRIKES.roar, (damage) => { h.env.stun(1.3); h.hurt(a, damage, true); h.env.trauma(0.4); }, () => h.env.reach(a, p));
        h.roarCd = h.p2 ? 5.5 : 10;
        if (d > 5) { h.lane.start(a, p.x, p.z, h.p2 ? 0.6 : 0.75, h.p2 ? 1.12 : 1); h.setMode('charge'); } else h.setMode('stalk');
      }
      return;
    }
    if (h.mode === 'charge') {
      h.lane.update(a, dt, t, p, (dmg) => { h.hurt(a, dmg); h.env.trauma(0.5); });
      if (!h.lane.busy) h.setMode('stalk');
      return;
    }
    if (h.mode === 'swipe') {
      a.setMotion(yaw, 0, 2.5);
      if (h.swipeT >= 0) { h.swipeT -= dt; if (h.swipeT < 0) { h.voice('bear_growl', a); pineContact(a, p, PINE_STRIKES.swipe, (damage) => { h.hurt(a, damage); h.env.trauma(0.35); }, () => h.env.reach(a, p)); } }
      if (h.modeT > 1.2) h.setMode('stalk');
      return;
    }
    // stalk: walk you down, then pick a move
    if (h.mode !== 'stalk') h.setMode('stalk');
    a.setMotion(yaw, d > 3 ? (h.p2 ? 4 : 3.2) : 0, 2.2);
    if (h.roarCd <= 0 && d < 12) { h.setMode('roar'); a.startAttack(1.1); h.voice('bear_growl', a); }
    else if (d < 3.6) { h.setMode('swipe'); h.swipeT = 0.55; a.startAttack(0.55); }
    else if (d > 7 && d < 22 && h.modeT > 2.2) { h.lane.start(a, p.x, p.z, h.p2 ? 0.6 : 0.75, h.p2 ? 1.12 : 1); h.setMode('charge'); }
  
}

export function imperialGoal<B extends LaneBody>(h: ImperialGoal<B>, a: B, dt: number, t: number): void {
    const p = h.env.player.position, { d, yaw } = h.toPlayer(a);
    h.tickRivals(dt, t);
    a.lookTarget.copy(p); a.lookWeight = 1;
    const phase = h.p2 ? 1 : 0;
    if (h.mode === 'bugle') {
      // head up, the long call; the rivals answer out of the trees
      a.setMotion(yaw, 0, 2); a.lookTarget.y += 12;
      if (h.modeT > 0.2 && h.modeT - dt <= 0.2) h.voice('elk_bugle', a);
      if (h.modeT >= 1.8) { h.callRivals(a); h.setMode('posture'); }
      return;
    }
    if (h.mode === 'charge') {
      h.lane.update(a, dt, t, p, (dmg) => { h.hurt(a, dmg); h.env.trauma(0.5); });
      if (!h.lane.busy) h.setMode('posture');
      return;
    }
    if (h.mode !== 'posture') h.setMode('posture');
    if (h.bugledPhase < phase && h.rivals.length === 0 && bugleHour(h.env.dusk(), h.env.night())) {
      h.bugledPhase = phase; h.setMode('bugle'); h.sig(); return;
    }
    // posture: hold 18–26 m off, side-on steps, facing you
    const back = d < 18 ? -1 : d > 26 ? 1 : 0;
    const side = Math.sin(t * 0.7 + a.seed * 9) > 0 ? 1 : -1;
    a.setMotion(back === 0 ? yaw + side * 1.2 : back > 0 ? yaw : yaw + Math.PI, back === 0 ? 1.2 : 3.5, 2.2);
    if (h.modeT > (h.p2 ? 2 : 3.2)) { h.lane.start(a, p.x, p.z, h.p2 ? 0.75 : 1.0, h.p2 ? 1.12 : 1); h.voice('deer_call', a); h.setMode('charge'); }
  
}
