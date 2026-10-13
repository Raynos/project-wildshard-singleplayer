import { expect, expectTypeOf, it } from 'vitest';
import { BufferAttribute, type BufferGeometry, Color, Vector3 } from 'three';
import { Ctx, type InKit } from '../../../src/shards/nine-dragon-stack/generators/ctx';
import { Ctx as RuntimeCtx, type InKit as RuntimeInKit } from '../../../src/shards/nine-dragon-stack/world/ctx';
import { hipRoof } from '../../../src/shards/nine-dragon-stack/generators/hipRoof';
import { hipRoof as runtimeRoof } from '../../../src/shards/nine-dragon-stack/world/hipRoof';
import { buildGuardProcedural } from '../../../src/shards/nine-dragon-stack/generators/guard';
import { buildGuardProcedural as runtimeGuard } from '../../../src/shards/nine-dragon-stack/world/hero/weapon-parts';
import { KitX } from '../../../src/shards/nine-dragon-stack/generators/kitx';
import { KitX as RuntimeKitX } from '../../../src/shards/nine-dragon-stack/world/hero/kitx';
import type { SignSink } from '../../../src/shards/nine-dragon-stack/assets/contracts/signPlacement';

import type { AuthoredPlacement } from '../../../src/shards/nine-dragon-stack/assets/contracts/modelPlacement';
import type { Placement } from '@wildshard/engine/models/model';
import type { Emitter } from '../../../src/shards/nine-dragon-stack/runtime/looks/vertexSpill';

function bytes(g: BufferGeometry): Record<string, object> {
  const result: Record<string, object> = {};
  for (const [key, attr] of [...Object.entries(g.attributes), ...(g.index === null ? [] : [['index', g.index] as const])]) {
    if (!(attr instanceof BufferAttribute)) throw new Error('Expected native non-interleaved geometry');
    result[key] = { type: attr.array.constructor.name, components: attr.itemSize, normalized: attr.normalized,
      raw: new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength) };
  }
  return result;
}
function equal(a: BufferGeometry, b: BufferGeometry): void {
  expect(bytes(a)).toEqual(bytes(b)); expect(a.boundingBox).toEqual(b.boundingBox); expect(a.boundingSphere).toEqual(b.boundingSphere);
  a.dispose(); b.dispose();
}
function signs(): { sink: SignSink; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const sink: SignSink = { place: (...args) => { calls.push(args); return { w: 0, h: 0 }; },
    light: (...args) => { calls.push(args); }, tube: (...args) => { calls.push(args); } };
  return { sink, calls };
}

it('records context, named kits, dressing and RNG continuation like runtime', () => {
  const a = new Ctx(signs().sink), b = new RuntimeCtx(signs().sink);
  for (const ctx of [a, b]) {
    expect(ctx.kit('opaque', true)).toBe(ctx.kit('opaque'));
    ctx.kit('opaque').box(1, 2, 3, 4, 5, 6, { wash: 0x123456 });
    ctx.alpha('cut').wire(new Vector3(1, 2, 3), new Vector3(4, 5, 6), 0.1, { wash: 0xffffff });
    ctx.kitx('swept').sweep([new Vector3(), new Vector3(1, 2, 3)], () => 0.1, 7, { wash: 0x456789 });
    ctx.far('opaque', 123); expect(ctx.cell('opaque', -0.1, 32.1)).toBe('opaque#-1,1');
    ctx.lantern(1, 2, 3, 0.7, -0.3); ctx.ac(-1, 2, 3, 0.7);
    for (const at of [new Vector3(-20, 55, -30), new Vector3(-20, 120, -30), new Vector3(80, 125, 80)]) {
      ctx.put('cage', at, new Vector3(1, 0, -1), new Vector3(0.7, 1.3, -0.5), new Color(0.3, 0.4, 0.7));
    }
    for (const late of [false, true, false]) {
      ctx.fd.late = late; ctx.fd.addSign({ at: new Vector3(1, 2, Number(late)), normal: new Vector3(0, 0, 1), size: 0.7, color: 0xff33aa, blade: late });
    }
    ctx.fd.shell.box(0.3, 1.7, -0.4, 1, 2, 3, { wash: 0x123456 });
  }
  for (const key of ['lanterns', 'acs', 'inst', 'reflective', 'farOf'] as const) expect(a[key]).toEqual(b[key]);
  expect(a.fd.signs).toEqual(b.fd.signs);
  equal(a.fd.shell.build(), b.fd.shell.build());
  for (const key of ['kits', 'alphaKits', 'kitxs'] as const) for (const [name, kit] of a[key]) {
    const twin = b[key].get(name); if (twin === undefined) throw new Error('Missing runtime kit');
    equal(kit.build(), twin.build());
  }
  for (let i = 0; i < 200; i++) expect(a.rng.next()).toBe(b.rng.next());
});

it('packs hip roofs and their neon calls exactly like runtime', () => {
  for (const neon of [null, 0xff33aa]) {
    const sa = signs(), sb = signs(), a = new Ctx(sa.sink), b = new RuntimeCtx(sb.sink), ka = a.kit('roof'), kb = b.kit('roof');
    hipRoof(a, ka, 1.7, 125.3, -2.1, 17.3, 6.7, 2.3, 0.5, 0x245e48, neon);
    runtimeRoof(b, kb, 1.7, 125.3, -2.1, 17.3, 6.7, 2.3, 0.5, 0x245e48, neon);
    equal(ka.build(), kb.build()); expect(sa.calls).toEqual(sb.calls);
  }
});

it('packs the procedural dragon guard exactly like runtime', () => {
  const a = new KitX(), b = new RuntimeKitX(); buildGuardProcedural(a); runtimeGuard(b); equal(a.build(), b.build());
});

it('keeps copied author record contracts equal to their runtime twins', () => {
  expectTypeOf<AuthoredPlacement<object>>().toEqualTypeOf<Placement<object>>();
  expectTypeOf<Ctx['emitters'][number]>().toEqualTypeOf<Emitter>();
  expectTypeOf<Omit<InKit, 'kit'>>().toEqualTypeOf<Omit<RuntimeInKit, 'kit'>>();
});
