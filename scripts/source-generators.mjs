// G798 / GS2: the app-wide generated source tables (the GS1 inventory in
// docs/plans/tooling-perf/generators-spike-mini-plan.md), one registry row each. A row names its outputs, the input
// globs that feed them and how they are made: `generate` returns every output's text from plain producers (no Vite
// plugin, no virtual module, no shard build, G799); `run` drives a producer that writes its own outputs and has its own
// --check. `pnpm gen:source` (scripts/gen-source.mjs) runs them; the pre-commit hook and CI select them by input.
// GS3: a `committed` row's inputs are all tracked sources, so its outputs are committed (.gitignore un-ignores them);
// the other rows read what the shard builds write (discovery modules, baked public/assets files) and stay build-written,
// ignored files.
import { matchesGlob } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

/** @typedef {{ readonly id: string; readonly outputs: readonly string[]; readonly inputs: readonly string[]; readonly committed: boolean;
 *   readonly generate?: (root: string) => Promise<Readonly<Record<string, string>>>;
 *   readonly run?: (root: string, check: boolean) => void; readonly note?: string }} SourceGenerator */

/** @param {string} id @param {string} script @param {string} input @param {string} output @param {string} source @returns {SourceGenerator} */
const starter = (id, script, input, output, source) => ({
  id, outputs: [output], inputs: [input, script], committed: true,
  generate: async root => ({ [output]: (await import(pathToFileURL(`${root}/${script}`).href))[source]() }),
});

/** Compute in the caller's source view: committed checks pin imports and reads
 * to Git, so a child process must not escape into loose working-tree schemas.
 * @param {string} root @param {string} slug @returns {Promise<Readonly<Record<string,string>>>} */
async function schemaTables(root,slug) {
  const {sectionSchemaTables}=await import(pathToFileURL(`${root}/scripts/bake-section-schemas.mjs`).href);
  const {tables}=await sectionSchemaTables(root,slug);
  return tables;
}

/** @param {string} slug @param {readonly string[]} outputs @param {readonly string[]} [jsonInputs] @returns {SourceGenerator} */
function sectionSchemas(slug,outputs,jsonInputs=[]) {
  return {id:`${slug}-section-schemas`,outputs,committed:true,
    inputs:[`src/shards/${slug}/generators/sections.ts`,...jsonInputs,
      'scripts/source-generators.mjs','scripts/bake-section-schemas.mjs','scripts/section-types.mjs','scripts/shard-platform-format.mjs',
      'src/sdk/formatJsonSchema.ts','src/sdk/package.json','src/format/**','package.json','pnpm-lock.yaml'],
    generate:root=>schemaTables(root,slug)};
}

/** @type {readonly SourceGenerator[]} */
export const SOURCE_GENERATORS = [
  sectionSchemas('driftwood-isle',['src/shards/driftwood-isle/generators/sectionSchemas.ts','src/shards/driftwood-isle/runtime/productSections.d.ts'],['src/shards/driftwood-isle/data/bridgeRows.json']),
  sectionSchemas('pine-hollow',['src/shards/pine-hollow/generators/sectionSchemas.ts','src/shards/pine-hollow/runtime/productSections.d.ts']),
  starter('starter-arm-clips', 'scripts/gen-starter-arm-clips.mjs', 'src/game/systems/viewmodel/armAliases.json', 'src/game/systems/viewmodel/clips.generated.ts', 'starterArmClipsTableSource'),
  starter('starter-weapons', 'scripts/gen-starter-weapons.mjs', 'src/game/weapons/starterBow.json', 'src/game/weapons/starter.generated.ts', 'starterWeaponsTableSource'),
  starter('starter-bag', 'scripts/gen-starter-bag.mjs', 'src/game/bag/starterItems.json', 'src/game/bag/starter.generated.ts', 'starterBagTableSource'),
  starter('starter-effects', 'scripts/gen-starter-effects.mjs', 'src/game/systems/effects/starterRows.json', 'src/game/systems/effects/starter.generated.ts', 'starterEffectsTableSource'),
  {
    id: 'shard-slugs',
    outputs: ['src/game/shard/slugs.generated.ts', 'src/game/shard/slugs.generated.json'],
    inputs: ['src/shards/*/manifest.ts', 'src/shards/*/manifest.json', 'src/shards/*/outputs.json', 'scripts/shard-outputs.mjs', 'scripts/gen-shards.mjs'],
    committed: true,
    generate: async root => (await import(pathToFileURL(`${root}/scripts/gen-shards.mjs`).href)).slugTables(root),
  },
  {
    id: 'shard-list',
    outputs: ['src/shards.generated.ts'],
    inputs: ['src/shards/*/manifest.ts', 'src/shards/*/manifest.json', 'src/shards/*/outputs.json', 'src/game/grid/singleplayer.json', 'lint/legacy-shards.json', 'scripts/gen-shards.mjs', 'scripts/shard-outputs.mjs', 'scripts/authored-manifest.mjs', 'scripts/legacy-shards.mjs'],
    committed: true,
    note: 'literal composition imports derive from authored declarations; no discovery contents or products are read',
    generate: async root => ({ 'src/shards.generated.ts': (await import(pathToFileURL(`${root}/scripts/gen-shards.mjs`).href)).shardSource(root) }),
  },
  {
    id: 'manifest-closure',
    outputs: ['src/game/shard/manifest-closure.generated.json'],
    inputs: ['src/shards/*/manifest.ts', 'src/shards/*/manifest.json', 'src/shards/*/outputs.json', 'src/shards/*/shard.config.ts', 'src/game/grid/singleplayer.json', 'src/game/shard/slug.ts', 'scripts/gen-shards.mjs', 'scripts/shard-outputs.mjs', 'scripts/authored-manifest.mjs'],
    committed: false,
    note: 'walks every product discovery module, which the shard builds write',
    generate: async root => ({ 'src/game/shard/manifest-closure.generated.json': `${JSON.stringify((await import(pathToFileURL(`${root}/scripts/gen-shards.mjs`).href)).manifestClosure(root), null, 2)}\n` }),
  },
  {
    id: 'boot-audio',
    outputs: ['src/game/boot/audio.generated.ts'],
    inputs: ['public/assets/music/*/music.json', 'public/assets/sfx/*/sfx.json', 'scripts/app-build/gen.ts'],
    committed: true,
    // the writer reads public/assets from the working directory (the repo root)
    generate: async root => ({ 'src/game/boot/audio.generated.ts': (await import(pathToFileURL(`${root}/scripts/app-build/gen.ts`).href)).audioTableSource() }),
  },
  {
    id: 'boot-tables',
    outputs: ['src/game/boot/bytes.generated.ts', 'src/game/boot/versions.generated.ts', 'src/game/shard/art.generated.ts'],
    inputs: ['public/assets/**', 'src/shards/*/manifest.ts', 'src/shards/*/manifest.json', 'src/shards/**/*.jpg', 'src/shards/**/*.jpeg', 'src/shards/**/*.png', 'src/shards/**/*.webp', 'scripts/app-build/gen.ts', 'scripts/app-build/assetHashes.ts'],
    committed: false,
    note: 'size and hash every public/assets file (the shard builds\' baked outputs included) and walk the discovery modules',
    // the boot writers read public/assets and the manifests from the working directory (the repo root)
    generate: async root => (await import(pathToFileURL(`${root}/scripts/app-build/gen.ts`).href)).bootTableSources(),
  },
  {
    id: 'packs',
    outputs: ['src/game/boot/packs.generated.ts'],
    inputs: ['public/assets/**', 'src/game/boot/bytes.generated.ts', 'scripts/bake-packs.mjs'],
    committed: false,
    note: 'content-addressed pack blobs under public/assets/packs come with it, packed from the built public/assets',
    run: (root, check) => { execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', 'scripts/bake-packs.mjs', ...(check ? ['--check'] : [])], { cwd: root, stdio: 'inherit' }); },
  },
  {
    id: 'ktx2',
    outputs: ['src/engine/boot/ktx2.generated.ts'],
    inputs: ['scripts/ktx2-engine-map.json', 'scripts/ktx2-tables.mjs'],
    committed: true,
    note: 'the encoder publishes its activated common mappings beside assets; the plain table needs no native encoder',
    generate: async root => ({ 'src/engine/boot/ktx2.generated.ts': (await import(pathToFileURL(`${root}/scripts/ktx2-tables.mjs`).href)).engineKtx2TableSource(root) }),
  },
  {
    id: 'port-shares',
    outputs: ['src/game/shard/portShares.generated.ts'],
    inputs: ['scripts/source-generators.mjs'],
    committed: true,
    note: 'no producer or consumer measures it yet: the reviewed map stays empty (absent = unavailable, never zero custom)',
    generate: () => Promise.resolve({ 'src/game/shard/portShares.generated.ts': '// Generated by gen:source (scripts/source-generators.mjs) from reviewed measurements; absent means unclosed/unavailable, never zero custom.\nexport const PORT_SHARES: Readonly<Record<string, number>> = {};\n' }),
  },
  {
    // D24: the native build's page (was vite.config.ts's native plugin), the web page with the web-only boot swapped out
    id: 'native-page',
    outputs: ['native.html'],
    inputs: ['index.html', 'scripts/native-page.mjs'],
    committed: true,
    generate: async root => (await import(pathToFileURL(`${root}/scripts/native-page.mjs`).href)).nativePageTable(root),
  },
];

/** The rows any of `paths` (repo-relative) touches: a changed input selects every row whose outputs it can change, and a
 *  changed output selects its own row (a hand edit is regenerated or refused).
 * @param {readonly string[]} paths @returns {SourceGenerator[]} */
export function selectSourceGenerators(paths) {
  if (paths.some(path => path === 'scripts/source-generators.mjs' || path === 'scripts/gen-source.mjs')) return [...SOURCE_GENERATORS];
  return SOURCE_GENERATORS.filter(row => paths.some(path => row.outputs.includes(path) || row.inputs.some(glob => matchesGlob(path, glob))));
}
