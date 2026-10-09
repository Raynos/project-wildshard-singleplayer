// @vitest-environment happy-dom
// SF72 (E435): the hunting brain (senses, alert, flee, stalk, charge, the E297 ring, herd panic, hit reactions) and the
// herd placement recipe left AnimalManager for the renderer-free src/engine/ai/hunt.ts. This oracle pins the browser's
// behaviour across that move: the digests below were recorded from the pre-extraction AnimalManager (0f2ce839a) on the
// same scripted inputs, and every think tick's decisions, motion and the shared Rng(SEED + 31) stream must match
// them bit for bit — per family (grazer, charger, hunter) and per fight style (crossbow, telegraphed, E297 rules).
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { withOwner } from '../../src/engine/app/ownership';
import { AnimalManager } from '../../src/engine/entities/AnimalManager';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { Rng } from '../../src/engine/core/rng';
import { activeLevel, bindLevelSelection } from '../../src/engine/level/selection';
import type { FightRules, LevelSpec } from '../../src/engine/level/spec';
import { heightAt } from '../../src/engine/world/Heightfield';
import { fakeWorld } from '../fake/world';
import { legacyDouble } from '../fake/FakeGame';
import type { Forest } from '../../src/engine/world/forest/Forest';

const FAMILIES = { grazer: [['deer', 3], ['elk', 2]], charger: [['boar', 3]], hunter: [['bear', 3]] } as const;
const STYLES: Readonly<Record<string, FightRules>> = { crossbow: { telegraphed: false }, telegraphed: { telegraphed: true }, rules: { telegraphed: true, attackers: 2 } };
const FRAMES = 4400, DT = 0.05;

/** FNV-1a over the exact bits of every number (and the char codes of every string) */
class Digest {
  private h = 0x811c9dc5; private readonly f = new Float64Array(1); private readonly u = new Uint32Array(this.f.buffer);
  num(x: number): void { this.f[0] = x; this.mix(this.u[0] ?? 0); this.mix(this.u[1] ?? 0); }
  str(s: string): void { for (let i = 0; i < s.length; i++) this.mix(s.codePointAt(i) ?? 0); this.mix(0xff); }
  private mix(w: number): void { this.h = Math.imul(this.h ^ w, 0x01000193) >>> 0; }
  get hex(): string { return this.h.toString(16).padStart(8, '0'); }
}

function sharedRng(manager: AnimalManager): Rng {
  const rng: unknown = Reflect.get(manager, 'rng');
  if (!(rng instanceof Rng)) throw new Error('AnimalManager lost its shared Rng(SEED + 31)');
  return rng;
}

/** BloodFX draws its droplet sprite on a 2d canvas, which happy-dom lacks: a no-op 2d context while `fn` runs */
function withCanvas2d(fn: () => void): void {
  const proto = HTMLCanvasElement.prototype, saved = Object.getOwnPropertyDescriptor(proto, 'getContext');
  Object.defineProperty(proto, 'getContext', { configurable: true, value: () => ({ createRadialGradient: () => ({ addColorStop: () => undefined }), fillRect: () => undefined, fillStyle: '' }) });
  try { fn(); } finally { if (saved === undefined) Reflect.deleteProperty(proto, 'getContext'); else Object.defineProperty(proto, 'getContext', saved); }
}

let fakeMs = 0;
beforeEach(() => { fakeMs = 0; vi.spyOn(performance, 'now').mockImplementation(() => fakeMs); });
afterEach(() => { vi.restoreAllMocks(); });

function run(family: keyof typeof FAMILIES, style: string): { digest: string; thinks: number; states: Record<string, number>; events: number } {
  const fight = STYLES[style];
  if (fight === undefined) throw new Error(style);
  const base = activeLevel();
  const level: LevelSpec = { ...base, fight: { ...base.fight, ...fight, ...(fight.attackers === undefined ? { attackers: Infinity } : {}) }, spawns: [], faunaTuning: {} };
  const unbind = bindLevelSelection(level);
  const scope = new Scope(`hunt-oracle-${family}-${style}`);
  try {
    return withOwner(scope, () => {
      const f = fakeWorld(), animals = new AnimalManager(new Scene(), f.sky, f.forest, { style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true } });
      withCanvas2d(() => { animals.build(); });
      const d = new Digest();
      let events = 0;
      animals.onSound = (name, at) => { events++; d.str(name); d.num(at.x); d.num(at.z); };
      animals.onCharge = (a, dmg) => { events++; d.str(`charge:${a.entityId}`); d.num(dmg); };
      animals.onWindup = (a, dur) => { events++; d.str(`windup:${a.entityId}`); d.num(dur); };
      // the herds: a clearing 40 m east of the origin, every family in herds of its kinds
      const members: Animal[] = [];
      for (const [kind, count] of FAMILIES[family]) {
        const herd = animals.addHerd(kind, 40, 10 * members.length), h = animals.herds[herd];
        if (h === undefined) throw new Error('herd');
        for (let i = 0; i < count; i++) {
          const a = animals.spawn(kind, 40 + i * 3, 10 * members.length + i * 2, i, kind);
          a.herd = herd; h.members.push(a); members.push(a);
        }
      }
      let thinks = 0;
      const take = animals.scheduler.takeBrainDt.bind(animals.scheduler);
      vi.spyOn(animals.scheduler, 'takeBrainDt').mockImplementation((rate, actor) => { const dt = take(rate, actor); if (dt > 0) thinks++; return dt; });
      // the player: a seeded walk between waypoints round the herds, at still / crouch / walk / sprint, with shots
      const script = new Rng(7), player = new Vector3(0, 0, 0), goal = new Vector3(), dir = new Vector3(1, 0, 0);
      let speed = 0, leg = 0, sprint = false;
      const states: Record<string, number> = {};
      for (let frame = 0; frame < FRAMES; frame++) {
        fakeMs += DT * 1000;
        if (leg <= 0) {
          const anchor = members[Math.floor(script.next() * members.length)] ?? members[0];
          if (anchor === undefined) throw new Error('no members');
          const ang = script.next() * Math.PI * 2, r = 3 + script.next() * 45;
          goal.set(anchor.position.x + Math.cos(ang) * r, 0, anchor.position.z + Math.sin(ang) * r);
          speed = [0, 2.2, 4.3, 7.2][Math.floor(script.next() * 4)] ?? 0; sprint = speed > 7; leg = 2 + script.next() * 8;
        }
        leg -= DT;
        dir.set(goal.x - player.x, 0, goal.z - player.z);
        const dist = dir.length();
        if (dist > 0.2) player.addScaledVector(dir.divideScalar(dist), Math.min(dist, speed * DT));
        player.y = heightAt(player.x, player.z);
        if (frame % 397 === 200) animals.disturb(new Vector3(player.x + 6, player.y, player.z - 4));
        if (frame % 613 === 300) {
          const target = members[frame % members.length];
          if (target?.alive === true) target.applyFinalDamage(9, target.position.clone().setY(target.position.y + 0.8), new Vector3(1, 0, 0));
        }
        if (frame % 151 === 75) for (const a of members) if (a.alive && a.state === 'charge') a.stagger(new Vector3(0, 0, 1), (frame % 3) / 2);
        if (frame % 1000 === 999) for (const a of members) if (a.alive) a.hp = a.maxHp;
        animals.update(DT, frame * DT, player, sprint);
        for (const a of members) {
          states[a.state] = (states[a.state] ?? 0) + 1;
          d.str(a.state); d.num(a.position.x); d.num(a.position.y); d.num(a.position.z); d.num(a.yaw); d.num(a.speed);
          d.num(a.desiredYaw); d.num(a.desiredSpeed); d.num(a.turnRate); d.num(a.lookWeight); d.num(a.hp);
          const motion = a.snapshot().motion;
          d.num(a.lookTarget.x); d.num(a.lookTarget.z); d.num(motion.attackT); d.num(motion.stunT);
        }
        d.num(sharedRng(animals).snapshot().state);
      }
      return { digest: d.hex, thinks, states, events };
    });
  } finally { scope.dispose(); unbind(); }
}

/** recorded from the pre-extraction AnimalManager (see the header) */
const GOLDEN: Readonly<Record<string, unknown>> = {
  'grazer/crossbow': {"digest":"8af45b32","thinks":12473,"states":{"idle":2662,"wander":3466,"graze":8347,"alert":3499,"flee":4026},"events":89},
  'grazer/telegraphed': {"digest":"8af45b32","thinks":12473,"states":{"idle":2662,"wander":3466,"graze":8347,"alert":3499,"flee":4026},"events":89},
  'grazer/rules': {"digest":"8af45b32","thinks":12473,"states":{"idle":2662,"wander":3466,"graze":8347,"alert":3499,"flee":4026},"events":89},
  'charger/crossbow': {"digest":"84be2758","thinks":10694,"states":{"idle":547,"wander":2323,"alert":1990,"flee":2117,"graze":6108,"charge":115},"events":122},
  'charger/telegraphed': {"digest":"7cdeb296","thinks":11526,"states":{"idle":925,"wander":2876,"alert":2393,"flee":2735,"graze":4171,"charge":100},"events":121},
  'charger/rules': {"digest":"aa448e84","thinks":13200,"states":{"idle":246,"wander":853,"alert":365,"stalk":9423,"charge":1902,"graze":411},"events":491},
  'hunter/crossbow': {"digest":"6875e075","thinks":13200,"states":{"idle":85,"alert":83,"stalk":10324,"charge":2708},"events":867},
  'hunter/telegraphed': {"digest":"601d1c57","thinks":13200,"states":{"idle":85,"alert":83,"stalk":9211,"charge":3821},"events":652},
  'hunter/rules': {"digest":"dccc6b68","thinks":13200,"states":{"idle":85,"alert":83,"stalk":10376,"charge":2656},"events":554},
  'placement': {"level":"driftwood-isle","herds":5,"animals":13,"digest":"640562b7"},
};

it.each(Object.keys(FAMILIES).flatMap(family => Object.keys(STYLES).map(style => [family, style] as const)))('%s / %s: the hunting brain decides exactly as before', (family, style) => {
  const got = run(family as keyof typeof FAMILIES, style);
  expect(got.thinks).toBeGreaterThanOrEqual(10_000);
  expect(got).toEqual(GOLDEN[`${family}/${style}`]);
});

/** the herd placement recipe (the draws that pick herd centres and members, then each spawn's rolls) on the test level's own plans */
it('places the shard\'s herds exactly as before', () => {
  const scope = new Scope('hunt-oracle-placement');
  try {
    const got = withOwner(scope, () => {
      const f = fakeWorld(), forest = legacyDouble<Forest>({ nearby: (): [] => [], trees: [] });
      const animals = new AnimalManager(new Scene(), f.sky, forest, { style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true } });
      withCanvas2d(() => { animals.build(); });
      const d = new Digest();
      for (const h of animals.herds) { d.str(h.kind); d.num(h.cx); d.num(h.cz); d.num(h.members.length); }
      for (const a of animals.animals) { d.str(a.kind); d.str(a.variant); d.num(a.position.x); d.num(a.position.z); d.num(a.yaw); d.num(a.seed); d.num(a.scale); d.num(a.hp); d.num(a.herd); }
      d.num(sharedRng(animals).snapshot().state);
      return { level: activeLevel().id, herds: animals.herds.length, animals: animals.animals.length, digest: d.hex };
    });
    expect(got).toEqual(GOLDEN['placement']);
  } finally { scope.dispose(); }
});
