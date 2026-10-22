import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { ShardContext } from '../src/game/plugin/context';
import type { SpeciesDecisionAuthority } from '../src/game/plugin/brain';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { CLIENT_FEATURES, admitClientPlan, installClientPhase } from '../src/game/shardfile/clientPlan';
import { parseClientPlan } from '../src/format/clientPlan';
import * as claims from '../src/game/shardfile/heldClaimsEntry';
import * as creatures from '../src/game/population/productCreatures';
import * as decisions from '../src/game/shardfile/borrowedDecisions';
import { legacyDouble } from './fake/FakeGame';

function fixture(namedFile = true, omitLegacy?: 'economy/loot' | 'look/hull-book') {
  const source = emptyShardfile({ slug: 'kit-orchard', name: 'Orchard', author: 'Fixture', revision: 1, seed: 7 });
  const sections = new Map<string, unknown>([['held/arms', {}], ['actors/species-programs', {}], ['economy/loot', {}], ['look/hull-book', {}]]);
  if (omitLegacy !== undefined) sections.delete(omitLegacy);
  const files = new Map<string, { hash: string; url: string }>();
  if (namedFile) files.set('actors/creature-install.json', { hash: '0'.repeat(64), url: 'https://example.invalid/creature-install.json' });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections, files,
    read: () => Promise.reject(new Error('No fixture read permitted')) });
  const scope = new Scope('kit-orchard'), ctx = legacyDouble<ShardContext>({ scope, product });
  return { scope, ctx };
}
const authorityFixture = (): SpeciesDecisionAuthority => ({ bind: () => { throw new Error('No actor binding in phase-order fixture'); } });
const pair = [{ kind: 'held.claims.install', claims: 'orchard.claims' }, { kind: 'held.claims.prepare', id: 'orchard.claims' }];

test('unordered kit rows retain prepare, creatures, install, paths and catalogue order', async () => {
  const f = fixture(), order: string[] = [], authority = authorityFixture();
  const prepare = vi.spyOn(claims, 'prepareHeldClaimsEntry').mockImplementation((_ctx, id) => { order.push(`prepare:${id}`); return Promise.resolve(); });
  const install = vi.spyOn(claims, 'installHeldClaimsEntry').mockImplementation((_ctx, id) => { order.push(`install:${id}`); });
  const decision = vi.spyOn(decisions, 'pageDecisionAuthority').mockResolvedValue(authority);
  const populate = vi.spyOn(creatures, 'installProductCreatures').mockImplementation((_ctx, value) => { expect(value).toBe(authority); order.push('creatures'); return Promise.resolve(); });
  const path = vi.spyOn(CLIENT_FEATURES['world.paths'], 'install').mockImplementation(() => { order.push('paths'); });
  const items = vi.spyOn(CLIENT_FEATURES['content.catalogue'], 'install').mockImplementation(() => { order.push('catalogue'); });
  try {
    const plan = admitClientPlan({ version: 1, features: [
      { kind: 'content.catalogue', quests: false, finishes: false, weapons: [], ammunition: [], effects: [], compendiums: [], encounters: [] },
      pair[0], { kind: 'population.product-creatures' }, { kind: 'world.paths', rows: { id: 'orchard.paths', name: 'Orchard paths' } }, pair[1],
    ] }, f.ctx.product);
    await installClientPhase(f.ctx, plan, 'kit', f.scope, 'resident');
    expect(order).toEqual([]);
    await installClientPhase(f.ctx, plan, 'kit', f.scope, 'entered');
    expect(order).toEqual(['prepare:orchard.claims', 'creatures', 'install:orchard.claims', 'paths', 'catalogue']);
    expect(decision).toHaveBeenCalledOnce();
  } finally { prepare.mockRestore(); install.mockRestore(); decision.mockRestore(); populate.mockRestore(); path.mockRestore(); items.mockRestore(); f.scope.dispose(); }
});

test('missing, mismatched and duplicate claims pairs refuse before allocation', () => {
  const f = fixture(), prepare = vi.spyOn(claims, 'prepareHeldClaimsEntry');
  try {
    for (const features of [[pair[0]], [pair[1]], [pair[0], { kind: 'held.claims.prepare', id: 'other.claims' }], [...pair, pair[1]]])
      expect(() => admitClientPlan({ version: 1, features }, f.ctx.product)).toThrow();
    expect(prepare).not.toHaveBeenCalled();
  } finally { prepare.mockRestore(); f.scope.dispose(); }
});

test('creature rows need their fixed admitted file before either claims effect', () => {
  const f = fixture(false), prepare = vi.spyOn(claims, 'prepareHeldClaimsEntry');
  try {
    expect(() => admitClientPlan({ version: 1, features: [...pair, { kind: 'population.product-creatures' }] }, f.ctx.product)).toThrow('admitted install rows');
    expect(prepare).not.toHaveBeenCalled();
    expect(() => parseClientPlan({ version: 1, features: [{ kind: 'population.product-creatures', file: 'ignored.json' }] })).toThrow();
  } finally { prepare.mockRestore(); f.scope.dispose(); }
});

test('leaving during decision-authority preparation constructs no product creatures', async () => {
  const f = fixture(), authority = authorityFixture();
  let finish: ((value: SpeciesDecisionAuthority) => void) | undefined, announce: (() => void) | undefined;
  const ready = new Promise<void>(resolve => { announce = resolve; });
  const pending = new Promise<SpeciesDecisionAuthority>(resolve => { finish = resolve; });
  const prepare = vi.spyOn(claims, 'prepareHeldClaimsEntry').mockResolvedValue(undefined);
  const install = vi.spyOn(claims, 'installHeldClaimsEntry');
  const decision = vi.spyOn(decisions, 'pageDecisionAuthority').mockImplementation(() => {
    if (announce === undefined) throw new Error('Missing preparation notification'); announce(); return pending;
  });
  const populate = vi.spyOn(creatures, 'installProductCreatures');
  try {
    const plan = admitClientPlan({ version: 1, features: [...pair, { kind: 'population.product-creatures' }] }, f.ctx.product);
    const entering = installClientPhase(f.ctx, plan, 'kit', f.scope);
    const refused = expect(entering).rejects.toThrow('owner is disposed');
    await ready; f.scope.dispose();
    if (finish === undefined) throw new Error('Missing decision-authority resolver'); finish(authority);
    await refused;
    expect(populate).not.toHaveBeenCalled(); expect(install).not.toHaveBeenCalled();
  } finally { prepare.mockRestore(); install.mockRestore(); decision.mockRestore(); populate.mockRestore(); f.scope.dispose(); }
});


test.each(['economy/loot', 'look/hull-book'] as const)('the existing %s owner is required before any entered effect', name => {
  const f = fixture(true, name);
  try {
    expect(() => admitClientPlan({ version: 1, features: [...pair, { kind: 'population.product-creatures' }] }, f.ctx.product)).toThrow('admitted legacy owners');
  } finally { f.scope.dispose(); }
});
