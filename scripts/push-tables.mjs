// D8 exception: small source declarations only, never asset/product generation.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { genShards } from '../scripts/gen-shards.mjs';
import { genStarterArmClips } from '../scripts/gen-starter-arm-clips.mjs';
import { genStarterWeapons } from '../scripts/gen-starter-weapons.mjs';
import { genStarterBag } from '../scripts/gen-starter-bag.mjs';
import { genStarterEffects } from '../scripts/gen-starter-effects.mjs';
import { sectionType } from '../scripts/section-types.mjs';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema.ts';

/** @param {unknown} value @returns {value is import('valibot').GenericSchema} */
function schema(value) {
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'schema'
    && 'type' in value && typeof value.type === 'string' && 'reference' in value && typeof value.reference === 'function'
    && 'expects' in value && typeof value.expects === 'string' && 'async' in value && value.async === false && '~run' in value;
}

/** Only schema-derived types: runtime data validation still belongs to product admission in CI.
 * @param {string} root @param {string} slug */
export async function sectionTables(root, slug) {
  const file = resolve(root, 'src/shards', slug, 'generators/sections.ts');
  if (!existsSync(file)) return;
  /** @type {unknown} */
  const namespace = await import(pathToFileURL(file).href);
  if (namespace === null || typeof namespace !== 'object' || !('SECTIONS' in namespace)
    || namespace.SECTIONS === null || typeof namespace.SECTIONS !== 'object') throw new Error('Missing section schemas');
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  const header = `// DO NOT EDIT: scripts/bake-section-schemas.mjs; generators/sections.ts sha256:${hash}\n`;
  const rows = Object.entries(namespace.SECTIONS).map(([name, value]) => {
    if (!schema(value)) throw new Error(`Invalid section schema: ${name}`);
    return `  ${JSON.stringify(name)}: ${sectionType(formatJsonSchema(value, 'draft-07'))};`;
  });
  const declarations = Object.entries(namespace).flatMap(([name, value]) => name.endsWith('Schema') && schema(value)
    ? [`export type ${name.slice(0, -6)} = ${sectionType(formatJsonSchema(value, 'draft-07'))};`] : []);
  const output = resolve(root, 'src/shards', slug, 'runtime/productSections.generated.d.ts');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${header}export interface CustomSections {\n${rows.join('\n')}\n}\n${declarations.join('\n')}\n`);
  if ('FILE_SCHEMAS' in namespace && namespace.FILE_SCHEMAS !== null && typeof namespace.FILE_SCHEMAS === 'object') {
    for (const [name, value] of Object.entries(namespace.FILE_SCHEMAS)) {
      if (!/^(?:data|boot)\/[a-zA-Z0-9_-]+(?:\.generated)?\.json$/u.test(name) || !schema(value)) throw new Error('Invalid typed JSON schema');
      const path = resolve(root, 'src/shards', slug, name.replace(/\.json$/u, '.d.json.ts'));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${header}declare const value: ${sectionType(formatJsonSchema(value, 'draft-07'))};\n// oxlint-disable-next-line import/no-default-export -- JSON imports require the default value declaration.\nexport default value;\n`);
    }
  }
}

/** @param {string} root */
export async function pushTables(root) {
  genStarterArmClips(root); genStarterWeapons(root); genStarterBag(root); genStarterEffects(root);
  genShards(root);
  for (const folder of readdirSync(resolve(root, 'src/shards'), { withFileTypes: true })) {
    if (folder.isDirectory()) await sectionTables(root, folder.name);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await pushTables(resolve(process.argv[2] ?? '.'));
}
