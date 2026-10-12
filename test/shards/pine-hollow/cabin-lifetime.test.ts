import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { modelContext } from '../../../src/engine/models/model';
import { Cabins } from '../../../src/shards/pine-hollow/world/homestead';
import { cabinsOf, useCabins } from '../../../src/shards/pine-hollow/models/logCabin';
import { fakeWorld } from '../../fake/world';

function cabinContext(): ReturnType<typeof modelContext> {
  const sky = fakeWorld().sky;
  // Resource discovery reads this discriminator on service containers as well as renderers.
  Object.assign(sky, { isWebGLRenderer: false });
  Object.assign(sky.csm, { isWebGLRenderer: false });
  return modelContext(sky);
}

describe('Pine homestead construction binding', () => {
  it('survives resource retirement until the actual construction owner leaves', () => {
    const ctx = cabinContext(), sky = ctx.sky, owner = new Scope('pine-entry');
    const cabins = new Cabins(sky), lamp = new MeshStandardMaterial();
    cabins._lamp(lamp, 1);
    // The former binding traversed Cabins' material containers and vanished on disposal.
    ctx.once('old-cabins-binding', () => cabins);
    useCabins(ctx, cabins, owner);
    expect(cabinsOf(ctx)).toBe(cabins);
    lamp.dispose();
    expect(() => ctx.once('old-cabins-binding', () => { throw new Error('evicted'); })).toThrow('evicted');
    expect(cabinsOf(ctx)).toBe(cabins);
    owner.dispose();
    expect(() => cabinsOf(ctx)).toThrow('[cabins] not built (useCabins)');
  });

  it('binds fresh homes across three entries with the same regional sky', () => {
    const ctx = cabinContext(), sky = ctx.sky;
    for (let entry = 0; entry < 3; entry++) {
      const owner = new Scope(`pine-entry-${String(entry)}`), cabins = new Cabins(sky);
      useCabins(ctx, cabins, owner);
      expect(cabinsOf(ctx)).toBe(cabins);
      const joined = { sky, renderer: ctx.renderer, once: ctx.once };
      expect(cabinsOf(joined)).toBe(cabins);
      owner.dispose();
      expect(() => cabinsOf(ctx)).toThrow('[cabins] not built (useCabins)');
    }
  });

  it('does not let an older owner remove a replacement binding', () => {
    const ctx = cabinContext(), sky = ctx.sky;
    const oldOwner = new Scope('old-home'), nextOwner = new Scope('fresh-home');
    const oldCabins = new Cabins(sky), nextCabins = new Cabins(sky);
    useCabins(ctx, oldCabins, oldOwner);
    useCabins(ctx, nextCabins, nextOwner);
    oldOwner.dispose();
    expect(() => useCabins(ctx, oldCabins, oldOwner)).toThrow('Cabins require a live construction owner');
    expect(cabinsOf(ctx)).toBe(nextCabins);
    nextOwner.dispose();
    expect(() => cabinsOf(ctx)).toThrow('[cabins] not built (useCabins)');
  });
});
