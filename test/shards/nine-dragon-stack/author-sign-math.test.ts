import { expect, it } from 'vitest';
import { BufferAttribute, type BufferGeometry, Vector3 } from 'three';
import { SIGN_STYLES, type SignStyle } from '../../../src/shards/nine-dragon-stack/data/signs';
import type { SignPlace } from '../../../src/shards/nine-dragon-stack/data/signPlacement';
import { neonSize, signSize, signBoard, signBoardBox } from '../../../src/shards/nine-dragon-stack/generators/signMath';
import { NeonText } from '../../../src/shards/nine-dragon-stack/runtime/signs/neonText';
import { signSize as runtimeSize, signBoardBox as runtimeBox } from '../../../src/shards/nine-dragon-stack/runtime/signs/signAtlas';
import { signBoard as runtimeBoard } from '../../../src/shards/nine-dragon-stack/look/signs';
import { Kit } from '../../../src/shards/nine-dragon-stack/world/kit';

const styles: readonly SignStyle[] = ['tube', 'box', 'plaque', 'paper', 'talisman', 'etch', 'banner'];
const words = ['', '麵', '九龍𠮷', 'A👩🏽‍🚀'];
function place(style: SignStyle, text: string, size: number, vertical: boolean, blade = false, normal = new Vector3(0, 0, 1)): SignPlace {
  return { at: new Vector3(-0, 125.125, -24.5), normal, size, spec: { style, text, vertical, color: '#ff00aa' }, blade };
}
function attributes(g: BufferGeometry): Record<string, { kind: string; components: number; normalized: boolean; bytes: Uint8Array }> {
  const out: Record<string, { kind: string; components: number; normalized: boolean; bytes: Uint8Array }> = {};
  const entries = [...Object.entries(g.attributes), ...(g.index === null ? [] : [['index', g.index] as const])];
  for (const [name, attr] of entries) {
    if (!(attr instanceof BufferAttribute)) throw new Error('Expected native non-interleaved board attributes');
    out[name] = { kind: attr.array.constructor.name, components: attr.itemSize, normalized: attr.normalized,
      bytes: new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength) };
  }
  return out;
}

it('sizes every authored style and Unicode orientation exactly like the runtime', () => {
  expect(new Set(Object.keys(SIGN_STYLES))).toEqual(new Set(styles));
  for (const style of styles) for (const text of words) for (const size of [0, 0.01, 0.8, 2.3]) for (const vertical of [false, true]) {
    const p = place(style, text, size, vertical);
    expect(signSize(p)).toEqual(runtimeSize(SIGN_STYLES[style], p));
    expect(neonSize(text, size, vertical)).toEqual(NeonText.size(text, size, vertical));
  }
});

it('packs every board placement into identical native attributes without mutating its row', () => {
  const normals = [new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(1, 0.7, -0.8).normalize()];
  for (const style of styles) for (const normal of normals) for (const blade of [false, true]) for (const vertical of [false, true]) {
    const p = place(style, '九龍𠮷', 0.8, vertical, blade, normal), before = { at: p.at.clone(), normal: p.normal.clone() };
    const size = signSize(p);
    expect(signBoardBox(p, size.w, size.h)).toEqual(runtimeBox(SIGN_STYLES[style], p, size.w, size.h));
    const author = new Kit(), runtime = new Kit();
    signBoard(author, p, size.w, size.h); runtimeBoard(runtime, p, size.w, size.h);
    const a = author.build(), b = runtime.build();
    expect(attributes(a)).toEqual(attributes(b));
    expect(a.boundingBox).toEqual(b.boundingBox); expect(a.boundingSphere).toEqual(b.boundingSphere);
    expect({ at: p.at, normal: p.normal }).toEqual(before);
    a.dispose(); b.dispose(); author.release(); runtime.release();
  }
});
