import { fileURLToPath } from 'node:url';
import * as world from './layout.ts';
import * as places from './poiLayout.ts';
import * as clearings from './clearings.ts';
import { ecologyRows } from './ecology.mjs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

/** Preserve tuple arity in JSON imports without an executable declaration. */
function shape(value) {
  if (Array.isArray(value)) {
    if (value.length === 2 && value.every(item => typeof item === 'number')) return '[number, number]';
    return `(${[...new Set(value.map(shape))].join('|')})[]`;
  }
  if (typeof value === 'object' && value !== null) return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${shape(item)}`).join(';')}}`;
  return typeof value;
}
const writer = byteWriter(process.argv.includes('--check'), 'nalati-layout');
for (const [name, source] of Object.entries({ layout: world, poiLayout: places, clearings })) {
  const rows = Object.fromEntries(Object.entries(source).filter(([, value]) => typeof value !== 'function'));
  const declaration = `{${Object.entries(rows).map(([key, value]) => `${JSON.stringify(key)}: ${key === 'KURGANS' ? '{x:number;z:number;r:number;h:number;great?:boolean}[]' : shape(value)}`).join(';')}}`;
  // Authoring consumers and the existing boot boundary share one retained recipe.
  for (const folder of name === 'clearings' ? ['boot'] : ['boot', 'data']) {
    writer.put(fileURLToPath(new URL(`../${folder}/${name}.generated.json`, import.meta.url)), jsonBytes(rows));
    writer.put(fileURLToPath(new URL(`../${folder}/${name}.generated.d.json.ts`, import.meta.url)), Buffer.from(`// Generated fixed-coordinate types; no runtime declarations.\ndeclare const rows: ${declaration};\nexport default rows;\n`));
  }
}
writer.put(fileURLToPath(new URL('../data/ecology.generated.json', import.meta.url)), jsonBytes(ecologyRows()));
writer.put(fileURLToPath(new URL('../data/ecology.generated.d.json.ts', import.meta.url)), Buffer.from("// Generated data types; no runtime declarations.\nimport type { Ecology } from './ecologyTypes';\ndeclare const rows: Ecology;\nexport default rows;\n"));
writer.finish();
