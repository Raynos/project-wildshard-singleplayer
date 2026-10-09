import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
import { BufferAttribute, type BufferGeometry, Color, Matrix4, Vector3 } from 'three';
import { SignRecorder, bakeNineLayout, runLayout } from '../../../src/shards/nine-dragon-stack/generators/layout';
import { Ctx } from '../../../src/shards/nine-dragon-stack/world/ctx';
import { buildEntryDecks } from '../../../src/shards/nine-dragon-stack/world/entries';
import { Builder } from '../../../src/shards/nine-dragon-stack/world/facade/geo';
import { merge } from '../../../src/shards/nine-dragon-stack/world/hero/kitx';
import { LAYOUT_STAMP, LayoutBake, restoreLayout } from '../../../src/shards/nine-dragon-stack/world/layoutBake';
import { crossingColliders } from '../../../src/shards/nine-dragon-stack/world/well-mid';
import { peekQueued } from '../../../src/shards/nine-dragon-stack/world/props3d';
import { banyanOut } from '../../../src/shards/nine-dragon-stack/world/banyan';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const shipped = (): Uint8Array => new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/nine-dragon/baked/layout.bin', import.meta.url))));

/** a geometry's every attribute and its index as raw bytes (hashed), with the attribute kinds */
function fingerprint(g: BufferGeometry): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, a] of Object.entries(g.attributes)) {
    if (!(a instanceof BufferAttribute)) throw new Error(name);
    out[name] = `${a.array.constructor.name}/${String(a.itemSize)}/${String(a.normalized)}/${String(a instanceof BufferAttribute && 'isFloat16BufferAttribute' in a)}/${sha(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength))}`;
  }
  const i = g.index;
  if (i !== null) out['index'] = `${i.array.constructor.name}/${sha(new Uint8Array(i.array.buffer, i.array.byteOffset, i.array.byteLength))}`;
  out['sphere'] = JSON.stringify(g.boundingSphere);
  out['box'] = JSON.stringify(g.boundingBox);
  return out;
}

/** what build.ts does with a context after the layout: the entry decks (with caps), the sign slots, and its kits built */
function afterLayout(ctx: Ctx): Record<string, Record<string, string>> {
  buildEntryDecks(ctx, true);
  for (const s of ctx.fd.signs) ctx.signs.place({ at: s.at, normal: s.normal, size: 0.8, spec: { text: '麵', color: '#ff00aa', vertical: s.blade, style: s.blade ? 'tube' : 'box' }, blade: s.blade }, s.blade ? null : ctx.kit('facade-signs'));
  // a baked facade piece appended to the shell, as facade/batch.ts does
  const piece = new Builder();
  piece.quad(new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 1, 1, { wash: 0x806040 });
  ctx.fd.shell.append(piece, new Matrix4().makeTranslation(3, 125, -4), new Color(0.9, 0.8, 0.7));
  const out: Record<string, Record<string, string>> = {};
  for (const [name, k] of ctx.kits) {
    const kx = ctx.kitxs.get(name);
    if (kx !== undefined && kx.vertexCount > 0) out[`kit:${name}`] = fingerprint(k.vertexCount > 0 ? merge([k.build(), kx.build()]) : kx.build());
    else if (k.vertexCount > 0) out[`kit:${name}`] = fingerprint(k.build());
  }
  for (const [name, k] of ctx.kitxs) if (!ctx.kits.has(name) && k.vertexCount > 0) out[`kitx:${name}`] = fingerprint(k.build());
  for (const [name, k] of ctx.alphaKits) if (k.vertexCount > 0) out[`alpha:${name}`] = fingerprint(k.build());
  out['shell'] = fingerprint(ctx.fd.shell.build());
  out['shell']['tris'] = String(ctx.fd.shell.triangleCount);
  return out;
}

/** the context's records (everything but the geometry), as plain data */
function records(ctx: Ctx, calls: unknown): unknown {
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON on purpose: the three classes become plain numbers to compare
  return JSON.parse(JSON.stringify({
    walkers: ctx.walkers, sitters: ctx.sitters, lanterns: ctx.lanterns, acs: ctx.acs, hooks: ctx.hooks, hookMounts: ctx.hookMounts, map: ctx.map,
    steam: ctx.steam, emitters: ctx.emitters, reflective: [...ctx.reflective], farOf: [...ctx.farOf], inst: [...ctx.inst],
    inKit: ctx.inKit.map((c) => ({ model: c.model, at: c.at, box: c.box })), pieces: ctx.fd.pieces, windows: ctx.fd.windows, slots: ctx.fd.signs,
    towers: ctx.fd.towers, rng: ctx.rng.snapshot(), calls, crossings: crossingColliders(), queued: peekQueued().sets.map(([n, s]) => [n, s.at, fingerprint(s.geo)]),
    lions: peekQueued().lions, banyan: banyanOut.plan,
  }));
}

describe('Nine Dragon bakes its layout offline (G285)', () => {
  it('the committed bake is byte-exact against its generator (the stale gate: rerun scripts/bake-nine-layout.mjs)', () => {
    const bin = bakeNineLayout(), bytes = shipped();
    expect({ bin: sha(bin), bytes: bin.length }).toEqual({ bin: LAYOUT_STAMP.bin, bytes: LAYOUT_STAMP.bytes });
    expect(sha(bytes)).toBe(LAYOUT_STAMP.bin);
  });

  it('restores the context the live builders fill: every kit, record, sign call and queue, and what the page adds after', () => {
    const liveSigns = new SignRecorder();
    const live = runLayout(liveSigns);
    const liveRecords = records(live, liveSigns.calls);
    const liveKits = afterLayout(live);
    const bakedSigns = new SignRecorder();
    const baked = new Ctx(bakedSigns);
    restoreLayout(new LayoutBake(shipped()), baked);
    expect(records(baked, bakedSigns.calls)).toEqual(liveRecords);
    expect(afterLayout(baked)).toEqual(liveKits);
  }, 60_000);
});
