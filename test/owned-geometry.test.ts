import { expect, it, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Float16BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { createOwnedGeometry, createOwnedGeometryBatch } from '../src/engine/models/ownedGeometry';
import { staticGlb } from '../src/sdk/bake/glb';
import * as rigLoaders from '../src/engine/anim/rig';

it('copies borrowed input and transfers adopted geometry without retaining it', async () => {
  const source = new BoxGeometry(), intake = createOwnedGeometry('/owned.glb');
  try {
    expect(() => intake.copy()).toThrow('not loaded');
    await intake.load(source);
    const copy = intake.copy(), taken = intake.take();
    expect(taken).not.toBe(source);
    expect(copy.getAttribute('position').array.buffer).not.toBe(taken.getAttribute('position').array.buffer);
    expect(() => intake.take()).toThrow('not loaded');
    intake.adopt(taken);
    expect(() => intake.adopt(copy)).toThrow('already loaded');
    expect(intake.take()).toBe(taken);
    expect(() => intake.copy()).toThrow('not loaded');
    intake.adopt(copy);
    expect(intake.take()).toBe(copy);
    copy.dispose(); taken.dispose();
  } finally { source.dispose(); }
});

it.each([false, true])('takes private GLB attributes without another geometry copy (native=%s)', async nativeAttributes => {
  const source = new BoxGeometry(), material = new MeshStandardMaterial();
  const create = rigLoaders.createRigLoader;
  let decoded: BufferGeometry | undefined;
  const loader = vi.spyOn(rigLoaders, 'createRigLoader').mockImplementation(() => create().register(() => ({
    name: 'owned-intake-probe', afterRoot: file => {
      file.scene.traverse(node => { if (node instanceof Mesh && node.geometry instanceof BufferGeometry) decoded = node.geometry; });
    },
  })));
  const intake = createOwnedGeometry('/exclusive.glb');
  try {
    await intake.load(staticGlb([{ geometry: source, material, nativeAttributes }]));
    const taken = intake.take();
    try {
      if (decoded === undefined) throw new Error('Missing decoded geometry');
      expect(taken.getAttribute('position')).toBe(decoded.getAttribute('position'));
      expect(taken.getAttribute('normal')).toBe(decoded.getAttribute('normal'));
      intake.adopt(taken);
      const copy = intake.copy();
      try {
        expect(copy.getAttribute('position').array.buffer).not.toBe(taken.getAttribute('position').array.buffer);
        copy.getAttribute('position').setX(0, 40);
        expect(taken.getAttribute('position').getX(0)).not.toBe(40);
      } finally { copy.dispose(); }
      expect(intake.take()).toBe(taken);
    } finally { taken.dispose(); }
  } finally { loader.mockRestore(); source.dispose(); material.dispose(); }
});

it('loads the declared batch while retaining each handle ownership and retry', async () => {
  const batch = createOwnedGeometryBatch(), a = batch.geometry('a'), b = batch.geometry('b');
  const source = new BoxGeometry();
  const requests: string[] = [];
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(input => { requests.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); return Promise.reject(new Error('missing source')); });
  try {
    await expect(batch.load(new Map([['a', source]]))).rejects.toThrow('missing source');
    expect(requests).toEqual(['b']);
    await batch.load(new Map([['a', source], ['b', source]]));
    const first = a.take(), second = b.take();
    expect(first).not.toBe(second); expect(first).not.toBe(source);
    expect(() => a.copy()).toThrow('not loaded');
    a.adopt(first); expect(a.take()).toBe(first);
    first.dispose(); second.dispose();
    expect(() => batch.geometry('a')).toThrow('declaration');
    const bounded = createOwnedGeometryBatch();
    for (let i = 0; i < 128; i++) bounded.geometry(String(i));
    expect(() => bounded.geometry('overflow')).toThrow('declaration');
  } finally { fetch.mockRestore(); source.dispose(); }
});

it('admits stable slot tables atomically and retains independent take/copy handles', async () => {
  const batch = createOwnedGeometryBatch(), source = new BoxGeometry();
  const rows = [{ slot: 'beam', channels: [] }, { slot: 'panel', channels: [] }];
  try {
    expect(() => batch.declare([...rows, rows[0] ?? rows[1] ?? { slot: '', channels: [] }])).toThrow('declaration');
    expect(() => batch.handle('beam')).toThrow('not loaded');
    batch.declare(rows); batch.declare(structuredClone(rows));
    expect(() => batch.declare([{ slot: 'other', channels: [] }])).toThrow('changed');
    expect(() => batch.geometry('extra')).toThrow('declaration'); expect(batch.ready).toBe(false);
    await batch.load(new Map(rows.map(row => [row.slot, source]))); expect(batch.ready).toBe(true);
    const beam = batch.handle('beam').take(), panel = batch.handle('panel').copy();
    expect(beam.getAttribute('position').array).toEqual(panel.getAttribute('position').array);
    expect(beam.getAttribute('position').array.buffer).not.toBe(panel.getAttribute('position').array.buffer);
    beam.dispose(); panel.dispose(); batch.handle('panel').take().dispose();
  } finally { source.dispose(); }
});

it('restores native half-float bits, packed vec4 normals and explicit identity indices', async () => {
  const geometry = new BufferGeometry(), material = new MeshStandardMaterial();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Int16Array([0, 0, 32767, 1, 0, 0, 32767, 2, 0, 0, 32767, 3]), 4, true));
  geometry.setAttribute('uv', new Float16BufferAttribute(new Uint16Array([0, 0, 15360, 0, 0, 15360]), 2));
  geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  const intake = createOwnedGeometry('/typed-shape.glb');
  try {
    await intake.load(staticGlb([{ geometry, material, nativeAttributes: true, compactIndex: true }]));
    const restored = intake.take();
    try {
      expect(restored.getAttribute('normal').itemSize).toBe(4);
      expect(restored.getAttribute('normal').normalized).toBe(true);
      expect(restored.getAttribute('normal').array).toEqual(geometry.getAttribute('normal').array);
      expect(restored.getAttribute('uv')).toBeInstanceOf(Float16BufferAttribute);
      expect(restored.getAttribute('uv').array).toEqual(geometry.getAttribute('uv').array);
      expect(restored.getIndex()?.array).toEqual(new Uint16Array([0, 1, 2]));
    } finally { restored.dispose(); }
  } finally { geometry.dispose(); material.dispose(); }
});


it.each([false, true])('restores one native geometry from physical storage segments (indexed=%s)', async indexed => {
  const material = new MeshStandardMaterial(), first = new BufferGeometry(), second = new BufferGeometry();
  const a = Float32Array.of(-0, 0, 0, 1, 0, 0, 0, 1, 0), b = Float32Array.of(2, 0, 0, 3, 0, 0, 2, 1, 0);
  const vertices = indexed ? Float32Array.from([...a, ...b]) : a;
  first.setAttribute('position', new BufferAttribute(vertices, 3)); second.setAttribute('position', new BufferAttribute(indexed ? vertices.slice() : b, 3));
  for (const shape of [first, second]) {
    shape.setAttribute('normal', new BufferAttribute(Int16Array.from({ length: shape.getAttribute('position').count * 4 }, (_, i) => i % 4 === 2 ? 32767 : 0), 4, true));
    shape.setAttribute('uv', new Float16BufferAttribute(Uint16Array.from({ length: shape.getAttribute('position').count * 2 }, (_, i) => i % 2 === 0 ? 15360 : 0), 2));
  }
  if (indexed) { first.setIndex(new BufferAttribute(Uint32Array.of(0, 1, 2), 1)); second.setIndex(new BufferAttribute(Uint32Array.of(3, 4, 5), 1)); }
  const chunks = [first, second].map(geometry => staticGlb([{ geometry, material, nativeAttributes: true, compactIndex: true }]));
  const intake = createOwnedGeometry('/quay-segments.glb');
  try {
    await intake.load(chunks[0], [chunks[1] ?? new Uint8Array()]);
    const restored = intake.take();
    try {
      expect(restored.getAttribute('position').count).toBe(6);
      expect(new Uint32Array(restored.getAttribute('position').array.buffer)).toEqual(new Uint32Array(Float32Array.from([...a, ...b]).buffer));
      expect(restored.getAttribute('normal').array).toBeInstanceOf(Int16Array); expect(restored.getAttribute('normal').normalized).toBe(true); expect(restored.getAttribute('normal').itemSize).toBe(4);
      expect(restored.getAttribute('uv')).toBeInstanceOf(Float16BufferAttribute);
      if (indexed) expect(restored.index?.array).toEqual(Uint32Array.of(0, 1, 2, 3, 4, 5)); else expect(restored.index).toBeNull();
    } finally { restored.dispose(); }
  } finally { first.dispose(); second.dispose(); material.dispose(); }
});

it('refuses indexed segment vertex drift and can retry the immutable intake', async () => {
  const material = new MeshStandardMaterial(), first = new BufferGeometry().setAttribute('position', new BufferAttribute(Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0), 3));
  first.setIndex(new BufferAttribute(Uint32Array.of(0, 1, 2), 1));
  const other = first.clone(); other.getAttribute('position').setX(0, 0.125);
  const encode = (geometry: BufferGeometry) => staticGlb([{ geometry, material, nativeAttributes: true, compactIndex: true }]);
  const a = encode(first), b = encode(other), intake = createOwnedGeometry('/quay-invalid.glb');
  try {
    await expect(intake.load(a, [])).rejects.toThrow('segment cap');
    await expect(intake.load(a, [b])).rejects.toThrow('vertices differ'); expect(() => intake.take()).toThrow('not loaded');
    await intake.load(a, [a]); const restored = intake.take(); expect(restored.index?.array).toEqual(Uint32Array.of(0, 1, 2, 0, 1, 2)); restored.dispose();
  } finally { first.dispose(); other.dispose(); material.dispose(); }
});
