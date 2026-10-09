import { Vector3 } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { AntlerKingCore, pineKingStreams, type KingBody, type KingCoreEnv } from '../../../src/shards/pine-hollow/combat/kingFight';
import { Lane } from '../../../src/shards/pine-hollow/combat/lane';
import { PINE_LANES } from '../../../src/shards/pine-hollow/combat/strikes';
import { KINGS_CLEARING } from '../../../src/shards/pine-hollow/layout';

/** A body the fight drives, renderer-free: it walks at its set motion when the test steps it. */
class Body implements KingBody {
  readonly position: Vector3; readonly lookTarget = new Vector3(); lookWeight = 0; readonly seed = 1; readonly lastHitT = -1; state = 'idle';
  alive = true; readonly scale = 1; yaw = 0; hp: number; readonly maxHp: number; herd = 0; speed = 0;
  constructor(readonly id: string, x: number, z: number, maxHp = 100) { this.position = new Vector3(x, 0, z); this.maxHp = maxHp; this.hp = maxHp; }
  startAttack(): void { /* the rig's wind-up */ }
  cancelAttack(): void { /* the rig's wind-up */ }
  setMotion(yaw: number, speed: number): void { this.yaw = yaw; this.speed = speed; }
  place(x: number, z: number, yaw: number): void { this.position.set(x, 0, z); this.yaw = yaw; }
  move(dt: number): void { this.position.x += Math.sin(this.yaw) * this.speed * dt; this.position.z += Math.cos(this.yaw) * this.speed * dt; }
}

const silentTell = { setTime: (): void => undefined, ring: (): void => undefined, hide: (): void => undefined };

/** The shared fight with no views: bodies made and retired in a list, as a host would. */
class TestKing extends AntlerKingCore<Body> {
  readonly bodies: Body[] = [];
  hurt = 0;
  private made = 0;
  protected override readonly ctx: KingCoreEnv<Body>;
  protected override readonly tellRing = silentTell;
  protected override readonly waves = [0, 1].map(() => ({ r: 0, on: false, hit: false, delay: 0 }));
  protected override readonly lane = new Lane<Body>(PINE_LANES.king);
  protected override readonly thrallLanes = [0, 1, 2].map(() => new Lane<Body>(PINE_LANES.thrall));
  constructor(readonly player: Vector3, seed?: number) {
    super(seed);
    this.ctx = { reach: () => true, player: { position: player, onGround: true, shove: () => undefined }, hurt: (_a, dmg) => { this.hurt += dmg; },
      trauma: () => undefined, shot: () => undefined };
  }
  protected override groundAt(): number { return 0; }
  protected override makeKing(): Body { return this.add(new Body(`king${String(this.made++)}`, KINGS_CLEARING.x, KINGS_CLEARING.z, 2000)); }
  protected override retireKing(k: Body): void { this.drop(k); }
  protected override parkKing(): void { /* stays in the list */ }
  protected override unparkKing(): void { /* stays in the list */ }
  readonly spawned: number[][] = [];
  protected override spawnThrall(kind: 'elk' | 'boar', x: number, z: number, yaw: number): Body { this.spawned.push([x, z]); const a = this.add(new Body(`${kind}${String(this.made++)}`, x, z, 40)); a.yaw = yaw; return a; }
  protected override retireThrall(a: Body): void { this.drop(a); }
  protected override action(): void { /* the rig */ }
  protected override roar(): void { /* the voice */ }
  private add(b: Body): Body { this.bodies.push(b); return b; }
  private drop(b: Body): void { const i = this.bodies.indexOf(b); if (i !== -1) this.bodies.splice(i, 1); }
  find(id: string): Body | null { return this.bodies.find(b => b.id === id) ?? null; }
  thrallSpots(): number[][] { return this.thralls.map(th => [th.a.position.x, th.a.position.z]); }
  step(dt: number, t: number): void { this.update(dt, t, true); for (const b of this.bodies) b.move(dt); }
}

afterEach(() => { vi.restoreAllMocks(); });

it('rolls the King\'s two streams from the level seed alone: the same every boot of a seed, another seed another fight', () => {
  const a = pineKingStreams(), b = pineKingStreams(), c = pineKingStreams(7);
  const rolls = (s: ReturnType<typeof pineKingStreams>): number[] => [s.call.next(), s.call.next(), s.charge.next()];
  const first = rolls(a);
  expect(rolls(b)).toEqual(first); expect(rolls(c)).not.toEqual(first);
  expect(first.every(x => x >= 0 && x < 1)).toBe(true);
});

/** Fight from the phase II checkpoint (lanterns down, thralls on call) with the player 9 m south of him, for `ticks`. */
function phase2(king: TestKing, ticks: number): void {
  king.setPresent(true); king.reset(1); king.seal(true); king.begin(1);
  for (let i = 0; i < ticks; i++) king.step(1 / 60, i / 60);
}

it('calls thralls out of the fog on the level seed\'s call stream, and their charges on its charge stream (no Math.random)', () => {
  vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('the King rolls Math.random'); });
  const player = new Vector3(KINGS_CLEARING.x, 0, KINGS_CLEARING.z + 9);
  const a = new TestKing(player.clone()), b = new TestKing(player.clone());
  phase2(a, 600); phase2(b, 600);
  expect(a.thrallSpots().length).toBeGreaterThan(0);
  expect(b.thrallSpots()).toEqual(a.thrallSpots());
  // each thrall walked in from 27 m out, at the angles the call stream drew
  const calls = pineKingStreams().call, first = calls.next() * Math.PI * 2;
  expect(a.spawned[0]?.[0]).toBeCloseTo(KINGS_CLEARING.x + Math.sin(first) * 27, 9); expect(a.spawned[0]?.[1]).toBeCloseTo(KINGS_CLEARING.z + Math.cos(first) * 27, 9);
  expect(a.hurt).toBeGreaterThan(0);
  const other = new TestKing(player.clone(), 7); phase2(other, 600);
  expect(other.thrallSpots()).not.toEqual(a.thrallSpots());
});

it('restores its whole fight from its plain state mid-phase II: the same moves, thralls and charges after', () => {
  const player = new Vector3(KINGS_CLEARING.x, 0, KINGS_CLEARING.z + 9);
  const original = new TestKing(player.clone());
  phase2(original, 420);
  const state = original.fightState(b => b.id), hurtBefore = original.hurt;
  expect(state.thralls.length).toBeGreaterThan(0); expect(state.lanterns.every(f => f.fallT === 1)).toBe(true);
  // a second fight whose bodies stand where the first's do (the host reinstalls them), then the fight's state
  const restored = new TestKing(player.clone());
  for (const b of original.bodies) { const copy = Object.assign(new Body(b.id, b.position.x, b.position.z, b.maxHp), { hp: b.hp, yaw: b.yaw, speed: b.speed, alive: b.alive }); restored.bodies.push(copy); }
  restored.restoreFight(structuredClone(state), id => restored.find(id));
  expect(restored.fightState(b => b.id)).toEqual(state);
  for (let i = 420; i < 900; i++) { original.step(1 / 60, i / 60); restored.step(1 / 60, i / 60); }
  expect(restored.fightState(b => b.id)).toEqual(original.fightState(b => b.id));
  expect(restored.hurt).toBe(original.hurt - hurtBefore);
  expect(restored.bodies.map(b => [b.id, b.position.x, b.position.z, b.hp])).toEqual(original.bodies.map(b => [b.id, b.position.x, b.position.z, b.hp]));
});
