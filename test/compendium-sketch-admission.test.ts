import { describe, expect, it } from 'vitest';
import { compendiumSketches, parseSketchSvg, sketchReference } from '../src/game/shardfile/sketch';
import { TEMPLATE_ROWS } from '../src/shards/_template/data/rows';
import { emptyShardfile } from '../src/sdk/author';
import { parseRows } from '../src/game/shardfile/rows';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { preflightAssetGraph } from '../src/game/shardfile/assetGraph';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { Scope } from '../src/engine/app/scope';
import { declaredCompendium } from '../src/game/shard/declaredRows';

const svg = (attributes = '', content = '<rect width="16" height="32" fill="#aaa"/>'): string => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="32" ${attributes}>${content}</svg>`;
const inline = (xml: string): string => `data:image/svg+xml,${encodeURIComponent(xml)}`;
const hash = 'a'.repeat(64);

describe('compendium sketch admission', () => {
  it('bounds and charges the actual template raster once, independently of wire bytes', () => {
    const sketches = compendiumSketches(TEMPLATE_ROWS, new Map());
    expect(sketches.size).toBe(1);
    const sketch = [...sketches.values()][0];
    expect(sketch).toMatchObject({ width: 390, height: 844, decoded: 1_316_640, gpu: 1_316_640 });
    expect(sketchReference(sketch?.data ?? '')).toBe(true);
  });
  it('resolves only already-admitted SVG hashes, with strict bounded UTF-8 and the same pure cost', () => {
    const rows = structuredClone(TEMPLATE_ROWS);
    const entry = rows.compendiums[0]?.entries[0]; if (entry === undefined) throw new Error('Missing fixture entry'); entry.sketch = hash;
    const bytes = new TextEncoder().encode(svg());
    expect(compendiumSketches(rows, new Map([[hash, bytes]])).get(hash)).toEqual(parseSketchSvg(svg()));
    expect(() => compendiumSketches(rows, new Map())).toThrow('Missing or oversized');
    expect(() => compendiumSketches(rows, new Map([[hash, new Uint8Array(4097)] ]))).toThrow('oversized');
    expect(() => compendiumSketches(rows, new Map([[hash, new Uint8Array([255])]]))).toThrow();
  });
  it('refuses network URLs, other data formats and active or external SVG resources', () => {
    // oxlint-disable-next-line no-script-url -- This negative fixture proves authored executable URLs are refused.
    for (const ref of ['https://example.test/sketch.svg', '//example.test/x', '/x.svg', 'javascript:alert(1)', 'data:image/png;base64,a', 'data:image/svg+xml,%xx']) expect(sketchReference(ref), ref).toBe(false);
    for (const xml of [svg('onload="alert(1)"'), svg('', '<script>alert(1)</script>'), svg('', '<image href="https://x"/>'), svg('', '<use href="#x"/>'), svg('style="background:url(https://x)"'), svg('', '<foreignObject/>'), svg('', '<path fill="url(https://x)"/>'), svg('', '<text>&#60;script</text>'), `<!DOCTYPE svg [<!ENTITY x SYSTEM "https://x">]>${svg()}`, svg('', '<animate/>')]) expect(sketchReference(inline(xml)), xml).toBe(false);
  });
  it('refuses giant rasters, repeated attributes, malformed nesting and oversized shapes before allocation', () => {
    for (const xml of [svg().replace('width="16"', 'width="1025"'), svg().replace('height="32"', 'height="1e300"'), svg('width="1"'), svg('', '<g></svg>'), svg('', '<rect x="Infinity"/>'), svg('', '<path d="M1e999 0"/>'), svg('', '<g>'.repeat(33) + '</g>'.repeat(33)), svg('', '<rect/>'.repeat(256)), svg('', `<path d="${'M0 0 '.repeat(1000)}"/>`)]) expect(() => parseSketchSvg(xml), xml.slice(0, 100)).toThrow();
    expect(parseSketchSvg(svg().replace('width="16"', 'width="1024"'))).toMatchObject({ decoded: 1024 * 32 * 4 });
  });
  it('refuses unsafe standalone author rows and overlong combat tags', () => {
    const rows = structuredClone(TEMPLATE_ROWS), entry = rows.compendiums[0]?.entries[0];
    if (entry === undefined) throw new Error('Missing fixture entry'); entry.sketch = 'https://example.test/x';
    expect(() => parseRows(rows)).toThrow('inert SVG');
    entry.sketch = inline(svg()); const strike = rows.strikes[0]; if (strike === undefined) throw new Error('Missing strike');
    strike.tags = [`damage.${'x'.repeat(128)}`]; expect(() => parseRows(rows)).toThrow();
  });
  it('requires hashed sketches in the charged library and accounts file transport and raster expansion separately', () => {
    const s = emptyShardfile({ slug: 'sketch-fixture', name: 'Sketch fixture', author: 'Test', revision: 1, seed: 58 });
    s.rows = structuredClone(TEMPLATE_ROWS);
    const entry = s.rows.compendiums[0]?.entries[0]; if (entry === undefined) throw new Error('Missing fixture entry'); entry.sketch = hash;
    const bytes = new TextEncoder().encode(svg()), raster = 16 * 32 * 8;
    s.files = [{ hash, kind: 'binary', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false }];
    s.critical = [hash]; expect(() => preflightAssetGraph(s)).toThrow('charged library');
    s.critical = []; s.library = [hash]; s.budgets.library = { resident: bytes.length + raster - 1, compressed: bytes.length };
    const assets = new Map([[hash, bytes]]);
    expect(() => validateShardfileAssets(s, assets, () => hash)).toThrow('sketch raster budget');
    s.budgets.library.resident++; expect(validateShardfileAssets(s, assets, () => hash)).toEqual(s);
    const allocator = new ResidencyAllocator(), scope = new Scope('sketch');
    try {
      leaseClientLibrary(s, assets, { allocator, scope, owner: 'sketch-copy' });
      expect(allocator.cost().input.libraries).toBe(bytes.length + raster);
      const row = s.rows.compendiums[0]; if (row === undefined) throw new Error('Missing compendium');
      expect(() => declaredCompendium(row, s.rows, 'sketch-fixture')).toThrow('admitted sketch');
      const resolved = compendiumSketches(s.rows, assets);
      expect(declaredCompendium(row, s.rows, 'sketch-fixture', ref => resolved.get(ref)?.data ?? '').entries[0]?.plate.sketch).toBe(inline(svg()));
    } finally { scope.dispose(); }
    expect(allocator.entries()).toHaveLength(0);
  });
});
