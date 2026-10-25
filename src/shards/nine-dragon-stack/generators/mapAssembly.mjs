// Node adapter for the retained native map job; source assembly receives explicit bytes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MapAssembly } from '../../../../scripts/map-geometry.mjs';
import { nineCastFiles } from './castsProgram.ts';
import { nineMapAssemblyFrom } from './mapAssemblySource.ts';
import { admitNativeSignAtlas } from './nativeSignAtlas.ts';
import { admitNativeGlyphs } from './nativeGlyphs.ts';
import nativeInputs from '../data/nativeSignAtlas.json' with { type: 'json' };
import glyphInputs from '../data/nativeGlyphs.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '../../../..');
const read = url => new Uint8Array(readFileSync(resolve(root, `public${url}`)));

export async function nineMapAssembly() {
  const files = await nineCastFiles(read), casts = new Map([...files].filter(([name]) => name.startsWith('raw/'))
    .map(([name, bytes]) => [name.slice(4, -4), bytes]));
  const native = admitNativeSignAtlas(new Map(nativeInputs.map(row => [row.name, read(row.input)])), nativeInputs);
  const glyphs = admitNativeGlyphs(new Map(glyphInputs.map(row => [row.name, read(row.input)])), glyphInputs);
  const assembly = new MapAssembly();
  const { facade } = await nineMapAssemblyFrom({ casts, native, glyphs, read }, assembly);
  return { assembly, facade };
}

/** Native map painting consumes owned values, without a source-file handoff. */
export async function nineMapFiles() {
  const { assembly } = await nineMapAssembly();
  try {
    const { json, binary } = assembly.encode();
    return new Map([['map/assembly.json', json], ['map/geometry.bin', binary]]);
  } finally { for (const shape of assembly.shapes) { shape.geometry.dispose(); shape.material.dispose(); } }
}
