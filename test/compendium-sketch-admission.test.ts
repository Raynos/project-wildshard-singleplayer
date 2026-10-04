import { describe, expect, it } from 'vitest';
import { compendiumSketches, parseSketchSvg, sketchReference } from '../src/game/shardfile/sketch';
import { TEMPLATE_ROWS } from '../src/shards/_template/data/rows';

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
});
