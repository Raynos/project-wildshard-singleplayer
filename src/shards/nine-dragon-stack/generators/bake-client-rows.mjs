import { fileURLToPath } from 'node:url';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import profiles from '../data/specimenProfiles.json' with { type: 'json' };
import draw from '../data/signView.json' with { type: 'json' };

/** Preserve literal row ids and tuple arity without shipping executable declarations.
 * @param {unknown} value @returns {string} */
function shape(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `readonly [${value.map(shape).join(',')}]`;
  if (typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `readonly ${JSON.stringify(key)}:${shape(item)}`).join(';')}}`;
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  throw new Error('Native client row is not JSON data');
}
/** @typedef {string | number | boolean} Parameter */
/** Defaults and every partial variant share the original profile's complete parameter type.
 * @param {{defaults:Record<string,Parameter>,variants:readonly {params:Partial<Record<string,Parameter>>}[]}} profile */
function parameters(profile) {
  return `{${Object.entries(profile.defaults).map(([key, value]) => {
    const type = typeof value === 'string'
      ? [...new Set([value, ...profile.variants.map(row => row.params[key]).filter(item => item !== undefined)])].map(shape).join('|')
      : typeof value;
    return `readonly ${JSON.stringify(key)}:${type}`;
  }).join(';')}}`;
}
const writer = byteWriter(process.argv.includes('--check'), 'nine-client-rows');
/** @param {string} path @param {string | Uint8Array} bytes */
const put = (path, bytes) => { writer.put(fileURLToPath(new URL(`../data/${path}`, import.meta.url)), bytes); };
put('signView.d.json.ts', `declare const rows: ${shape(draw)};\nexport default rows;\n`);
const fields = Object.entries(profiles).map(([key, value]) => `readonly ${JSON.stringify(key)}:${'defaults' in value && 'variants' in value ? `SpecimenProfile<${parameters(value)}>` : shape(value)}`);
put('specimenProfiles.d.json.ts', `import type { SpecimenProfile } from './specimenTypes';\ndeclare const rows: {${fields.join(';')}};\nexport default rows;\n`);
writer.finish();
