// oxlint-disable-next-line import/no-nodejs-modules -- Verify retired physical handoffs remain absent.
import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';

test('native product ownership retires both part jobs and every original physical handoff', () => {
  for (const file of ['questProp.generated.json', 'quest-prop.generated.bin', 'balbalSpecimen.generated.json', 'balbal-carving-0.generated.bin', 'balbal-carving-1.generated.bin']) {
    expect(existsSync(`src/shards/nalati-grasslands/data/${file}`), file).toBe(false);
  }
  for (const file of ['bake-balbal-specimen.mjs', 'bake-quest-prop.mjs']) {
    expect(existsSync(`src/shards/nalati-grasslands/generators/${file}`), file).toBe(false);
  }
});
