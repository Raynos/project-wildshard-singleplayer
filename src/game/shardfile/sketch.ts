import { SHARDFILE_ADMISSION_LIMITS as L } from './admissionLimits';
import type { ShardRows } from './rows';

const prefix = 'data:image/svg+xml,';
const hash = /^(?:commons:)?[0-9a-f]{64}$/u;
const tags = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const lengths = new Set(['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'stroke-width']);
const colours = new Set(['fill', 'stroke']);
const units = new Set(['opacity', 'fill-opacity', 'stroke-opacity']);
const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu;
const numbers = (value: string): number[] => {
  const tokens = value.trim().split(/[\s,]+/u);
  if (tokens.length === 0 || tokens.some(token => !number.test(token))) throw new Error('Invalid sketch numbers');
  const result = tokens.map(Number);
  if (result.some(n => !Number.isFinite(n) || Math.abs(n) > 1_000_000)) throw new Error('Sketch coordinate limit');
  return result;
};

/** An inert vector sketch and its one bounded CPU/GPU raster expansion, separate from admitted wire-file costs. */
export interface CompendiumSketch { data: string; width: number; height: number; decoded: number; gpu: number }

/** Parse a small shape-only SVG without DOM allocation, entities, active tags, styles or external resource attributes. */
export function parseSketchSvg(xml: string): CompendiumSketch {
  if (new TextEncoder().encode(xml).length > L.textCharacters || /[&]/u.test(xml)) throw new Error('Sketch SVG size or entities');
  const stack: string[] = []; let cursor = 0, count = 0, width = 0, height = 0, root = false;
  for (const match of xml.matchAll(/<([^<>]+)>/gu)) {
    if (xml.slice(cursor, match.index).trim() !== '') throw new Error('Sketch SVG must contain only inert shapes');
    cursor = match.index + match[0].length;
    const token = match[1]; if (token === undefined || ++count > 256) throw new Error('Sketch SVG shape limit');
    if (token.startsWith('/')) { if (stack.pop() !== token.slice(1).trim()) throw new Error('Sketch SVG closing tag'); continue; }
    const header = /^([a-z]+)(?=\s|\/|$)/u.exec(token), tag = header?.[1];
    if (tag === undefined || !tags.has(tag) || (tag === 'svg' ? root || stack.length > 0 : stack.length === 0)) throw new Error('Sketch SVG tag refused');
    if (tag === 'svg') root = true;
    const selfClosing = token.endsWith('/'), body = token.slice(tag.length, selfClosing ? -1 : undefined), attrs = new Map<string, string>();
    let at = 0;
    for (const attr of body.matchAll(/([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) {
      if (body.slice(at, attr.index).trim() !== '') throw new Error('Sketch SVG attribute syntax');
      at = attr.index + attr[0].length;
      const key = attr[1], value = attr[2] ?? attr[3];
      if (key === undefined || value === undefined || attrs.has(key) || attrs.size >= 24) throw new Error('Sketch SVG attributes');
      attrs.set(key, value);
      if (lengths.has(key)) { if (numbers(value).length !== 1) throw new Error('Sketch SVG length'); }
      else if (colours.has(key)) { if (!/^(?:#[0-9a-f]{3,8}|[a-z]{1,32})$/iu.test(value)) throw new Error('Sketch SVG paint refused'); }
      else if (units.has(key)) { const n = numbers(value); if (n.length !== 1 || n.some(x => x < 0 || x > 1)) throw new Error('Sketch SVG opacity'); }
      else if (key === 'xmlns') { if (tag !== 'svg' || value !== 'http://www.w3.org/2000/svg') throw new Error('Sketch SVG namespace'); }
      else if (key === 'viewBox') { const n = numbers(value); if (tag !== 'svg' || n.length !== 4 || (n[2] ?? 0) <= 0 || (n[3] ?? 0) <= 0) throw new Error('Sketch SVG viewBox'); }
      else if (key === 'd') {
        if (tag !== 'path' || !/^[MmZzLlHhVvCcSsQqTtAaEe0-9+.,\s-]+$/u.test(value)) throw new Error('Sketch SVG path');
        for (const coordinate of value.matchAll(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/giu)) numbers(coordinate[0]);
      }
      else if (key === 'points') { if (tag !== 'polygon' && tag !== 'polyline') throw new Error('Sketch SVG points'); numbers(value); }
      else if (key === 'transform') {
        let end = 0;
        for (const transform of value.matchAll(/(?:matrix|translate|scale|rotate|skewX|skewY)\(([^()]*)\)/gu)) {
          if (value.slice(end, transform.index).trim() !== '') throw new Error('Sketch SVG transform');
          numbers(transform[1] ?? ''); end = transform.index + transform[0].length;
        }
        if (end === 0 || value.slice(end).trim() !== '') throw new Error('Sketch SVG transform');
      } else if (key === 'fill-rule') { if (!['nonzero', 'evenodd'].includes(value)) throw new Error('Sketch SVG fill rule'); }
      else throw new Error('Sketch SVG resource or active attribute refused');
    }
    if (body.slice(at).trim() !== '') throw new Error('Sketch SVG attribute syntax');
    if (tag === 'svg') {
      width = Number(attrs.get('width')); height = Number(attrs.get('height'));
      if (attrs.get('xmlns') !== 'http://www.w3.org/2000/svg' || ![width, height].every(n => Number.isInteger(n) && n >= 1 && n <= 1024)) throw new Error('Sketch SVG raster dimensions');
    }
    if (!selfClosing) stack.push(tag);
    if (stack.length > 32) throw new Error('Sketch SVG nesting limit');
  }
  if (!root || stack.length > 0 || xml.slice(cursor).trim() !== '') throw new Error('Incomplete sketch SVG');
  return { data: prefix + encodeURIComponent(xml), width, height, decoded: width * height * 4, gpu: width * height * 4 };
}

/** Author references are bounded inline SVG data or immutable hashes; arbitrary URLs never reach the journal. */
export function sketchReference(value: string): boolean {
  if (value.length > L.textCharacters) return false;
  if (hash.test(value)) return true;
  if (!value.startsWith(prefix)) return false;
  try { parseSketchSvg(decodeURIComponent(value.slice(prefix.length))); return true; } catch { return false; }
}

/** Resolve each distinct sketch once from already-admitted bytes and derive its extra raster cost. */
export function compendiumSketches(rows: Pick<ShardRows, 'compendiums'>, assets: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, CompendiumSketch> {
  const result = new Map<string, CompendiumSketch>();
  for (const row of rows.compendiums) for (const entry of row.entries) {
    const ref = entry.sketch; if (result.has(ref)) continue;
    if (!sketchReference(ref)) throw new Error('Compendium sketch must be bounded inert SVG data or an admitted hash');
    if (ref.startsWith(prefix)) result.set(ref, parseSketchSvg(decodeURIComponent(ref.slice(prefix.length))));
    else {
      const bytes = assets.get(ref); if (bytes === undefined || bytes.length > L.textCharacters) throw new Error('Missing or oversized admitted sketch SVG');
      result.set(ref, parseSketchSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    }
  }
  return result;
}
