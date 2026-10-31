import { expect, test } from 'vitest';
import { Scene, Vector3 } from 'three';
import { app } from '../src/engine/app/runtime';
import { RngService } from '../src/engine/core/rng';
import { installCoinModel } from '../src/game/loot/coinModel';
import { coinGeometry } from '../src/game/generators/pickups';
import { CoinBurst } from '../src/game/loot/CoinBurst';
import { Owned } from '../src/game/loot/Owned';
import { Bounty } from '../src/game/loot/Bounty';
import { ownedSave, bountySave } from '../src/game/saves';

function play(burst: CoinBurst) {
  const events: string[] = [], frames: number[][] = [];
  const at = new Vector3(3, 4, 5), player = new Vector3(1, 2, 3);
  for (let i = 0; i < 5; i++) burst.spawn(at, 25, n => { events.push(`coin:${i}:${n}`); }, () => { events.push(`done:${i}`); });
  for (let i = 0; i < 200; i++) {
    player.x = i < 30 ? 1 : 100;
    burst.update(1 / 60, player);
    const values = burst.mesh.instanceMatrix.array;
    frames.push([burst.inFlight, burst.mesh.count, ...new Uint32Array(values.buffer, values.byteOffset, values.length)]);
  }
  return { events, frames };
}

test('a native cosmetic stream matches every page burst word, draw and callback through pool overflow', () => {
  installCoinModel(coinGeometry);
  const saved = app.rng.snapshot(), local = new RngService(710);
  const page = new CoinBurst(new Scene()); let calls = 0;
  const native = new CoinBurst(new Scene(), () => { calls++; return local.stream('cosmetic').next(); });
  try {
    expect(calls).toBe(0); expect(local.snapshot().streams).toEqual([]);
    app.rng.seed(710);
    const expected = play(page), wantedRng = app.rng.snapshot();
    const actual = play(native);
    expect(actual).toEqual(expected);
    expect(local.snapshot()).toEqual(wantedRng);
    expect(calls).toBe(5 + 48 * 5);
    expect(actual.events.filter(value => value.startsWith('coin:')).length).toBe(60);
    expect(actual.events.filter(value => value.startsWith('done:')).length).toBe(5);
    expect(actual.frames.at(-1)?.slice(0, 2)).toEqual([0, 0]);
  } finally { page.dispose(); native.dispose(); app.rng.restore(saved); }
});

test('owned continuation storage preserves page filtering, writes and notifications', () => {
  const id = 'continuation-owned';
  const original = ownedSave.read(id);
  let durable = { owned: ['cape', 'whetstone-1', 'not-an-item'], worn: ['cape', 'heart-1'] };
  const writes: string[] = [], events: string[] = [];
  try {
    ownedSave.write(structuredClone(durable), id);
    const page = new Owned(id), native = new Owned(`chunk://local/${id}`, {
      read: slug => { expect(slug).toBe(id); return structuredClone(durable); },
      write: (value, slug) => { expect(slug).toBe(id); durable = structuredClone(value); writes.push(JSON.stringify(value)); return true; },
    });
    page.onChange(() => { events.push('page'); }); native.onChange(() => { events.push('native'); });
    expect(native.all).toEqual(page.all); expect(native.worn('cape')).toBe(true);
    expect(native.grant('heart-1')).toBe(page.grant('heart-1'));
    expect(native.grant('heart-1')).toBe(page.grant('heart-1'));
    native.takeOff('cape'); page.takeOff('cape');
    native.wear('cape'); page.wear('cape');
    native.revoke('cape'); page.revoke('cape');
    expect(durable).toEqual(ownedSave.read(id));
    expect(events).toEqual(['native', 'page', 'native', 'page', 'native', 'page', 'native', 'page']);
    expect(writes).toHaveLength(4);
    expect(() => native.grant('unknown')).toThrow('Unknown owned identity');
  } finally { ownedSave.write(original, id); }
});

test('bounty continuation storage keeps the original paid slots and late-kind cap', () => {
  const id = 'continuation-bounty', original = bountySave.read(id);
  let durable: Record<string, number> = { 'crab:2': 1 };
  const targets = [{ kind: 'crab', herd: 2, alive: true }, { kind: 'crab', herd: 2, alive: true }];
  try {
    bountySave.write({ ...durable }, id);
    const page = new Bounty(id, Bounty.census(targets));
    const native = new Bounty(`chunk://local/${id}`, Bounty.census(targets), {
      read: slug => { expect(slug).toBe(id); return { ...durable }; },
      write: (value, slug) => { expect(slug).toBe(id); durable = { ...value }; return true; },
    });
    for (const target of [...targets, { kind: 'captain', herd: -1, alive: true }, { kind: 'captain', herd: -1, alive: true }]) {
      expect(native.left(target)).toBe(page.left(target)); expect(native.claim(target)).toBe(page.claim(target));
    }
    expect(durable).toEqual(bountySave.read(id));
    expect(new Bounty(id, Bounty.census(targets), { read: () => durable, write: () => true }).claim(targets[0] ?? { kind: 'crab', herd: 2 })).toBe(false);
  } finally { bountySave.write(original, id); }
});
