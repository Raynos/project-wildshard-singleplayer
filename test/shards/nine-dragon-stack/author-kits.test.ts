import { expect, it } from 'vitest';
import { Box3, BufferAttribute, type BufferGeometry, Color, Matrix4, Vector3 } from 'three';
import { RuledKit as AuthorRuled } from '../../../src/shards/nine-dragon-stack/generators/kit/ruledKit';
import { SweptKit as AuthorSwept, curve as authorCurve, mergeKits as authorMerge } from '../../../src/shards/nine-dragon-stack/generators/kit/sweptKit';
import { TangentKit as AuthorTangent } from '../../../src/shards/nine-dragon-stack/generators/kit/tangentKit';
import { RuledKit } from '../../../src/shards/nine-dragon-stack/runtime/kit/ruledKit';
import { SweptKit, curve, mergeKits } from '../../../src/shards/nine-dragon-stack/runtime/kit/sweptKit';
import { TangentKit } from '../../../src/shards/nine-dragon-stack/runtime/kit/tangentKit';

function bytes(g: BufferGeometry): Record<string, { type: string; size: number; normalized: boolean; raw: Uint8Array }> {
  const out: Record<string, { type: string; size: number; normalized: boolean; raw: Uint8Array }> = {};
  for (const [name, attr] of [...Object.entries(g.attributes), ...(g.index === null ? [] : [['index', g.index] as const])]) {
    if (!(attr instanceof BufferAttribute)) throw new Error('Expected native writer attributes');
    out[name] = { type: attr.array.constructor.name, size: attr.itemSize, normalized: attr.normalized,
      raw: new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength) };
  }
  return out;
}
function equal(a: BufferGeometry, b: BufferGeometry): void {
  expect(bytes(a)).toEqual(bytes(b));
  expect(a.boundingBox).toEqual(b.boundingBox); expect(a.boundingSphere).toEqual(b.boundingSphere);
  a.dispose(); b.dispose();
}
const p = new Vector3(0.3, 0.2, -0.7), q = new Vector3(-1.1, 2.3, 0.4), x = new Vector3(1, 0, 0), y = new Vector3(0, 1, 0), z = new Vector3(0, 0, 1);
const soup = [0, 0, 0, 1, 0, 0, 0, 1, 0];
function ruled(k: Pick<RuledKit, keyof RuledKit>): void {
  const look = { wash: 0x806040, kind: 3, row: 1.7, col: 0.13, seed: 9, emit: 0.2, line: 1.8, wet: 0.7, accent: true, gloss: true, gold: true, surf: 2 };
  k.quad(p, x, y, 1.3, 2.7, look); k.tri(p, q, z, look);
  k.box(1.3, -2.7, 0.5, 2.3, 0.8, 1.7, look, { rotY: 0.371, top: null, bottom: { wash: 0x123456 }, sides: 5 });
  k.beam(p, q, 0.13, 0.7, look); k.wire(p, q, 0.03, look);
  k.cyl(0.7, 0.2, -1.3, 0.6, 0.2, 1.7, 9, look, { caps: false });
  k.limb(p, q, 0.6, 0.13, 7, look, 12, true);
  k.lathe(0.2, 0.3, -0.7, [[0, 0.2], [0.7, 0.3], [1.1, 0.01]], 11, look, false, 3);
  k.blob(soup, [0, 1, 2], 0.2, 0.3, 0.7, 0.3, 1.7, -0.4, look, true);
}
function swept(k: Pick<SweptKit, keyof SweptKit>): void {
  const look = { wash: 0xc23b22, kind: 5, seed: 19, edges: 15, line: 1.3, surf: 3, accent: true };
  k.sweep([p, q, z], t => 0.13 + t * 0.2, 7, look, { twist: 0.71, flat: 0.3, capStart: false, shade: (t, a) => 0.7 + 0.1 * t + 0.01 * a });
  k.ellipsoid(p, x, y, z, 0.3, 0.7, 1.3, look, d => 1 + 0.01 * d.x, 7, 9);
  k.card(p, x, y, 1.3, 2.7, look);
  k.mesh(soup, [0, 0, 1, 0, 0, 1, 0, 0, 1], [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 1, 2], look);
}
function tangent(k: Pick<TangentKit, keyof TangentKit>): void {
  const look = { wash: 0x3f7e4e, washTop: 0x5b9a5e, kind: 33, p1: 0.3, p2: 1.7, emit: 0.13, line: 1.8 };
  k.quad(p, x, y, 1.3, 2.7, look); k.tri(p, q, z, look);
  k.box(0.3, 0.7, -1.1, 1.7, 0.8, 2.3, look, { top: null, sides: 9 });
  k.beam(p, q, 0.2, 0.7, look); k.flatBar(p, q, 0.07, z, look); k.wire(p, q, 0.031, look);
  k.cyl(0.3, 0.7, -1.1, 0.7, 0.1, 1.3, 9, look);
  k.blob(soup, 0.1, 0.3, -0.7, 0.7, 1.3, -0.2, look);
}

it.each([false, true])('packs ruled primitives exactly with compact=%s', compact => {
  const a = new AuthorRuled(), b = new RuledKit(); a.compact = b.compact = compact;
  ruled(a); ruled(b); expect(a.vertexCount).toBe(b.vertexCount);
  expect(a.boundsFrom(4, new Box3())).toEqual(b.boundsFrom(4, new Box3()));
  equal(a.build(), b.build()); a.release(); b.release(); expect(a.vertexCount).toBe(b.vertexCount);
});
it('keeps swept primitives, curves and mixed merges native-byte equal', () => {
  expect(authorCurve([p, q, z], 9)).toEqual(curve([p, q, z], 9));
  const a = new AuthorSwept(), b = new SweptKit(); swept(a); swept(b);
  expect(a.boundsFrom(4, new Box3())).toEqual(b.boundsFrom(4, new Box3())); equal(a.build(), b.build());
  const ra = new AuthorRuled(), rb = new RuledKit(); ruled(ra); ruled(rb);
  const aa = [ra.build(), a.build()], bb = [rb.build(), b.build()]; equal(authorMerge(aa), mergeKits(bb));
  for (const g of [...aa, ...bb]) g.dispose(); a.release(); b.release(); ra.release(); rb.release();
});
it('appends author and runtime tangent rows without double-to-float rounding', () => {
  const a = new AuthorTangent(), b = new TangentKit(); tangent(a); tangent(b);
  expect(a.bounds(new Box3())).toEqual(b.bounds(new Box3())); equal(a.build(), b.build());
  for (const tint of [null, new Color(0.9, 0.7, 0.3)]) {
    const left = new AuthorTangent(), right = new TangentKit(), m = new Matrix4().makeRotationY(0.371).scale(new Vector3(1.3, 0.7, -0.9)).setPosition(p);
    left.append(b, m, tint); right.append(a, m, tint);
    expect(left.vertexCount).toBe(right.vertexCount); expect(left.triangleCount).toBe(right.triangleCount);
    equal(left.build(), right.build()); left.release(); right.release();
  }
  a.release(); b.release();
});
