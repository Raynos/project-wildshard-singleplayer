import { expect, it } from 'vitest';
import { ACCENTS, ACCENT_IDS, parseAccent } from '@wildshard/sdk/accent';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { validateProject } from '@wildshard/sdk/project';
import { emptyShardfileSource, installManifestShardfile } from '../src/game/shardfile/loader';
import type { ShardfileClientBindings } from '../src/game/shardfile/client';
import type { ShardManifest } from '../src/game/shard/manifest';
import template from '../src/shards/_template/shard.config';

const empty = () => emptyShardfile({ slug: 'accent-fixture', name: 'Accent fixture', author: 'Test', revision: 1, seed: 1 });

it('admits all 20 palette IDs from one asset-validated author base', () => {
  // Accent changes have no asset or residency effect; admit the expensive worst-location envelope once.
  const base = validateProject(empty(), new Map());
  expect(ACCENT_IDS).toHaveLength(20);
  for (const accent of ACCENT_IDS) {
    expect(parseAccent(accent)).toBe(accent);
    expect(parseShardfile({ ...base, accent }).accent).toBe(accent);
    expect(ACCENTS[accent]).toMatch(/^#[a-f0-9]{6}$/u);
  }
  expect(base.accent).toBe('sand'); expect(template.accent).toBe('sand');
});

it('requires an explicit palette ID and refuses the reserved cyan by name and hex', () => {
  const { accent: _accent, ...missing } = empty();
  expect(() => parseShardfile(missing)).toThrow();
  for (const accent of ['cyan', 'CYAN', 'road', 'hud-cyan', '#8fe3ff', '#8FE3FF', '#beaf91', 'sky', '', null, 20]) {
    expect(() => parseAccent(accent)).toThrow();
    expect(() => validateProject({ ...empty(), accent }, new Map())).toThrow();
  }
});

it('hydrates the admitted accent rather than the picker manifest accent', async () => {
  const base = empty();
  const source = parseShardfile({ ...base, identity: { ...base.identity, slug: 'template' }, accent: 'moss' });
  expect(emptyShardfileSource(source).accent).toBe('moss');
  const selected: ShardManifest = { ...emptyShardfileSource(source), slug: '_template', accent: parseAccent('ember'), shardfile: '/shardfiles/accent-fixture/shard.json' };
  const bindings: ShardfileClientBindings = { instance: 'fixture', catalogue: [], items: new Map(), recipes: new Map(), icon: () => 'glyph', voices: () => new Map() };
  const hydrated = await installManifestShardfile(selected, { base: 'https://accent.test/', firstParty: true, offline: false,
    fetch: () => Promise.resolve(Response.json(source)), hash: () => Promise.reject(new Error('No assets')),
    cache: { product: () => Promise.resolve(null), asset: () => Promise.resolve(null), putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() },
  }, bindings);
  expect(hydrated.accent).toBe('moss');
});
