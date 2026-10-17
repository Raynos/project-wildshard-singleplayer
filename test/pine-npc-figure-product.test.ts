import { beforeAll, expect, test, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Standalone cold fixtures use the gate's official product producer.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse only the gate's exact-SHA product prerequisite.
import { env, execPath } from 'node:process';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { NPC_FIGURE } from '../src/shards/pine-hollow/generators/peopleLook';
import { loadNpcFigureRows, npcFigureRows } from '../src/shards/pine-hollow/runtime/npc/standInPerson';
import { rangerHale, millerBrandt, traderMott } from '../src/shards/pine-hollow/runtime/models/people';
import * as codeParts from '../src/shards/pine-hollow/runtime/world/codeParts';

beforeAll(() => {
  const built = env['WS_TEST_PRODUCTS_SHA'];
  if (built === undefined || !/^[a-f0-9]{40}$/u.test(built) || built !== env['VERCEL_GIT_COMMIT_SHA']) {
    execFileSync(execPath, ['scripts/build-shardfiles.mjs', '--reuse', '--shard=pine-hollow'], { stdio: 'inherit' });
  }
}, 120_000);

// Malformed rows replace only the value under test. Every boot dependency comes
// from the complete generated product, so a new named file needs no fixture edit.
function product(base: ShardProduct, value: unknown): ShardProduct {
  return { ...base, file: name => name === 'people/figure.json'
    ? Promise.resolve(new TextEncoder().encode(JSON.stringify(value))) : base.file(name) };
}

test('NPC figure admission keeps every authored number, refuses malformed rows atomically and prepares cold cards', async () => {
  expect(npcFigureRows).toThrow('not admitted');
  const admitted = await loadHeadlessProduct('out/pine-hollow');
  await loadNpcFigureRows(admitted);
  const previous = npcFigureRows();
  expect(previous).toEqual(NPC_FIGURE);
  await expect(loadNpcFigureRows(product(admitted, { ...NPC_FIGURE, extra: true }))).rejects.toThrow();
  await expect(loadNpcFigureRows(product(admitted, { ...NPC_FIGURE, flame: { ...NPC_FIGURE.flame, color: [1, 2] } }))).rejects.toThrow();
  await expect(loadNpcFigureRows(product(admitted, { ...NPC_FIGURE, walk: { speed: 'bad', cycle: 1 } }))).rejects.toThrow();
  expect(npcFigureRows()).toBe(previous);
  const fetch = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(admitted);
  const parts = vi.spyOn(codeParts, 'loadCodeParts').mockResolvedValue();
  try {
    const models = [rangerHale, millerBrandt, traderMott];
    for (const model of models) {
      if (model.prepare === undefined) throw new Error('Cold NPC card has no prepare');
      await model.prepare();
      expect(npcFigureRows()).toEqual(NPC_FIGURE);
    }
    expect(models.map(row => row.id)).toEqual(['pine-hollow/ranger-hale', 'pine-hollow/miller-brandt', 'pine-hollow/trader-mott']);
    expect(models.map(row => row.name)).toEqual(['Hale, ranger of the Hollow', 'Brandt, the miller', 'Mott, the trader']);
    expect(parts).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledTimes(3);
  } finally { fetch.mockRestore(); parts.mockRestore(); }
});
