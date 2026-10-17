import { fileURLToPath } from 'node:url';
import * as layout from './layout.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

/** JSON's declaration companion preserves tuple arity without executable const mirrors. */
/** @param {unknown} value @returns {string} */
function shape(value) {
  if (Array.isArray(value)) return `[${value.map(shape).join(',')}]`;
  if (typeof value === 'object' && value !== null) return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${shape(item)}`).join(';')}}`;
  return typeof value;
}
/** @type {Record<string, string | undefined>} */
const types = {
  CABIN_SITES: '{ x: number; z: number; rot: number }[]',
  SPURS: 'Record<string, XZ[]>',
  GRADED: '{ paths: XZ[][]; maxGrade: number }',
  PINE_HOLLOW_POIS: '{ id: string; name: string; x: number; z: number; r: number; foot: XZ | null }[]',
  PINE_HOLLOW_ZONES: '{ label: string; x: number; z: number }[]',
};
for (const name of ['LOOKOUT_TRAIL', 'RIDGE_STREAM', 'CREEK', 'STANDING_STONES', 'S_ROAD', 'N_ROAD', 'W_ROAD', 'E_ROAD', 'DEN_TRAIL']) types[name] = 'XZ[]';
const declaration = `{${Object.entries(layout).map(([name, value]) => `${JSON.stringify(name)}: ${types[name] ?? shape(value)}`).join(';')}}`;
const writer = byteWriter(process.argv.includes('--check'), 'pine-layout');
writer.put(fileURLToPath(new URL('../data/layout.generated.json', import.meta.url)), jsonBytes(layout));
writer.put(fileURLToPath(new URL('../data/layout.generated.d.json.ts', import.meta.url)), Buffer.from(`// Generated fixed-coordinate types; no runtime declarations.\ntype XZ = [number, number];\ndeclare const layout: ${declaration};\nexport default layout;\n`));
writer.finish();
