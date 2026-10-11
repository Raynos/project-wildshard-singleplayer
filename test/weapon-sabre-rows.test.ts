import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { parseWeaponProfile } from '../src/format/weaponProfiles';
import { parseItems } from '../src/format/items';
import { SweptMeleeCore } from '../src/engine/combat/sweptMeleeCore';
import { app } from '../src/engine/app/runtime';
import type { Move } from '../src/engine/combat/view/melee';
import { SABRE_WEAPON_PROFILE as data } from '../src/shards/nalati-grasslands/data/sabreProfile';
import { NALATI_ITEMS } from '../src/shards/nalati-grasslands/data/items';
import { Sabre, SABRE_PROFILE, SABRE_MOVES, PASS_LEFT, PASS_RIGHT } from '../src/shards/nalati-grasslands/runtime/weapons/Sabre';
import { NAIZAGAI_PROFILE } from '../src/shards/nalati-grasslands/runtime/weapons/Naizagai';
import { fakeWorld } from './fake/world';

beforeEach(() => { vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('window', new EventTarget()); });
afterEach(() => { app.aimTargets = []; Reflect.deleteProperty(globalThis, 'document'); Reflect.deleteProperty(globalThis, 'window'); });

it('admits the sabre on the melee family, preserving the native view, moves and reward profile', () => {
  expect(parseWeaponProfile(data)).toEqual(data);
  const row = parseItems(NALATI_ITEMS).rows.find(item => item.id === 'weapon.sabre');
  if (row?.kind !== 'weapon') throw new Error('Missing sabre row');
  expect(row.family).toBe('melee'); expect(row.profile).toEqual(data);
  expect(row.view.recipe).toBe('nalati-grasslands.sabre');
  expect(row.light.damage).toBe(24); expect(row.heavy.damage).toBe(48);
  expect(SABRE_PROFILE.moves).toBe(SABRE_MOVES);
  expect(SABRE_PROFILE).toMatchObject({ damage: 24, reach: 2.2, swingScale: 0.9,
    mounted: { reach: 2.8, cooldown: 0.7, sense: 6, chainWindow: 3, chainStep: 0.1, chainMax: 1.4, speedDivisor: 12, behind: -2 } });
  for (const field of ['damage', 'reach', 'swingScale', 'cooldown', 'comboGap', 'chainLag', 'heavyCharge', 'lunge', 'sweep', 'mounted'] as const)
    expect(NAIZAGAI_PROFILE[field]).toEqual(SABRE_PROFILE[field]);
  expect(NAIZAGAI_PROFILE.powers.stormMultiplier).toBe(1.25);
  expect(PASS_LEFT).toMatchObject({ windup: 0.09, slashEnd: 0.3, total: 0.5, damage: 1, stagger: 1, sweep: 1, reach: 2.8 });
  expect(PASS_RIGHT).toMatchObject({ windup: 0.09, slashEnd: 0.3, total: 0.5, damage: 1, stagger: 1, sweep: -1, reach: 2.8 });
});

it('preserves the real combo, heavy and pass clocks over mixed deltas and restore', () => {
  const frozen = { ...SABRE_MOVES, combo: SABRE_MOVES.combo.map((move, i) => ({ ...move,
    ...([{ windup: 0.07, slashEnd: 0.24, total: 0.35, damage: 1 },
      { windup: 0.06, slashEnd: 0.22, total: 0.34, damage: 1 },
      { windup: 0.1, slashEnd: 0.28, total: 0.44, damage: 16 / 12 }][i]) })),
    heavy: { ...SABRE_MOVES.heavy, windup: 0.06, slashEnd: 0.3, total: 0.62, damage: 2 } };
  const output: string[][] = [[], []];
  const make = (moves: typeof SABRE_MOVES, events: string[]) => new SweptMeleeCore<Move>(moves,
    { cooldown: 0.08, comboGap: 0.6, chainLag: 0.02, heavyCharge: 0.45 },
    { queue: () => undefined, consume: () => false }, { start: (move, lunge) => { events.push(`${move.name}:${move.damage}:${lunge}`); }, charge: () => undefined });
  const a = make(frozen, output[0] ?? []), b = make(SABRE_MOVES, output[1] ?? []);
  for (let tick = 1; tick <= 10000; tick++) {
    if (tick % 43 === 0) { a.tryFire(); b.tryFire(); }
    const dt = tick % 2 === 0 ? 1 / 120 : 1 / 60, held = tick % 251 < 49;
    expect(b.step(dt, tick / 60, 0.9, held)).toEqual(a.step(dt, tick / 60, 0.9, held));
    expect(b.snapshot()).toEqual(a.snapshot());
    if (tick === 6019) { a.restore(a.snapshot()); b.restore(b.snapshot()); }
  }
  expect(output[1]).toEqual(output[0]); expect(output[0]?.length).toBeGreaterThan(100);
  for (const pass of [PASS_LEFT, PASS_RIGHT]) {
    const left = make(frozen, []), right = make(SABRE_MOVES, []);
    expect(left.strike(pass, false)).toBe(true); expect(right.strike(pass, false)).toBe(true);
    // Mounted passes are outside the saved combo recipe; their unhosted continuation remains an honest gap.
    expect(() => right.snapshot()).toThrow('outside its move set');
    for (let tick = 0; tick < 120; tick++) expect(right.step(1 / 120, tick / 120, 0.9, false)).toEqual(left.step(1 / 120, tick / 120, 0.9, false));
  }
});

class PassOwner extends Sabre {
  readonly contacts: { move: Move; damage: number; lunge: boolean }[] = [];
  override strikeMove(move: Move, lunge = true): boolean { this.contacts.push({ move, damage: this.damage, lunge }); return true; }
  hit(move: Move): void { this.onMoveHit(move); }
}
it('the actual mounted owner selects live sides and retains speed, cooldown, chain and replacement carry', () => {
  const f = fakeWorld(), world = { game: f.game.asGame(), sky: f.sky, player: f.player, forest: f.forest };
  const owner = new PassOwner(world); owner.mount = { speed: 12, yaw: 0 };
  app.aimTargets = [{ alive: true, position: new Vector3(-1, 0, -1) }, { alive: false, position: new Vector3(0.1, 0, -1) }];
  owner.tryFire(); expect(owner.contacts[0]).toEqual({ move: PASS_LEFT, damage: 48, lunge: false });
  owner.tryFire(); expect(owner.contacts).toHaveLength(1);
  owner.hit(PASS_LEFT); owner.update(0.71, 0.71); app.aimTargets = [{ alive: true, position: new Vector3(1, 0, -1) }];
  owner.tryFire(); expect(owner.contacts[1]).toEqual({ move: PASS_RIGHT, damage: 53, lunge: false });
  for (let i = 0; i < 9; i++) { owner.hit(PASS_RIGHT); owner.update(0.71, 1 + i); owner.tryFire(); }
  expect(owner.contacts.at(-1)?.damage).toBe(67);
  const next = new PassOwner(world); next.carryPassState(owner);
  expect(next.passChain).toBe(owner.passChain); expect(next.passChainLeft).toBe(owner.passChainLeft); expect(next.mount).toBe(owner.mount);
  next.update(3.1, 20); expect(next.passChain).toBe(0); next.tryFire(); expect(next.contacts[0]?.damage).toBe(48);
  owner.dispose(); next.dispose();
});
it('refuses invalid mounted clocks, divisors and pass phases before construction', () => {
  const invalid = structuredClone(data); invalid.mounted.speedDivisor = 0;
  expect(() => parseWeaponProfile(invalid)).toThrow(); invalid.mounted.speedDivisor = 12;
  invalid.mounted.chainMax = 0.9; expect(() => parseWeaponProfile(invalid)).toThrow(); invalid.mounted.chainMax = 1.4;
  invalid.moves.passes.left.windup = 0.6; expect(() => parseWeaponProfile(invalid)).toThrow();
});
