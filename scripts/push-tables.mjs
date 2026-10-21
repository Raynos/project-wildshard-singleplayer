// D8 exception: small source declarations only, never asset/product generation.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { authoredManifestSource, productManifestPath } from '../scripts/authored-manifest.mjs';
import { manifestFolders, outputManifest, shardProducts } from '../scripts/shard-outputs.mjs';
import { genStarterArmClips } from '../scripts/gen-starter-arm-clips.mjs';
import { genStarterWeapons } from '../scripts/gen-starter-weapons.mjs';
import { genStarterBag } from '../scripts/gen-starter-bag.mjs';
import { genStarterEffects } from '../scripts/gen-starter-effects.mjs';
import { sectionType } from '../scripts/section-types.mjs';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema.ts';
import * as v from 'valibot';

const binding = v.looseObject({ module: v.string() });
const manifestBindings = v.looseObject({ bindings: v.looseObject({
  poses: v.optional(binding), budgets: v.optional(binding), mapPalette: v.optional(binding), audioCues: v.optional(binding), boot: v.optional(v.record(v.string(), binding)),
}) });

/** Standard manifest JSON bindings are checked against their defining admitted
 * contracts, without building asset-dependent inventory values.
 * @param {string} root @param {string} folder @param {unknown} manifest @param {ReadonlySet<string>} outputs */
export function manifestTypeTables(root, folder, manifest, outputs) {
  const rows = v.parse(manifestBindings, manifest).bindings;
  const fields = [
    ...(['budgets', 'mapPalette'].flatMap(key => {
      const ref = key === 'budgets' ? rows.budgets : rows.mapPalette;
      return ref === undefined ? [] : [{ ref, type: `NonNullable<import('@wildshard/game/shard/manifest').AuthoredShardBindings[${JSON.stringify(key)}]>` }];
    })),
    ...(rows.audioCues === undefined ? [] : [{ ref: rows.audioCues, type: "NonNullable<import('@wildshard/game/shard/manifest').AuthoredShardBindings['audioBindings']>['cues']" }]),
    ...(rows.poses === undefined ? [] : [{ ref: rows.poses, type: "ReturnType<typeof import('@wildshard/format/minimap').parseCapturePoses>" }]),
    ...Object.entries(rows.boot ?? {}).map(([key, ref]) => ({ ref,
      type: `NonNullable<import('@wildshard/game/shard/manifest').AuthoredShardBindings['bootBindings']>[${JSON.stringify(key)}]` })),
  ];
  for (const { ref, type } of fields) {
    if (!/^\.\/(?:data|boot|assets)\/[a-zA-Z0-9_.-]+\.json$/u.test(ref.module)) continue;
    if (!outputs.has(`src/shards/${folder}/${ref.module.slice(2)}`)) continue;
    const path = resolve(root, 'src/shards', folder, ref.module.replace(/\.json$/u, '.d.json.ts'));
    if (existsSync(path) || existsSync(resolve(root, 'src/shards', folder, ref.module))) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `// Source-check declaration from the defining admitted manifest contract.\ndeclare const value: ${type};\n// oxlint-disable-next-line import/no-default-export -- JSON imports require the default value declaration.\nexport default value;\n`);
  }
}

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
      if (!/^(?:data|boot|assets)\/[a-zA-Z0-9_-]+(?:\.generated)?\.json$/u.test(name) || !schema(value)) throw new Error('Invalid typed JSON schema');
      const path = resolve(root, 'src/shards', slug, name.replace(/\.json$/u, '.d.json.ts'));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${header}declare const value: ${sectionType(formatJsonSchema(value, 'draft-07'))};\n// oxlint-disable-next-line import/no-default-export -- JSON imports require the default value declaration.\nexport default value;\n`);
    }
  }
}

/** @param {string} root */
export async function pushTables(root) {
  genStarterArmClips(root); genStarterWeapons(root); genStarterBag(root); genStarterEffects(root);
  /** @type {{ jobs: {shard:string|null;outputs:string[]}[] }} */
  const registry = JSON.parse(readFileSync(resolve(root, 'scripts/generation-jobs.json'), 'utf8'));
  const outputs = new Set(registry.jobs.flatMap(job => job.outputs));
  const owners = new Set(registry.jobs.filter(job => job.outputs.some(file => file.endsWith('/runtime/productSections.generated.d.ts'))).map(job => job.shard));
  for (const owner of owners) {
    if (owner !== null) await sectionTables(root, owner);
  }
  for (const product of shardProducts(root, manifestFolders(root))) {
    if (!existsSync(resolve(root, 'src/shards', product.folder, 'manifest.json'))) continue;
    const composed = product.output === null ? null : outputManifest(root, product.folder, product.output);
    manifestTypeTables(root, product.folder, composed ?? JSON.parse(readFileSync(resolve(root, 'src/shards', product.folder, 'manifest.json'), 'utf8')), outputs);
    writeFileSync(resolve(root, productManifestPath(root, product)), authoredManifestSource(root, product.slug, {
      folder: product.folder, composed, generation: true, metadataOnly: true,
    }));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await pushTables(resolve(process.argv[2] ?? '.'));
}
