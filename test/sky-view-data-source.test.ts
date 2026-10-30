import { expect, test } from 'vitest';
import { skyViewData, skyViewValues, skyViewDiscovery } from '../src/shards/far-reach/generators/viewData';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseDiscoveryValues } from '../src/format/discoveryValues';

const names = ['budgets', 'runtimeCost', 'devPoses', 'meadow', 'wind', 'rayWake'] as const;

test('source view values detach caller-owned arrays and retain current complete bytes', () => {
  const expected = new Map([...skyViewData()].map(([name, bytes]) => [name, { bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }]));
  const check = (): void => {
    const files = skyViewData();
    expect([...files.keys()]).toEqual(names.map(name => `data/${name}.generated.json`));
    for (const name of names) {
      const bytes = files.get(`data/${name}.generated.json`);
      if (bytes === undefined) throw new Error('Missing original view value');
      expect(bytes.byteLength).toBe(expected.get(`data/${name}.generated.json`)?.bytes);
      expect(hashImmutableBytes(bytes)).toBe(expected.get(`data/${name}.generated.json`)?.hash);
    }
  };
  check();
  const changed = skyViewValues();
  changed.meadow.cards[0]?.card.fill(0); Reflect.set(changed.budgets.phone, 'fps', 1);
  Reflect.set(changed.devPoses.spawn.eye, 0, 999); Reflect.set(changed.wind.WIND_FIELDS.gustStreaks, 'count', 1);
  check();
  expect(parseDiscoveryValues(skyViewDiscovery())).toEqual(skyViewDiscovery());
});
