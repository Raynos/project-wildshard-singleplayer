import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import { entryOwner } from '../src/game/shardfile/entryOwners';
import { installFixedDrawsStage, installPaintedReseedStage } from '../src/game/shardfile/paintedWorldStages';
import { paintedWorld } from '../src/game/looks/paintedWorld';
import paintedTextures from '../src/shards/nalati-grasslands/boot/paintedTextures.generated.json' with { type: 'json' };
import specimenData from '../src/shards/nalati-grasslands/boot/specimens.generated.json' with { type: 'json' };
import grassRows from '../src/shards/nalati-grasslands/boot/grass.generated.json' with { type: 'json' };
import capture from '../src/shards/nalati-grasslands/data/staticCapture.json' with { type: 'json' };

// An orchard world (the stages' fixture level): its own fixed-draw library and a painted world borrowing the first
// level's ground and blade rows.
/** a library whose one load the stage must not repeat; `gate` holds its load open */
function library(gate: Promise<void> = Promise.resolve()): FixedDraws {
  let loaded = false;
  return { get ready() { return loaded; }, load: async () => { await gate; loaded = true; }, handle: () => { throw new Error('No slots in the orchard library'); } };
}
const unpublished = (scope: Scope, id: string): void => { expect(() => entryOwner(scope, 'fixed-draws', id)).toThrow(); };

test('a fixed-draws stage loads the world\'s one original library once a page and lends it by id', async () => {
  const draws = library(), load = vi.spyOn(draws, 'load');
  const first = new Scope('orchard'), second = new Scope('orchard-again');
  await installFixedDrawsStage({ scope: first, draws }, { id: 'orchard.shapes' });
  await installFixedDrawsStage({ scope: second, draws }, { id: 'orchard.shapes' });
  expect(load).toHaveBeenCalledOnce();
  expect(entryOwner(first, 'fixed-draws', 'orchard.shapes')).toBe(draws);
  expect(entryOwner(second, 'fixed-draws', 'orchard.shapes')).toBe(draws);
  await expect(installFixedDrawsStage({ scope: new Scope('bare') }, { id: 'orchard.shapes' })).rejects.toThrow('original fixed-draw library');
  first.dispose(); second.dispose();
});

test('a world retired at entry, or retiring through an ancestor\'s steps, loads nothing and publishes nothing', async () => {
  const retired = new Scope('retired'), draws = library(), load = vi.spyOn(draws, 'load');
  retired.dispose();
  await expect(installFixedDrawsStage({ scope: retired, draws }, { id: 'orchard.shapes' })).rejects.toThrow('live world');
  const parent = new Scope('page'), world = parent.child('orchard');
  parent.onDispose(() => undefined);
  const steps = parent.disposeSteps();
  steps.next();
  expect(world.disposing).toBe(true);
  await expect(installFixedDrawsStage({ scope: world, draws }, { id: 'orchard.shapes' })).rejects.toThrow('live world');
  expect(load).not.toHaveBeenCalled();
  while (steps.next().done !== true) { /* drain */ }
});

test('a world that leaves or swaps its library during the load publishes nothing', async () => {
  let open = (): void => undefined;
  const gate = new Promise<void>(resolve => { open = resolve; });
  const leaving = new Scope('leaving'), draws = library(gate);
  const pending = installFixedDrawsStage({ scope: leaving, draws }, { id: 'orchard.shapes' });
  leaving.dispose(); open();
  await expect(pending).rejects.toThrow('left or replaced');
  const world = new Scope('swapped'), first = library(), ports: { scope: Scope; draws: FixedDraws } = { scope: world, draws: first };
  const swapping = installFixedDrawsStage(ports, { id: 'orchard.shapes' });
  ports.draws = library();
  await expect(swapping).rejects.toThrow('left or replaced');
  unpublished(world, 'orchard.shapes');
  world.dispose();
});

test('a painted-reseed stage reseeds the named painted world\'s grass for a live world only', () => {
  const world = new Scope('orchard-reseed');
  expect(() => { installPaintedReseedStage(world, { world: 'orchard-unbuilt' }); }).toThrow('No painted world for orchard-unbuilt');
  const parts = paintedWorld('orchard-stages', { fog: { start: 40, end: 900, haze: [0.3, 0.32, 0.36], aerial: [0.002, 40, -5, 0.001], edge: [0.9, 251, 270, 15], order: 280, lut: [0.5, 0.55, 0.6] },
    air: { tile: 800, threshold: 0.6, strength: 0.4, softness: 0.1, drift: [1, 0.5] }, ground: 'ground' in paintedTextures ? paintedTextures.ground : null, tiles: specimenData.materials,
    capture, grass: { rows: grassRows, cards: { url: '/assets/orchard/cards.webp', phoneUrl: '/assets/orchard/cards.phone.webp', name: 'orchard-cards' } } });
  const reseed = vi.spyOn(parts.grass, 'reseed');
  installPaintedReseedStage(world, { world: 'orchard-stages' });
  expect(reseed).toHaveBeenCalledOnce();
  world.dispose();
  expect(() => { installPaintedReseedStage(world, { world: 'orchard-stages' }); }).toThrow('live world');
  expect(reseed).toHaveBeenCalledOnce();
});

test('a fixed-draw callable replaced during its held load cannot publish', async () => {
  const scope = new Scope('callable-swap');
  let release = (): void => undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const draws = library(gate), pending = installFixedDrawsStage({ scope, draws }, { id: 'shapes' });
  draws.load = () => Promise.resolve(); release();
  try { await expect(pending).rejects.toThrow('left or replaced'); unpublished(scope, 'shapes'); }
  finally { scope.dispose(); }
});
