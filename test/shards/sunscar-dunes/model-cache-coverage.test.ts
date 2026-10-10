// oxlint-disable-next-line import/no-nodejs-modules -- Parse the committed GLBs in this Node-only allocation witness.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { sceneResources } from '../../../src/engine/app/sceneOwnership';
import { cachedResourceAllocations } from '../../../src/engine/render/textureBytes';
import { PageResidency } from '../../../src/game/grid/pageResidency';
import { coverRuntimeAssets } from '../../../src/game/grid/assetResidency';
import { runtimeAccountedBytes } from '../../../src/game/grid/runtimeCost';
import { SIGNAL_DUNES_RUNTIME_COST } from '../../../src/shards/sunscar-dunes/data/runtimeCost';
import { duneHd, preloadDuneMeshes } from '../../../src/shards/sunscar-dunes/world/meshes';

// Node parses the actual GLBs and meshopt buffers. Only the image decoder is replaced: its real WebP
// dimensions supply RGBA storage capacity, without pretending to measure physical resident RAM.
class PixelCapacity {
  constructor(readonly width: number, readonly height: number) {}
  close(): void { return undefined; }
}
async function webpCapacity(blob: Blob): Promise<PixelCapacity> {
  const head = new DataView(await blob.arrayBuffer());
  expect(head.getUint32(0)).toBe(0x52494646); expect(head.getUint32(8)).toBe(0x57454250);
  const chunk = head.getUint32(12);
  if (chunk === 0x56503820) return new PixelCapacity(head.getUint16(26, true) & 0x3fff, head.getUint16(28, true) & 0x3fff);
  if (chunk === 0x5650384c) { const bits = head.getUint32(21, true); return new PixelCapacity((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); }
  if (chunk === 0x56503858) return new PixelCapacity((head.getUint32(24, true) & 0xffffff) + 1, (head.getUint32(27, true) & 0xffffff) + 1);
  throw new Error('Unexpected committed model image');
}

it('loads the actual pack horse with standalone and grid coverage, charging concrete cache overflow within the shared cap', async () => {
  const priorBitmap = Object.getOwnPropertyDescriptor(globalThis, 'ImageBitmap');
  const priorDecode = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  const priorSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
  vi.stubGlobal('ImageBitmap', PixelCapacity); vi.stubGlobal('createImageBitmap', webpCapacity); vi.stubGlobal('self', globalThis);
  const parser = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(url => {
    const bytes = readFileSync(`public${url}`);
    return parser.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  });
  const warnings = vi.spyOn(console, 'warn'), faults = vi.spyOn(console, 'error');
  const initial = new Set(app.assets.retained().map(row => row.key));
  try {
    for (const mode of ['standalone', 'grid'] as const) {
      const page = new PageResidency(), renderer = new Scope('renderer'), resident = renderer.child(mode);
      const bytes = runtimeAccountedBytes(SIGNAL_DUNES_RUNTIME_COST);
      if (mode === 'standalone') page.admitHome('sunscar-dunes', bytes);
      page.bindAssets(app.assets, renderer, mode === 'standalone' ? resident : null, () => resident, cachedResourceAllocations);
      const lease = mode === 'standalone' ? null : page.allocator.reserve({ id: 'sim:dunes', category: 'sim', owner: 'dunes', bytes, needed: true, distance: 0 });
      if (mode === 'grid') { if (lease === null) throw new Error('Regional admission refused'); coverRuntimeAssets(page.allocator, resident, lease); }
      try {
        await preloadDuneMeshes();
        const horse = duneHd('horse-hd', { size: 1.62, by: 'height' });
        if (horse === null) throw new Error('Actual pack horse missing');
        const allocations = new Map<object, { bytes: number; kind: 'cpu' | 'gpu' }>();
        for (const resource of sceneResources(horse)) for (const allocation of cachedResourceAllocations(resource)) allocations.set(allocation.identity, allocation);
        const sum = (kind: 'cpu' | 'gpu'): number => [...allocations.values()].filter(row => row.kind === kind).reduce((total, row) => total + row.bytes, 0);
        expect(sum('cpu')).toBe(4_394_860); expect(sum('gpu')).toBe(5_792_960);
        const commons = page.allocator.entries().filter(row => row.category === 'commons');
        // SF72: + 59,904 for the baked skitterer rig (rigs/skitterer.glb, kept once like the generated models)
        expect(commons.reduce((total, row) => total + row.bytes, 0)).toBe(53_231_608);
        expect(commons.reduce((total, row) => total + row.accountedBytes, 0)).toBeGreaterThan(0);
        expect(commons.filter(row => row.coveredBy !== undefined).reduce((total, row) => total + row.bytes, 0)).toBeLessThanOrEqual(bytes);
        expect(page.allocator.cost().playing).toBeLessThanOrEqual(1_000_000_000);
        expect(warnings).not.toHaveBeenCalled(); expect(faults).not.toHaveBeenCalled(); // a model that did not load is a page fault
      } finally {
        for (const row of app.assets.retained()) if (!initial.has(row.key)) app.assets.evictCached(row.key);
        resident.dispose(); lease?.release(); page.dispose(); renderer.dispose();
      }
      expect(page.allocator.entries()).toEqual([]);
    }
  } finally {
    loaded.mockRestore(); warnings.mockRestore(); faults.mockRestore();
    for (const [key, descriptor] of [['ImageBitmap', priorBitmap], ['createImageBitmap', priorDecode], ['self', priorSelf]] as const) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, key); else Object.defineProperty(globalThis, key, descriptor);
    }
  }
});
