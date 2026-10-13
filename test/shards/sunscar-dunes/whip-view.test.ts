import { describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Hashes the geometry and texture bytes against the recorded ones.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate inflates the committed plait texels the client loads.
import { inflateSync } from 'node:zlib';
import { CylinderGeometry, InstancedMesh, Vector3, type BufferAttribute, type BufferGeometry, type InterleavedBufferAttribute, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { LashCord } from '../../../src/shards/sunscar-dunes/runtime/items/lashView';
import { buildLashHold } from '../../../src/shards/sunscar-dunes/runtime/items/lashHold';
import { bakeSignalLash, braidColours, coilPoints, plaitTexels, wrapGeometry } from '../../../src/shards/sunscar-dunes/generators/lash';
import { createModelLibrary } from '../../../src/sdk/looks/modelLibrary';
import { DUNE_MODELS } from '../../../src/shards/sunscar-dunes/data/files';
import { LASH_CORD, LOOP, PLAIT, POPPER, RADIAL, STRAND_A, STRAND_B, WHIP_HOLD, WHIP_VIEW, type PlaitStyle } from '../../../src/shards/sunscar-dunes/data/whip';
import lash from '../../../src/shards/sunscar-dunes/data/lash.json' with { type: 'json' };
// The bullwhip's cord, plait tile and held coil as Signal Dunes' own code built them before they became rows (HEAD d91bc1a63, weapons/whipModel.ts).
import before from './whip-view.json' with { type: 'json' };

const sha = (a: ArrayBufferView | null): string => {
  if (a === null) throw new Error('no data');
  return createHash('sha256').update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
};
const floats = (a: BufferAttribute | InterleavedBufferAttribute): string => sha(Float32Array.from({ length: a.count * a.itemSize }, (_, i) => a.getComponent(Math.floor(i / a.itemSize), i % a.itemSize)));
const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;

/** The committed lash bake as the client reads it: each kind's geometry by name. */
async function loadLash(): Promise<Map<string, BufferGeometry>> {
  const bytes = readFileSync('public/assets/sunscar-dunes/baked/lash.glb');
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''), nodes: InstancedMesh[] = [];
  gltf.scene.traverse((node) => { if (instanced(node)) nodes.push(node); });
  return new Map(lash.kinds.map((kind, i) => { const node = nodes[i]; if (node === undefined) throw new Error('missing node'); return [kind.name, node.geometry]; }));
}

describe('the lash item\'s view draws a shard\'s cord from its bake and rows (SHARD-PLATFORM SF72, G345)', () => {
  it('the committed lash bake is byte-exact over the client intake of the generated glove (the stale gate: rerun generators/bake-signal-world.mjs)', async () => {
    const parser = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation((url) => {
      const bytes = readFileSync(`public${url}`);
      return parser.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    });
    try {
      const library = createModelLibrary({ ...DUNE_MODELS, meshes: ['whip-glove'], hd: [] }, '[test]');
      await library.preload();
      const glove = library.mesh('whip-glove');
      if (glove === null) throw new Error('whip-glove missing');
      const { glb, ...rows } = bakeSignalLash(glove);
      expect({ glb: createHash('sha256').update(glb).digest('hex'), ...rows }).toEqual(lash);
      expect(createHash('sha256').update(readFileSync('public/assets/sunscar-dunes/baked/lash.glb')).digest('hex')).toBe(lash.glb);
    } finally { loaded.mockRestore(); errors.mockRestore(); }
  });

  it('the client reads exactly the lash, plait tile, coil and braid Signal Dunes\' own code built (pixel parity by construction)', async () => {
    const baked = await loadLash(), kind = (name: string): BufferGeometry => { const g = baked.get(name); if (g === undefined) throw new Error(name); return g.clone(); };
    const hold = buildLashHold(WHIP_HOLD, { tip: [0, 0, 0], along: lash.along }, { baked: kind, plait: () => null, hd: () => null, coilSurface: () => undefined });
    hold.lash.shape(new Vector3(0.01, 0.02, -0.1), new Vector3(0.5, 0.3, -7), 0.7, 0.4, 1.3);
    const g = hold.lash.mesh.geometry, index = g.getIndex();
    if (index === null) throw new Error('lash index');
    expect({ position: floats(g.getAttribute('position')), normal: floats(g.getAttribute('normal')), color: floats(g.getAttribute('color')), index: sha(Uint32Array.from(index.array)),
      roughness: hold.lash.mesh.material.roughness, emissive: hold.lash.mesh.material.emissive.getHex(), visible: hold.lash.mesh.visible }).toEqual(before.lash);
    // the plait tile: baked (generators/lash.ts) and committed deflated (baked/plait.bin, the stale gate), texel-exact
    const tile = plaitTexels(PLAIT), n = PLAIT.size * PLAIT.size * 4;
    expect(Uint8Array.from(inflateSync(readFileSync('public/assets/sunscar-dunes/baked/plait.bin')))).toEqual(tile);
    expect({ map: sha(tile.subarray(0, n)), normal: sha(tile.subarray(n, 2 * n)), rough: sha(tile.subarray(2 * n)) }).toEqual(before.plait);
    const cg = kind('loop');
    expect({ position: floats(cg.getAttribute('position')), uv: floats(cg.getAttribute('uv')), normal: floats(cg.getAttribute('normal')), repeat: [lash.along, 1], count: cg.getAttribute('position').count }).toEqual(before.loop);
    // the pull's wrap coil: the baked helix is the tube the lash weapon built at the lever
    const wrap = kind('wrap'), built = wrapGeometry(WHIP_VIEW.wrap), wrapIndex = wrap.getIndex(), builtIndex = built.getIndex();
    if (wrapIndex === null || builtIndex === null) throw new Error('wrap index');
    for (const name of ['position', 'normal', 'uv']) expect(floats(wrap.getAttribute(name)), name).toBe(floats(built.getAttribute(name)));
    expect(Array.from(wrapIndex.array)).toEqual(Array.from(builtIndex.array));
    const handle = new CylinderGeometry(0.017, 0.021, 0.26, RADIAL, 12, true); braidColours(handle, 13, RADIAL + 1, 0, STRAND_A, STRAND_B, POPPER);
    expect(floats(handle.getAttribute('color'))).toBe(before.handleBraid);
  });

  it('a second cord look builds its own braid and tile (the view is generic, the look is data)', () => {
    const rope: PlaitStyle = { size: 32, columns: 2, rows: 3, crease: [30, 30, 30], crown: [120, 110, 90], relief: 2, rough: [0.9, 0.3] };
    const tile = plaitTexels(rope);
    expect(tile.length).toBe(32 * 32 * 12);
    expect(sha(tile.subarray(0, 32 * 32 * 4))).not.toBe(before.plait.map);
    expect(() => new LashCord({ ...LASH_CORD, segments: 8, radial: 4 }, new CylinderGeometry())).toThrow(/baked rings/u);
    const pts = coilPoints({ ...LOOP, turns: 1, tail: [] });
    expect(pts).toHaveLength(41);
  });
});
