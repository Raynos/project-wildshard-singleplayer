import { expect, it, vi } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { preloadDuneMeshes, duneHd, duneMesh, duneRig } from '../../../src/shards/sunscar-dunes/world/meshes';
import { DUNE_HD, DUNE_MESHES, DUNE_RIGS } from '../../../src/shards/sunscar-dunes/data/files';

// SHARD-PLATFORM SF72: the code stand-ins are gone, so a generated model that fails to load stands undrawn; it must be a
// page fault (console.error, which the boot smoke fails on), never a quiet warning.
it('reports every generated Signal Dunes model that fails to load as a page fault', async () => {
  const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(new Error('404'));
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    await preloadDuneMeshes();
    const named = errors.mock.calls.map(([message]) => String(message));
    for (const name of [...DUNE_MESHES, ...DUNE_HD]) expect(named.filter((m) => m.includes(`generated model ${name} `))).toHaveLength(1);
    for (const name of DUNE_RIGS) expect(named.filter((m) => m.includes(`baked rig ${name} `))).toHaveLength(1);
    expect(warnings).not.toHaveBeenCalled();
    expect(duneRig('skitterer')).toBeNull();
    expect(duneMesh('dry-well')).toBeNull();
    expect(duneHd('brazier-hd', { size: 1, by: 'height' })).toBeNull();
  } finally {
    loaded.mockRestore(); errors.mockRestore(); warnings.mockRestore();
  }
});
