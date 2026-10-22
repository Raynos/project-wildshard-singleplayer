import { expect, test, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { AmbientFlockDraw } from '../src/game/ambient/ambientFlock';
import type { ShardContext } from '../src/game/plugin/context';
import { installClientAmbientLife } from '../src/game/shardfile/clientAmbientLife';
import { entryOwner, lendEntryOwner, publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { parsePageLife } from '../src/format/pageLife';
import { emptyShardfile } from '../src/sdk/author';
import { FISH_DRAW } from '../src/shards/driftwood-isle/generators/fishDraw';
import { PAGE_LIFE } from '../src/shards/driftwood-isle/generators/pageLife';
import { legacyDouble } from './fake/FakeGame';

const lifeRows = parsePageLife({ ...PAGE_LIFE, flocks: PAGE_LIFE.flocks.filter(row => row.borrowed) });
const bindings = { file: 'actors/page-life.json', flocks: [{ id: 'gulls', owner: 'original.gulls' }] };
function fixture(deferred = false, innerLibrary = false) {
  const owner = new Scope('ambient-construction'), scope = owner.child('entered');
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const material = new MeshBasicMaterial(), row = lifeRows.flocks[0];
  if (row === undefined) throw new Error('Missing borrowed gull row');
  const draw = new AmbientFlockDraw(row.row, { name: 'gulls', geometry, material }, []);
  const source = emptyShardfile({ slug: 'ambient-fixture', name: 'Ambient', author: 'Test', revision: 1, seed: 1 });
  let libraryStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { libraryStarted = resolve; });
  const bytes = new TextEncoder().encode(JSON.stringify(innerLibrary ? PAGE_LIFE : lifeRows)); let resumeRead: ((value: Uint8Array) => void) | undefined;
  const read = vi.fn((hash: string) => {
    if (deferred && (!innerLibrary || hash === 'library')) return new Promise<Uint8Array>(resolve => { resumeRead = resolve; if (hash === 'library') libraryStarted?.(); });
    return Promise.resolve(bytes);
  });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map([[bindings.file, { hash: 'fixture', url: 'fixture' }], ['look/fish-draw.json', { hash: 'library', url: 'ambient-inner-leave-library' }]]), read });
  type World = NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>;
  const world = legacyDouble<World>({ game: legacyDouble<World['game']>({ camera: new PerspectiveCamera() }),
    sky: legacyDouble<World['sky']>({ dayNight: null }), player: legacyDouble<World['player']>({ position: new Vector3(0, 1.7, 0) }) });
  const system = vi.fn<ShardContext['system']>();
  const ctx = legacyDouble<ShardContext>({ scope, product, system, game: legacyDouble<ShardContext['game']>({
    runtime: legacyDouble<NonNullable<ShardContext['game']['runtime']>>({ world, hooks: {}, play: null }) }) });
  return { ctx, scope, owner, draw, read, system, started,
    publish: () => { publishEntryOwner(owner, 'ambient-draw', 'original.gulls', draw); lendEntryOwner(scope, owner, 'ambient-draw', 'original.gulls'); },
    resume: () => { if (resumeRead === undefined) throw new Error('Read did not start'); resumeRead(innerLibrary ? new TextEncoder().encode(JSON.stringify(FISH_DRAW)) : bytes); },
    dispose: () => { owner.dispose(); draw.mesh.geometry.dispose(); geometry.dispose(); material.dispose(); } };
}

test('entered life ticks the original resident draw once without replacing or disposing it', async () => {
  const f = fixture(); f.publish(); const update = vi.spyOn(f.draw, 'update'), dispose = vi.spyOn(f.draw.mesh.geometry, 'dispose');
  try {
    const life = await installClientAmbientLife(f.ctx, bindings);
    expect(life.busy).toBe(false); expect(f.read).toHaveBeenCalledTimes(1); expect(f.system).toHaveBeenCalledTimes(1);
    const system = f.system.mock.calls[0]?.[0]; if (system === undefined) throw new Error('Missing ambient system');
    expect(system).toMatchObject({ id: lifeRows.system.id, phase: 'update', before: lifeRows.system.before, after: lifeRows.system.after });
    system.run(1 / 60, 1 / 60); expect(update).toHaveBeenCalledTimes(1);
    expect(entryOwner(f.scope, 'ambient-draw', 'original.gulls')).toBe(f.draw);
    f.scope.dispose(); expect(entryOwner(f.owner, 'ambient-draw', 'original.gulls')).toBe(f.draw); expect(dispose).not.toHaveBeenCalled();
  } finally { update.mockRestore(); dispose.mockRestore(); f.dispose(); }
});

test('missing draws and duplicate ids refuse before any product read', async () => {
  const f = fixture();
  try {
    await expect(installClientAmbientLife(f.ctx, bindings)).rejects.toThrow('Missing live entry owner');
    f.publish();
    await expect(installClientAmbientLife(f.ctx, { ...bindings, flocks: [...bindings.flocks, ...bindings.flocks] })).rejects.toThrow('Duplicate');
    expect(f.read).not.toHaveBeenCalled(); expect(f.system).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

test.each(['entered', 'construction'] as const)('leaving %s during the product read prevents installation', async kind => {
  const f = fixture(true); f.publish();
  try {
    const pending = installClientAmbientLife(f.ctx, bindings);
    if (kind === 'entered') f.scope.dispose(); else f.owner.dispose(); f.resume();
    await expect(pending).rejects.toThrow('ended'); expect(f.system).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

test('the file cannot introduce an unbound borrowed flock', async () => {
  const f = fixture(); f.publish();
  try {
    await expect(installClientAmbientLife(f.ctx, { ...bindings, flocks: [{ id: 'other', owner: 'original.gulls' }] })).rejects.toThrow('exact borrowed');
    expect(f.system).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});


test('retiring during the inner fish library read stops before preload or a second draw', async () => {
  const f = fixture(true, true); f.publish();
  try {
    const pending = installClientAmbientLife(f.ctx, bindings);
    await f.started;
    f.scope.dispose(); f.resume();
    await expect(pending).rejects.toThrow('owner has ended'); expect(f.system).not.toHaveBeenCalled();
    expect(f.read.mock.calls.map(call => call[0])).toEqual(['fixture', 'library']);
  } finally { f.dispose(); }
});


test('two owner ids cannot make the same real draw tick twice', async () => {
  const f = fixture(); f.publish();
  publishEntryOwner(f.owner, 'ambient-draw', 'same.gulls', f.draw);
  lendEntryOwner(f.scope, f.owner, 'ambient-draw', 'same.gulls');
  try {
    await expect(installClientAmbientLife(f.ctx, { ...bindings, flocks: [
      ...bindings.flocks, { id: 'second', owner: 'same.gulls' },
    ] })).rejects.toThrow('Duplicate borrowed ambient draw');
    expect(f.read).not.toHaveBeenCalled(); expect(f.system).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});
