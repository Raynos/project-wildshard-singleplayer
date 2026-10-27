import { expect, test } from 'vitest';
import { skyViewData, skyViewValues, skyViewDiscovery } from '../src/shards/far-reach/generators/viewData';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseDiscoveryValues } from '../src/format/discoveryValues';

const originals = [
  ['budgets', 768, '009e1a313a04bd727fd690ad4660922bd340f3d118e2fc0a2c0ee9a8d1a04ebf'],
  ['runtimeCost', 562, '0ba0bc72dfae773c54a63baa1d70742bdc5becfe2e7460f579076665a1af9311'],
  ['devPoses', 902, '32351c105d6b51b5ab92a4add4b7cce4a92312f6fcae816b8da0f99eac89b3c1'],
  ['meadow', 2108, '0c4c5debd4041bbb75b06e72c63a3f236a56934f7aebe362cf9a066cea4a83ec'],
  ['wind', 693, 'a3aa21b3f6687d5c15fca5bad2ba6eec8602d4efa58d587a0e3d1fba407bdeac'],
  ['rayWake', 84, 'c2038e4158fc493c0229b6ce278c4be0f8ca16a00405c3a7acc71c64b0b79018'],
] as const;

test('source view values retain every original byte and detach caller-owned arrays', () => {
  const check = (): void => {
    const files = skyViewData();
    expect([...files.keys()]).toEqual(originals.map(([name]) => `data/${name}.generated.json`));
    for (const [name, size, hash] of originals) {
      const bytes = files.get(`data/${name}.generated.json`);
      if (bytes === undefined) throw new Error('Missing original view value');
      expect(bytes.byteLength).toBe(size); expect(hashImmutableBytes(bytes)).toBe(hash);
    }
  };
  check();
  const changed = skyViewValues();
  changed.meadow.cards[0]?.card.fill(0); Reflect.set(changed.budgets.phone, 'fps', 1);
  Reflect.set(changed.devPoses.spawn.eye, 0, 999); Reflect.set(changed.wind.WIND_FIELDS.gustStreaks, 'count', 1);
  check();
  expect(parseDiscoveryValues(skyViewDiscovery())).toEqual(skyViewDiscovery());
});
