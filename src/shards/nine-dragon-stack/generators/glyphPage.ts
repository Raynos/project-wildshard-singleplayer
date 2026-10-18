import { zlibSync } from 'fflate';
import { bakeGlyphField } from './glyphField';
import { KAI_STACK, GLYPH_LAYOUT } from './signs';
import { FONT_CHARS } from '../data/words';

/** Native WebKit font output is retained, so portable product builds need neither system fonts nor a canvas. */
export function bakeGlyphPage(tier: keyof typeof GLYPH_LAYOUT): { size: number; layout: (typeof GLYPH_LAYOUT)[keyof typeof GLYPH_LAYOUT]; rects: Record<string, { u0: number; v0: number; u1: number; v1: number }>; packed: string[] } {
  const layout = GLYPH_LAYOUT[tier], field = bakeGlyphField(Array.from(FONT_CHARS), layout, KAI_STACK);
  const packed: string[] = [];
  for (let at = 0; at < field.data.length; at += 2_097_152) {
    const bytes = zlibSync(field.data.subarray(at, at + 2_097_152), { level: 9 });
    let raw = ''; for (let start = 0; start < bytes.length; start += 32768) raw += String.fromCodePoint(...bytes.subarray(start, start + 32768));
    packed.push(btoa(raw));
  }
  return { size: field.size, layout, rects: Object.fromEntries(field.rects), packed };
}

declare global { interface Window { bakeNineGlyphs: typeof bakeGlyphPage } }
window.bakeNineGlyphs = bakeGlyphPage;
