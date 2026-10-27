// G798 / GS2: the app-wide generated source tables (the GS1 inventory in
// docs/plans/tooling-perf/generators-spike-mini-plan.md), one registry row each. A row names its outputs, the input
// globs that feed them and how they are made: `generate` returns every output's text from plain producers (no Vite
// plugin, no virtual module, no shard build, G799); `run` drives a producer that writes its own outputs and has its own
// --check. `pnpm gen:source` (scripts/gen-source.mjs) runs them; the pre-commit hook and CI select them by input.
import { matchesGlob } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

/** @typedef {{ readonly id: string; readonly outputs: readonly string[]; readonly inputs: readonly string[];
 *   readonly generate?: (root: string) => Promise<Readonly<Record<string, string>>>;
 *   readonly run?: (root: string, check: boolean) => void; readonly note?: string }} SourceGenerator */

const starter = (id, script, input, output, source) => ({
  id, outputs: [output], inputs: [input, script],
  generate: async root => ({ [output]: (await import(pathToFileURL(`${root}/${script}`).href))[source]() }),
});

/** @type {readonly SourceGenerator[]} */
export const SOURCE_GENERATORS = [
  starter('starter-arm-clips', 'scripts/gen-starter-arm-clips.mjs', 'src/game/systems/viewmodel/armAliases.json', 'src/game/systems/viewmodel/clips.generated.ts', 'starterArmClipsTableSource'),
  starter('starter-weapons', 'scripts/gen-starter-weapons.mjs', 'src/game/weapons/starterBow.json', 'src/game/weapons/starter.generated.ts', 'starterWeaponsTableSource'),
  starter('starter-bag', 'scripts/gen-starter-bag.mjs', 'src/game/bag/starterItems.json', 'src/game/bag/starter.generated.ts', 'starterBagTableSource'),
  starter('starter-effects', 'scripts/gen-starter-effects.mjs', 'src/game/systems/effects/starterRows.json', 'src/game/systems/effects/starter.generated.ts', 'starterEffectsTableSource'),
  {
    id: 'shards',
    outputs: ['src/shards.generated.ts', 'src/game/shard/slugs.generated.ts', 'src/game/shard/slugs.generated.json', 'src/game/shard/manifest-closure.generated.json'],
    inputs: ['src/shards/*/manifest.ts', 'src/shards/*/manifest.json', 'src/shards/*/shard.config.ts', 'src/game/grid/singleplayer.json', 'src/game/shard/slug.ts', 'scripts/gen-shards.mjs'],
    generate: async root => (await import(pathToFileURL(`${root}/scripts/gen-shards.mjs`).href)).shardTables(root),
  },
  {
    id: 'boot-tables',
    outputs: ['src/game/boot/bytes.generated.ts', 'src/game/boot/versions.generated.ts', 'src/game/boot/audio.generated.ts', 'src/game/shard/art.generated.ts'],
    inputs: ['public/assets/**', 'src/shards/*/manifest.ts', 'src/shards/*/manifest.json', 'src/shards/**/*.jpg', 'src/shards/**/*.jpeg', 'src/shards/**/*.png', 'src/shards/**/*.webp', 'vite/gen.ts', 'vite/assetHashes.ts'],
    // the boot writers read public/assets and the manifests from the working directory (the repo root)
    generate: async root => (await import(pathToFileURL(`${root}/vite/gen.ts`).href)).bootTableSources(),
  },
  {
    id: 'packs',
    outputs: ['src/game/boot/packs.generated.ts'],
    inputs: ['public/assets/**', 'src/game/boot/bytes.generated.ts', 'scripts/bake-packs.mjs'],
    note: 'content-addressed pack blobs under public/assets/packs come with it',
    run: (root, check) => { execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', 'scripts/bake-packs.mjs', ...(check ? ['--check'] : [])], { cwd: root, stdio: 'inherit' }); },
  },
  {
    id: 'ktx2',
    outputs: ['src/engine/boot/ktx2.generated.ts'],
    inputs: ['scripts/bake-ktx2.cache.json', 'scripts/bake-ktx2.list.json', 'scripts/ktx2-tables.mjs'],
    note: 'written by the encoder (scripts/bake-ktx2.mjs) beside the KTX2 files it maps; committed as is, never regenerated here',
  },
  {
    id: 'port-shares',
    outputs: ['src/game/shard/portShares.generated.ts'],
    inputs: ['scripts/source-generators.mjs'],
    note: 'no producer or consumer measures it yet: the reviewed map stays empty (absent = unavailable, never zero custom)',
    generate: () => Promise.resolve({ 'src/game/shard/portShares.generated.ts': '// Generated from verified out/<slug>/runtime; absent means unclosed/unavailable, never zero custom.\nexport const PORT_SHARES: Readonly<Record<string, number>> = {};\n' }),
  },
];

/** The rows any of `paths` (repo-relative) feeds: a staged input selects every row whose outputs it can change. */
export function selectSourceGenerators(paths) {
  return SOURCE_GENERATORS.filter(row => paths.some(path => row.inputs.some(glob => matchesGlob(path, glob))));
}
