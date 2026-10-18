import { beforeAll, expect, test, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Standalone cold fixtures use the gate's official product producer.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse only the gate's exact-SHA product prerequisite.
import { env, execPath } from 'node:process';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { NPC_FIGURE } from '../src/shards/pine-hollow/generators/peopleLook';
import { FigureCatalogue } from '../src/sdk/npc/figures';
import * as packs from '../src/sdk/kit/geometryPack';
import { FigureRows } from '../src/game/systems/npc/figureRows';
import packed from '../src/shards/pine-hollow/data/codeParts.json' with { type: 'json' };

beforeAll(() => {
  const built = env['WS_TEST_PRODUCTS_SHA'];
  if (built === undefined || !/^[a-f0-9]{40}$/u.test(built) || built !== env['VERCEL_GIT_COMMIT_SHA']) {
    execFileSync(execPath, ['scripts/build-shardfiles.mjs', '--reuse', '--shard=pine-hollow'], { stdio: 'inherit' });
  }
}, 120_000);

// Malformed rows replace only the value under test. Every boot dependency comes
// from the complete generated product, so a new named file needs no fixture edit.
function product(base: ShardProduct, value: unknown): ShardProduct {
  return { ...base, file: name => name === 'people/catalogue.json'
    ? Promise.resolve(new TextEncoder().encode(JSON.stringify(value))) : base.file(name) };
}

test('NPC catalogue admission preserves rows, refuses atomically and prepares cold cards', async () => {
  const figures = new FigureCatalogue('pine-hollow', 'people/catalogue.json');
  expect(() => figures.rows('ranger')).toThrow('not admitted');
  const admitted = await loadHeadlessProduct('out/pine-hollow');
  const json: unknown = JSON.parse(new TextDecoder().decode(await admitted.file('people/catalogue.json')));
  const packsLoad = vi.spyOn(packs, 'fetchDeflated').mockResolvedValue(new Uint8Array(packed.rows.bytes));
  const skinsLoad = vi.spyOn(FigureRows, 'prepareSkins').mockResolvedValue();
  const fetch = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(admitted);
  try {
    await figures.admit(admitted);
    const previous = figures.rows('ranger');
    expect(previous.motion).toEqual(NPC_FIGURE);
    await expect(figures.admit(product(admitted, { extra: true }))).rejects.toThrow();
    expect(figures.rows('ranger')).toBe(previous);
    await figures.admit(product(admitted, json));
    const models = ['ranger', 'miller', 'trader'].map(id => figures.model(id));
    for (const model of models) {
      if (model.prepare === undefined) throw new Error('Cold NPC card has no prepare');
      await model.prepare();
      expect(figures.rows('ranger').motion).toEqual(NPC_FIGURE);
    }
    for (const model of models) { expect(model.pipeline).toEqual(['hunyuan', 'code']); expect(model.rig?.clips).toEqual(['idle', 'talk', 'point']); }
    expect(models.map(row => row.id)).toEqual(['pine-hollow/ranger-hale', 'pine-hollow/miller-brandt', 'pine-hollow/trader-mott']);
    expect(models.map(row => row.name)).toEqual(['Hale, ranger of the Hollow', 'Brandt, the miller', 'Mott, the trader']);
  } finally { fetch.mockRestore(); packsLoad.mockRestore(); skinsLoad.mockRestore(); }
});
