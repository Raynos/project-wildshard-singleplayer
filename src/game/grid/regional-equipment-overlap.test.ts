import {expect, test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual regional hook without constructing a GPU world.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Strip only the hook's types for controlled preparation ports.
import {stripTypeScriptTypes} from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute repository source, never a copied scheduling implementation.
import {runInNewContext} from 'node:vm';
import {Group, type Object3D} from 'three';
import {Scope} from '@wildshard/engine/app/scope';

function deferred() {
  let finish: () => void = () => undefined;
  const promise = new Promise<void>(resolve => {finish = resolve;});
  return {promise, resolve: () => {finish();}};
}
async function flush(): Promise<void> {for (let i = 0; i < 5; i++) await Promise.resolve();}
async function settle(promise: Promise<void>): Promise<unknown> {try {await promise; return null;} catch (error) {return error;}}

function fixture(options: {models?: boolean; prepare?: (root: Object3D) => Promise<void>; page?: () => Promise<void>; enabled?: boolean; worldOnly?: boolean} = {}) {
  const source = readFileSync(new URL('regionalRuntime.ts', import.meta.url), 'utf8');
  const declarationsStart = source.indexOf('          let enteredWarm:');
  const declarationsEnd = source.indexOf('          return { ...installation, context,', declarationsStart);
  const hookStart = source.indexOf('            afterWorld: async entered =>', declarationsEnd);
  const hookEnd = source.indexOf('            afterKit: async entered =>', hookStart);
  if ([declarationsStart, declarationsEnd, hookStart, hookEnd].some(at => at < 0)) throw new Error('Regional hook ports missing');
  const factory: unknown = runInNewContext(stripTypeScriptTypes(`(function(ports) {
    const {owner, foundation, request, view, preparedModels, preparing, world} = ports;
    ${source.slice(declarationsStart, declarationsEnd)}
    const hooks = {${source.slice(hookStart, hookEnd)}};
    return {start: () => hooks.afterWorld(null), kit: () => {if (typeof equipmentReady === 'function') equipmentReady();},
      content: () => {contentReady(); forgetContent();}, result: () => enteredWarm};
  })`), {Promise});
  if (typeof factory !== 'function') throw new Error('Regional hook factory missing');
  const owner = new Scope('equipment-overlap'), root = new Group(), models = new Group();
  root.visible = false; models.visible = false; models.name = 'staged-equipment';
  const calls: string[] = [], worldReady = deferred();
  const ports = {owner, view: {root}, preparedModels: options.models === false ? null : models, preparing: options.enabled !== false, world: {},
    foundation: {prepareWorldMaterials: (): void => {calls.push('look'); worldReady.resolve();}, ...(options.worldOnly === true ? {} : {beforeWarm: (): void => {calls.push('before-final'); worldReady.resolve();}})},
    request: {page: {world: {game: {warmEnteredFrame: async (scope: Scope, lighting: Object3D,
      before: (prepare: (roots: readonly Object3D[], exteriorPrograms?: boolean) => Promise<void>, prepareFrame: () => Promise<void>, preparePage: () => Promise<void>) => Promise<void>): Promise<void> => {
      expect(scope).toBe(owner); expect(lighting).toBe(root);
      await before(async (roots, exteriorPrograms = true) => {
        expect(roots).toHaveLength(1); const object = roots[0]; if (object === undefined) throw new Error('Missing prepared root');
        expect(object === root || object === models).toBe(true); expect(exteriorPrograms).toBe(object === root); calls.push(object === root ? 'world' : 'equipment');
        if (object === root) worldReady.resolve();
        await options.prepare?.(object);
      }, async () => {calls.push('frame'); await options.prepare?.(models);}, async () => {calls.push('page-only'); await options.page?.();});
      calls.push('final'); await options.prepare?.(models);
    }}}}},
  };
  const instance: unknown = Reflect.apply(factory, undefined, [ports]);
  if (typeof instance !== 'object' || instance === null) throw new Error('Regional fixture missing');
  const invoke = (name: string): unknown => {
    const method: unknown = Reflect.get(instance, name);
    if (typeof method !== 'function') throw new Error('Missing fixture method');
    const value: unknown = Reflect.apply(method, instance, []); return value;
  };
  const task = (name: string): Promise<void> => {
    const value = invoke(name);
    if (typeof value !== 'object' || value === null || typeof Reflect.get(value, 'then') !== 'function') throw new Error('Missing preparation task');
    return Promise.resolve(value).then(() => undefined);
  };
  return {owner, root, models, calls, worldReady: worldReady.promise, start: () => task('start'), kit: () => {invoke('kit');},
    content: () => {invoke('content');}, result: () => task('result'), rawResult: () => invoke('result')};
}

test('page prefix overlaps play and the complete inventory still waits for all content', async () => {
  const f = fixture();
  await f.start(); const result = f.result(), observed = settle(result);
  try {
    await flush(); expect(f.calls).toEqual(['look', 'page-only']);
    f.kit(); await flush();
    expect(f.calls).toEqual(['look', 'page-only']);
    expect(f.root.visible).toBe(false); expect(f.models.visible).toBe(false);
    f.content(); await result;
    expect(f.calls).toEqual(['look', 'page-only', 'before-final', 'final']);
  } finally {f.kit(); f.content(); f.owner.dispose(); await observed;}
});

test('the final inventory still waits for equipment when play finishes first', async () => {
  const equipment = deferred();
  const f = fixture({prepare: object => object.name === 'staged-equipment' ? equipment.promise : Promise.resolve()});
  await f.start(); const result = f.result(), observed = settle(result);
  try {
    f.content(); await flush(); expect(f.calls).toEqual(['look', 'page-only']);
    f.kit(); await f.worldReady; await flush(); expect(f.calls).toEqual(['look', 'page-only', 'before-final', 'final']);
    equipment.resolve(); await result;
    expect(f.calls.at(-1)).toBe('final');
  } finally {equipment.resolve(); f.kit(); f.content(); f.owner.dispose(); await observed;}
});

test('retirement while waiting for the kit wakes the rendezvous without preparing retired models', async () => {
  const f = fixture();
  await f.start(); const result = f.result(), observed = settle(result);
  try {
    await flush(); f.owner.dispose();
    expect(String(await observed)).toMatch(/left before.*warm-up/u);
    expect(f.calls).toEqual(['look', 'page-only']);
  } finally {f.kit(); f.content(); f.owner.dispose(); await observed;}
});


test('retirement during play releases the content wait without preparing a retired page', async () => {
  const f = fixture();
  await f.start(); const result = f.result(), observed = settle(result);
  try {
    f.kit(); await flush(); expect(f.calls).toEqual(['look', 'page-only']);
    f.owner.dispose();
    expect(String(await observed)).toMatch(/left before.*warm-up/u);
    expect(f.calls).toEqual(['look', 'page-only']);
  } finally {f.kit(); f.content(); f.owner.dispose(); await observed;}
});

test('final preparation refusal propagates after content without early compilation', async () => {
  const f = fixture({prepare: object => object.name === 'staged-equipment' ? Promise.reject(new Error('equipment refused')) : Promise.resolve()});
  await f.start(); const result = f.result(), observed = settle(result);
  try {
    f.kit(); f.content();
    expect(String(await observed)).toContain('equipment refused');
    expect(f.calls).toEqual(['look', 'page-only', 'before-final', 'final']);
  } finally {f.kit(); f.content(); f.owner.dispose(); await observed;}
});

test('no staged models preserves the final warm and ordinary entries start no speculative work', async () => {
  const f = fixture({models: false}), ordinary = fixture({enabled: false});
  await f.start(); const result = f.result(), observed = settle(result);
  try {
    f.kit(); f.content(); await result;
    expect(f.calls).toEqual(['look', 'page-only', 'before-final', 'final']);
    await ordinary.start(); expect(ordinary.rawResult()).toBeNull(); expect(ordinary.calls).toEqual([]);
  } finally {f.kit(); f.content(); f.owner.dispose(); ordinary.owner.dispose(); await observed;}
});


test('a foundation without a final hook retains its world-material preparation', async () => {
  const f = fixture({worldOnly: true});
  await f.start(); const result = f.result(), observed = settle(result);
  try {
    f.kit(); f.content(); await result;
    expect(f.calls).toEqual(['look', 'page-only', 'look', 'final']);
  } finally {f.kit(); f.content(); f.owner.dispose(); await observed;}
});

test('the early page work overlaps content but is drained before final preparation', async () => {
  const page = deferred(), f = fixture({page: () => page.promise});
  await f.start(); const result = f.result(), observed = settle(result);
  try {
    f.kit(); f.content(); await flush();
    expect(f.calls).toEqual(['look', 'page-only']);
    page.resolve(); await result;
    expect(f.calls).toEqual(['look', 'page-only', 'before-final', 'final']);
  } finally {page.resolve(); f.kit(); f.content(); f.owner.dispose(); await observed;}
});

test('a page refusal preserves its identity and never publishes the complete inventory', async () => {
  const failure = new Error('Page program refused'), f = fixture({page: () => Promise.reject(failure)});
  await f.start(); const observed = settle(f.result());
  try {
    f.kit(); f.content(); expect(await observed).toBe(failure);
    expect(f.calls).toEqual(['look', 'page-only']);
  } finally {f.kit(); f.content(); f.owner.dispose(); await observed;}
});

test('retirement drains an in-flight page prefix without replacing the owner refusal', async () => {
  const page = deferred(), f = fixture({page: () => page.promise});
  await f.start(); const observed = settle(f.result()); let finished = false;
  void observed.then(() => {finished = true; return undefined;});
  try {
    await flush(); f.owner.dispose(); await flush(); expect(finished).toBe(false);
    page.resolve(); expect(String(await observed)).toMatch(/left before.*warm-up/u);
    expect(f.calls).toEqual(['look', 'page-only']);
  } finally {page.resolve(); f.kit(); f.content(); f.owner.dispose(); await observed;}
});
