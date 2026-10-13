// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { GlyphField, type GlyphFieldLayout } from '../../../src/shards/nine-dragon-stack/runtime/signs/glyphField';
import { glyphLayout } from '../../../src/shards/nine-dragon-stack/tier';
import { chars } from '../../../src/shards/nine-dragon-stack/util';
import { FONT_CHARS } from '../../../src/shards/nine-dragon-stack/world/words';
import { GlyphField as OriginalGlyphField } from '../../fixtures/nine-glyph/glyphField';

/**
 * A deterministic 2D canvas: `fillText` paints antialiased brush strokes seeded by the character (and `salt`), `scale`
 * times the font's px, so the atlas sees partial coverage, crossings, ink running past its cell and, with `blank`, none.
 */
const ORIGINAL_CONTEXT = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
function fakeCanvas(salt: number, scale: number, blank = false): void {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true, value(this: HTMLCanvasElement) { return fakeContext(this, salt, scale, blank); } });
}
function fakeContext(canvas: HTMLCanvasElement, salt: number, scale: number, blank: boolean): object {
  let font = '', data = new Uint8ClampedArray(0);
  const ensure = (): void => { const w = canvas.width, h = canvas.height; if (data.length !== w * h * 4) data = new Uint8ClampedArray(w * h * 4); };
  const ctx = {
    fillStyle: '', textAlign: '', textBaseline: '',
    get font(): string { return font; },
    set font(value: string) { font = value; },
    fillRect: (): void => { ensure(); for (let i = 3; i < data.length; i += 4) data[i] = 255; },
    fillText: (ch: string, x: number, y: number): void => {
      ensure();
      const w = canvas.width, h = canvas.height;
      if (blank) return;
      const px = Number(/(\d+)px/.exec(font)?.[1] ?? 64) * scale;
      let s = ((ch.codePointAt(0) ?? 1) ^ salt) >>> 0;
      const rnd = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
      const strokes = 3 + Math.floor(rnd() * 6), width = px * (0.04 + rnd() * 0.06);
      for (let k = 0; k < strokes; k++) {
        const ax = x + (rnd() - 0.5) * px, ay = y + (rnd() - 0.5) * px, bx = x + (rnd() - 0.5) * px, by = y + (rnd() - 0.5) * px;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - width - 2)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + width + 2));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by) - width - 2)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + width + 2));
        const dx = bx - ax, dy = by - ay, l2 = Math.max(dx * dx + dy * dy, 1e-9);
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
          const t = Math.max(0, Math.min(1, ((xx + 0.5 - ax) * dx + (yy + 0.5 - ay) * dy) / l2));
          const ex = xx + 0.5 - (ax + t * dx), ey = yy + 0.5 - (ay + t * dy);
          const cover = Math.max(0, Math.min(1, width - Math.sqrt(ex * ex + ey * ey) + 0.5));
          const i = (yy * w + xx) * 4, value = Math.max(data[i] ?? 0, Math.round(cover * 255));
          data[i] = value; data[i + 1] = value; data[i + 2] = value;
        }
      }
    },
    getImageData: (sx: number, sy: number, sw: number, sh: number): { data: Uint8ClampedArray } => {
      ensure();
      const w = canvas.width;
      const out = new Uint8ClampedArray(sw * sh * 4);
      for (let r = 0; r < sh; r++) out.set(data.subarray(((sy + r) * w + sx) * 4, ((sy + r) * w + sx + sw) * 4), r * sw * 4);
      return { data: out };
    },
  };
  Object.defineProperty(canvas, 'getContext', { value: () => ctx });
  return ctx;
}

const bytes = (field: { texture: { image: { data: unknown } } }): Uint8Array => {
  const data = field.texture.image.data;
  if (!(data instanceof Uint8Array)) throw new Error('glyph atlas data is not bytes');
  return data;
};

/** the first texel byte where two atlases differ (-1: none), cheaper than a deep equal of 8 MB */
const firstDifference = (a: Uint8Array, b: Uint8Array): number => {
  if (a.length !== b.length) return 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
};

function compare(list: readonly string[], layout: GlyphFieldLayout): void {
  const before = new OriginalGlyphField(list, layout, 'serif');
  const after = new GlyphField(list, layout, 'serif');
  expect(after.size).toBe(before.size);
  expect(firstDifference(bytes(after), bytes(before))).toBe(-1);
  for (const ch of new Set(list)) expect(after.rect(ch)).toEqual(before.rect(ch));
}

describe('windowed Nine glyph atlas keeps every texel of the whole-atlas transform', () => {
  afterEach(() => { if (ORIGINAL_CONTEXT !== undefined) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', ORIGINAL_CONTEXT); });

  it('matches both tiers byte for byte on brush glyphs', () => {
    for (const salt of [0, 0x5a17, 0x9e3779b9]) {
      fakeCanvas(salt, 0.8);
      compare(chars(FONT_CHARS), glyphLayout('phone'));
      compare(chars(FONT_CHARS), glyphLayout('desktop'));
    }
  });

  it('matches when the ink runs past its cells to the atlas edges', () => {
    fakeCanvas(7, 2.4);
    compare(chars(FONT_CHARS), { cell: 32, fontPx: 40, spread: 9, skeletonSpread: 13 });
    compare(chars(FONT_CHARS).slice(0, 9), glyphLayout('phone'));
  });

  it('matches an atlas with no ink', () => {
    fakeCanvas(1, 0.8, true);
    compare(chars(FONT_CHARS).slice(0, 20), glyphLayout('phone'));
  });

  it('takes the same atlas from prepare', async () => {
    fakeCanvas(3, 0.8);
    const list = chars(FONT_CHARS), layout = glyphLayout('phone');
    await GlyphField.prepare(list, layout, 'serif');
    const prepared = new GlyphField(list, layout, 'serif'), before = new OriginalGlyphField(list, layout, 'serif');
    expect(firstDifference(bytes(prepared), bytes(before))).toBe(-1);
  });
});
