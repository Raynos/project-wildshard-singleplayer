// SF57 (E435): an owner lasts only until the first `await`; an async build carries it through its owned services.
import { afterEach, expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { currentOwner, enterOwner, enteredOwner, onOwnerDispose, ownedFacade, ownerCensus, ownerTask, withOwner } from '../../src/engine/app/ownership';
import { WorldRegistry } from '../../src/engine/world/registry';

/** A page service whose registrations end with the caller's owner (FullMap.setQuest / Settings.on shape). */
class Board {
  readonly cards = new Set<string>();
  #calls = 0;
  get calls(): number { return this.#calls; }
  pin(card: string): void { this.#calls++; this.cards.add(card); onOwnerDispose(() => { this.cards.delete(card); }); }
}
const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

afterEach(() => { enterOwner(null); });

it('a bare await drops the owner: the cleanup lands on the page scope (the bug)', async () => {
  const page = new Scope('page-level'), build = new Scope('resident');
  enterOwner(page);
  const board = new Board();
  await withOwner(build, async () => { await tick(); board.pin('late'); });
  build.dispose();
  expect(board.cards.has('late')).toBe(true); // still held: the page scope owns it
  page.dispose();
  expect(board.cards.size).toBe(0);
});

it('an owned build that awaits, then registers through its facade, has the cleanup run when the build scope disposes', async () => {
  const page = new Scope('page-level'), build = new Scope('resident');
  enterOwner(page);
  const board = new Board(), owned = ownedFacade(build, board);
  const pageBefore = page.census.disposers;
  await ownerTask(build, async () => {
    owned.pin('early');
    await tick();
    owned.pin('late');          // after an await: the facade re-enters the build's scope
    await Promise.resolve();
    owned.pin('later');
  });
  expect(board.cards).toEqual(new Set(['early', 'late', 'later']));
  expect(page.census.disposers).toBe(pageBefore); // the page scope holds none of them
  expect(build.census.disposers).toBe(3);
  build.dispose();
  expect(board.cards.size).toBe(0);
  expect(board.calls).toBe(3); // private fields and getters work through the facade
  expect(currentOwner()).toBe(page); // the ambient owner is restored
  page.dispose();
});

it('a facade keeps identity per (service, scope), passes data through and writes to the real service', () => {
  const a = new Scope('a'), b = new Scope('b');
  const svc = { value: 1, bump(): number { return ++this.value; } };
  const fa = ownedFacade(a, svc);
  expect(ownedFacade(a, svc)).toBe(fa);
  expect(ownedFacade(b, svc)).not.toBe(fa);
  expect(fa.bump()).toBe(2);
  fa.value = 10; expect(svc.value).toBe(10);
  const first: unknown = Reflect.get(fa, 'bump'), again: unknown = Reflect.get(fa, 'bump');
  expect(first).toBe(again); // one wrapper per method
  a.dispose(); b.dispose();
});

it('ownerTask counts ambient owner reads while a build is pending and stops when it settles', async () => {
  const page = new Scope('page-level'), build = new Scope('resident');
  enterOwner(page);
  const before = ownerCensus().strayReads;
  const pending = ownerTask(build, async () => {
    expect(currentOwner()).toBe(build); // the synchronous prefix is owned
    await tick();
    onOwnerDispose(() => undefined);    // a stray: the ambient (page) owner
  });
  expect(ownerCensus().pendingTasks).toBe(1);
  await pending;
  const after = ownerCensus();
  expect(after.pendingTasks).toBe(0);
  expect(after.strayReads).toBe(before + 1);
  expect(after.stacks.at(-1)).toContain('ambient owner read');
  currentOwner(); // no build pending: not a stray
  expect(ownerCensus().strayReads).toBe(before + 1);
  expect(() => ownerTask(build, () => { throw new Error('sync failure'); })).toThrow('sync failure');
  expect(ownerTask(build, () => 7)).toBe(7);
  expect(ownerCensus().pendingTasks).toBe(0);
  build.dispose(); page.dispose();
});

it('SF57 upload-owner: a region registry takes an ambient registration into its own scope, without a stray owner read', async () => {
  const page = new Scope('page-level'), view = page.child('grid.view'), registry = new WorldRegistry();
  registry.scope = view;
  enterOwner(page);
  const before = ownerCensus().strayReads, pageOwn = (): number => page.census.disposers - view.census.disposers, base = pageOwn();
  await ownerTask(view, async () => {
    await tick();
    // after the await the owner is the page's ambient one; the registration still ends with the view
    registry.add({ id: 'rock', file: 'test', name: 'rock', category: 'props' });
    expect(enteredOwner()).toBe(null);
  });
  expect(ownerCensus().strayReads).toBe(before);
  expect(registry.pieces.length).toBe(1);
  expect(view.census.disposers).toBe(1); expect(pageOwn()).toBe(base); // the hold is the view's, not the page's
  view.dispose();
  expect(registry.pieces.length).toBe(0);
});
