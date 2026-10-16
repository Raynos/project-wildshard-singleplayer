// oxlint-disable-next-line import/no-nodejs-modules -- Scaffolding owns only a fresh author directory.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve files beneath the new project root.
import { resolve } from 'node:path';
import { encodeCanonicalJson } from './immutable';

/** Write the runtime-free reference layout. An existing directory is never changed. */
export function writeNewProject(project: string, slug: string): void {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(slug) || existsSync(project)) throw new Error('new requires a fresh directory and kebab-case slug');
  for (const folder of ['generators', 'data', 'behaviour', 'assets']) mkdirSync(resolve(project, folder), { recursive: true });
  const identity = encodeCanonicalJson({ slug, name: slug, author: 'Local author', revision: 1, seed: 1 }).trim();
  writeFileSync(resolve(project, 'data/card.ts'), `/** Build-time identity; add authored level metadata here as the world grows. */\nexport const IDENTITY = ${identity};\n`);
  writeFileSync(resolve(project, 'data/world.ts'), `import { emptyShardfile } from '@wildshard/sdk/author';\nimport { IDENTITY } from './card';\n\n/** Build-only declaration; the CLI emits its platform sections as JSON. */\nexport const WORLD = emptyShardfile(IDENTITY);\n`);
  writeFileSync(resolve(project, 'shard.config.ts'), `import { WORLD } from './data/world';\nimport type { ProjectOutput } from '@wildshard/sdk/projectOutput';\n\n// oxlint-disable-next-line import/no-default-export -- The author CLI loads this build entry.\nexport default WORLD;\n\n/** Declare named blob inputs and emitted custom/platform sections here. */\nexport const output = {} satisfies ProjectOutput;\n`);
  writeFileSync(resolve(project, 'README.md'), `# ${slug}

Build with \`wildshard build <project> <output> --product-only\`, then
\`wildshard validate <output>\`. The output is a v2 index, schema-checked JSON
sections and hash-named blobs. In this repository use \`out/<slug>/\`.

- \`shard.config.ts\` is the build entry and its \`output\` export declares
  named blobs and emitted custom/platform sections.
- \`data/\` is build-time TypeScript: identity/card, layouts, quests, rows and
  schemas. It never ships as executable code.
- \`generators/\` produces immutable assets and section data at build time.
- \`behaviour/\` holds AssemblyScript sources; \`assets/\` holds source assets.

This project needs no custom runtime. Prefer the existing platform hosts and
rows. If a trusted runtime is necessary, put its client-only entry in
\`runtime/index.ts\`, its local constants in \`runtime/const.ts\` and custom
section schemas in \`runtime/sections.ts\`. It may import its own runtime TS
and public SDK/game/engine modules; never \`data/\`, generators, JSON or assets.
Read content through the admitted product's \`section()\` and \`asset()\` APIs.
The build copies runtime TS verbatim; do not import runtime code into the build.

After each content slice, build and validate. Keep decoded/GPU/wire costs
truthful, respect the reported graph/script budgets, and add playable content
before publishing. The empty declaration is a starting point, not a finished world.
`);
}
