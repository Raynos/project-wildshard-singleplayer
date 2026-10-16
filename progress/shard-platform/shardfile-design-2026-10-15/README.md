# The shardfile, designed: source and output (2026-10-15)

Jake's ask, 21:20 Cancun: the shard has two parts. The **source** is a folder people and agents edit: lots of
TypeScript, very little handwritten JSON, plus assets. The **output** is what a CLI builds from it. The output has a
strict, self-describing layout that can be validated. It holds no TypeScript except a temporary `runtime/` folder that
is the same as the source `runtime/`. The ruler measures the output, not the source. His clarifications, folded in
below: source `data/` may stay TypeScript (SDK types and schemas) as long as it only runs at build time and emits
JSON (21:30). The source `runtime/` is standalone. It imports only engine, game and SDK public modules and never
another file in the shard; whatever it needs comes from the output's JSON at load time or is duplicated into
`runtime/` (21:35).

This supersedes G445's "count `data/*.ts` in the source" with **measure the output** (§5). G446 (generators are
uncounted build tools) still holds, and now applies to `data/` too.

Numbers below come from clean HEAD on 2026-10-15 ~21:40: the ruler (`node scripts/shard-platform.mjs`) and an import
closure walk of each shard's play code (discovery, plugin, `runtime/**`, every static and dynamic import). Each data
module that play code reaches was also bundled and imported in Node to see whether its exports are plain JSON.

---

## 1. Current state

**What the output is today.** `wildshard build <project>` (`src/sdk/cli.ts` → `src/sdk/project.ts` →
`writeProduct` in `src/sdk/productOutput.ts`) writes a flat folder to `public/shardfiles/<slug>/` and caches it in
`~/.cache/wildshard/shardfiles/<slug>/<inputKey>/`:

- `shard.json`: one JSON document with ~47 top-level sections (identity, requires, budgets, files, tiles, terrain,
  edge, entryways, look, props, movers, quests, questHost, items, ledger, state, migrations, modes, sim, runtime …),
  parsed by `parseShardfile` (`@wildshard/format/shardSchema`, valibot). Sky 283 KB, Pine 351 KB, Signal 200 KB.
- Blobs named only by their SHA-256: GLB, KTX2, WTT1 terrain tiles, WebP, Wasm, binary. Sky has 29 files (11 MB),
  Signal 89 (4.8 MB), Pine 34 (19 MB), Driftwood 79 (28 MB), Nine 387 (173 MB), Nalati 5 (1 MB).
- `validation.json`: a receipt (validator revision, source hash, worst-case memory).

That output has no TypeScript in it, and it is a good base: content-addressed, validated, canonical JSON.

**What the source is.** `src/shards/<slug>/` holds `shard.config.ts`, `manifest.json`, `plugin.ts`, `roster.ts`,
`discovery.generated.ts`, `ktx2.generated.ts`, and the folders `data/`, `generators/`, `runtime/`, `behaviour/`,
`assets/`, plus legacy play folders (`world/`, `look/`, `models/`, `weapons/`, `quest/`, `combat/`, `species/`,
`loadout/`, `npc/`, `ride/`, `vm/` …).

**Where TypeScript leaks into what ships.** Every shard is a hybrid. Its play code is not part of the shardfile. It
ships as Vite code-split chunks inside the app bundle:

1. `scripts/gen-shards.mjs` writes `src/shards.generated.ts`, which statically imports every shard's
   `discovery.generated.ts`. That file value-imports `data/budgets.ts`, `data/layout.ts`, `data/boot.ts`,
   `data/cues.ts` … and lazily imports `plugin.ts`, `look/render.ts`, `roster.ts` and `ktx2.generated.ts`.
2. `plugin.ts` → `runtime/index.ts`, which imports `../data/*`, `../world/*`, `../weapons/*`, `../quests/*`.
   `runtime/source.ts` even imports `data/product.generated.json` (the shardfile's own JSON) into the JS bundle.
3. Runtime code fetches private assets by URL from `public/assets/<slug>/**`, outside the shardfile (Sky 73 files /
   13 MB, Pine 282 / 120 MB, Driftwood 110 / 61 MB).

The ruler counts the source folder, so the TS that ships is not what gets measured.

| Shard | Play-code closure (shard TS lines) | of which `data/*.ts` | of which other folders | Files in play code importing `data/` |
|---|---:|---:|---:|---:|
| Sky Reach | 2,479 | 1,855 | 624 (world 307, runtime 202, root 62, look 34 …) | 19 (52 imports) |
| Signal Dunes | 1,423 | 1,025 | 398 | 14 (26) |
| Pine Hollow | 17,779 | 5,632 | 12,147 (runtime 5,853, world 1,721, quest 1,212 …) | 92 (189) |
| Driftwood Isle | 13,817 | 4,872 | 8,945 (runtime 3,013, world 1,678, models 1,201 …) | 113 (219) |
| Nalati | 28,260 | 883 | 27,377 (runtime 8,032, world 5,703 …) | 50 (86) |
| Nine Dragon | 15,414 | 922 | 14,492 (runtime 10,210 …) | 50 (72) |

**Most of that `data/` TS is JSON already.** Each reached data module was bundled and imported in Node:

| Shard | Reached `data/*.ts` | Exports are plain JSON | Exports hold functions or class instances |
|---|---:|---:|---:|
| Sky | 1,855 | 1,520 | 335 (7 look-graph builders: meadowLook, sunGlowLook, cloudSeaLook …) |
| Signal | 1,025 | 990 | 35 (`fire.ts`) |
| Pine | 5,632 | 5,115 (+388 that did not resolve a generated JSON; JSON by inspection) | 129 (`cabinLook`, `keyedSkyRows`) |
| Driftwood | 4,872 | 4,747 | 125 (`groundLook`, `coverLook`) |
| Nalati | 883 | 883 | 0 |
| Nine | 922 | 922 | 0 |

So the leak is mostly an **import boundary** problem, not a format problem. The build can evaluate those modules
and write their values as output JSON. The runtime then reads the JSON from the output instead of importing the TS.

**What the engine loads at startup, and how.** Nothing is discovered at run time. The shard list is compiled in:
`src/shardList.ts` installs `SHARDS` from the generated TS list, each manifest built by `defineAuthoredShard(data,
slug, rows, native)` from `manifest.json` and value imports of `data/*.ts`. When a shard is entered, the trusted
plugin chunk loads (`firstPartyStandaloneEntry`), and `src/game/shardfile/runtimeProduct.ts` fetches
`/shardfiles/<slug>/shard.json` (`readDescriptor` → `parseShardfile`), then fetches blobs on demand by hash through
`ClientAssets`. `shard.json` `runtime.binds` lists the sections the trusted runtime owns
(`src/format/runtimeBinds.ts`), so the data client skips them. The Template is the one shard with no runtime: it
boots purely from its shardfile, which shows the data-only path works.

---

## 2. The OUTPUT spec (what the engine and a future server load)

### 2.1 Where it goes: `out/<slug>/` at the repo root

`out/` is gitignored and sits outside `src/`. Reasons:

- `dist/` is already Vite's app output (`.gitignore` line 2). Two meanings for one name invites accidents.
- Inside the shard folder (`src/shards/<slug>/out/`), the copied `runtime/*.ts` would be seen twice by `tsc`, oxlint,
  the layer guards and the layout check.
- `public/shardfiles/` mixes the product with Vite's static copy step.

The app build copies `out/*/` (minus `runtime/`) into `dist/shardfiles/`. The content-addressed cache stays in
`~/.cache/wildshard/shardfiles/<slug>/<key>/`, and `out/<slug>` is filled from it (§4).

### 2.2 Layout

```
out/
  catalog.json                    every built shard: slug, index path + hash, title card, grid placement
  <slug>/
    shard.json                    THE INDEX (format, identity, admission, sections[], files[], runtime)
    sections/                     one canonical JSON file per section, schema-checked
      world/   terrain.json tiles.json edge.json collision.json navigation.json props.json
               water.json movers.json traversal.json spawn.json days.json weather.json
      look/    look.json materials.json library.json map.json
      actors/  creatures.json species.json crowds.json npcs.json spawns.json
      combat/  items.json encounters.json strikes.json
      quests/  quests.json host.json directors.json
      economy/ ledger.json loot.json
      state/   state.json migrations.json modes.json
      sim/     sim.json hooks.json client-scripts.json client-channels.json plumbing.json
      audio/   audio.json
      ui/      card.json strings.json ui.json compendium.json
      custom/  <name>.json         shard-private tables the runtime reads (transitional, see 2.5)
    schemas/
      custom/<name>.schema.json    JSON Schema for each custom section (platform schemas live in @wildshard/format)
    blobs/
      glb/<sha256>.glb   ktx2/<sha256>.ktx2   tile/<sha256>.wtt   image/<sha256>.webp|.jpg
      audio/<sha256>.mp3|.ogg   wasm/<sha256>.wasm   bin/<sha256>.bin (navmesh, collider, field bytes)
    runtime/                      TRANSITIONAL: verbatim copy of src/shards/<slug>/runtime/ (2.6)
    validation.json               the validator's receipt (not hashed into the index)
```

**One file per section.** It keeps each file small and diffable. A server can skip client-only sections, a schema
maps to exactly one file, and a section can be lazy-loaded. Sections shown above with no data are simply not written.
The index lists only sections that exist.

How today's `shard.json` keys map onto the layout: identity, version, requires → index; budgets, serverBudget,
authorCaps, critical, library → index `admission` (admission needs them before any download); files → index
`files`; tiles, far → `world/tiles`; terrain, nativeGround → `world/terrain`; edge, entryways → `world/edge`;
meshCollision → `world/collision`; rows.species / strikes / loot / days / weather / looks / compendiums → their
named files; runtime.spawns → `actors/spawns`; runtime.binds → index `runtime.binds`; accent → `ui/card`; the
title-card fields of `manifest.json` (name, blurb, biome, label, order, spawn, bounds, pois, thumbs) →
`ui/card.json` with thumbs as blobs. Every other key maps one-to-one to the file of the same name.

### 2.3 The index: `shard.json` (format 2)

The index keeps the file name `shard.json`. Every tool, doc and admission limit already points there, and the
`format` field says it is the index, not the old monolith.

```jsonc
{
  "format": "wildshard.shardfile", "formatVersion": 2,          // major: the engine refuses an unknown major
  "sdk": "0.2",                                                   // the authoring SDK that built it
  "identity": { "slug": "far-reach", "name": "Sky Reach", "author": "Wildshard", "revision": 1, "seed": 6417 },
  "build": { "sourceHash": "…", "validator": "…" },              // deterministic: no timestamps
  "requires": { "capabilities": [], "commons": [] },
  "admission": { "budgets": {…}, "serverBudget": {…}, "authorCaps": {…}, "critical": ["…"], "library": ["…"] },
  "sections": [
    { "name": "quests/quests", "path": "sections/quests/quests.json", "schema": "wildshard:quests@1",
      "hash": "sha256…", "bytes": 2047, "audience": "both", "load": "boot" },
    { "name": "look/look", "path": "sections/look/look.json", "schema": "wildshard:look@1",
      "hash": "…", "bytes": 168099, "audience": "client", "load": "enter" },
    { "name": "custom/windLook", "path": "sections/custom/windLook.json",
      "schema": "schemas/custom/windLook.schema.json", "hash": "…", "bytes": 912, "audience": "client", "load": "enter" }
  ],
  "files": [
    { "path": "blobs/glb/1b13….glb", "kind": "glb", "hash": "1b13…", "name": "models/roc.glb",
      "compressed": 111816, "decoded": 111788, "gpu": 110640, "triangles": 4460, "draws": 1,
      "critical": false, "dependencies": [] }
  ],
  "runtime": null | { "trust": "first-party", "entry": "runtime/index.ts", "binds": ["quests", "items"],
                      "files": [{ "path": "runtime/index.ts", "hash": "…", "lines": 61 }], "lines": 284 }
}
```

- **Self-describing.** Every file in the folder is listed exactly once, with its kind, hash and size (sections in
  `sections`, blobs in `files`, runtime files in `runtime.files`). An unlisted file is invalid.
- **`audience`** (`sim` | `client` | `both`): a headless server loads `sim` + `both` and ignores `client` (looks,
  audio, ui) and `runtime`. That makes "a future server loads it unchanged" a field, not a promise.
- **`load`** (`boot` | `enter` | `stream`): `boot` sections come with admission, `enter` ones when the shard is
  entered, `stream` ones (tiles and their blobs) as the player moves.
- **`name` on a blob** is an optional stable logical name. The runtime asks for `models/roc.glb`, and the index maps
  it to a hash. This replaces URL fetches into `public/assets/<slug>/` and the `ktx2.generated.ts` tables.

### 2.4 Allowed file kinds

| Kind | Extension(s) | Checked by |
|---|---|---|
| JSON (sections, schemas, index) | `.json` | strict UTF-8 parse, canonical encoding, its schema |
| glTF binary | `.glb` | `glTF` magic, version 2, the existing GLB admission (triangles, draws, textures) |
| KTX2 texture | `.ktx2` | KTX2 identifier, the existing transcode checks |
| Terrain tile | `.wtt` | `WTT1` magic, `terrainTileBytes` |
| Image | `.webp`, `.jpg`, `.png` | magic bytes and dimension caps |
| Audio | `.mp3`, `.ogg` | magic bytes and duration caps |
| Binary data | `.bin` | declared reader (navmesh, collider, field) and its byte schema |
| WebAssembly | `.wasm` | `\0asm` magic, the script ABI and limits (`scriptAdmission`) |
| Runtime (transitional) | `runtime/**/*.ts` | §2.6 only; first-party only |

Nothing else is allowed: no JS, HTML, CSS, shaders as text, `.blend`, archives or source maps. Wasm compiled from
AssemblyScript is the one executable kind, and it runs in the script host's sandbox. Raw GLSL is not a data kind
(G306). Looks ship as SF59 graph JSON in `look/materials.json`.

### 2.5 Sections: platform and custom

- **Platform sections** have a schema in `@wildshard/format` (valibot, with JSON Schema generated by `pnpm gen`;
  `wildshard schema` already prints them). The engine and game have a host for each one.
- **Custom sections** (`sections/custom/<name>.json`) are the shard-private tables its `runtime/` reads, e.g. Sky's
  wind look, Roc fight or crown layout. Source `data/` declares them with a valibot schema
  (`defineSection(name, schema, value)` in the authoring SDK). The build writes the value and the schema's JSON Schema
  side by side, and the validator checks one against the other. They are data, so they don't count as custom code.
  The ruler prints each shard's custom-section bytes as a report-only column, so they shrink toward platform
  sections the same way `runtime/` shrinks. A custom section can't be a back door for code: it is JSON with a schema,
  and any interpreter for it would live in `runtime/`, where it counts.

### 2.6 The temporary `runtime/` folder in the output

- **What:** a byte-for-byte copy of the source `src/shards/<slug>/runtime/`, and nothing else. The source `runtime/`
  is standalone (§3.2), so the copy is complete by construction. There is no closure walk that could pull in
  other shard files.
- **Form: TypeScript source, copied verbatim** (recommended, Q2). The ruler counts exactly those lines. The app build
  compiles `out/*/runtime/index.ts` (a generated `import.meta.glob` registry keyed by slug) and never imports the
  source `runtime/`, so what ships is what was measured. Bundled JS (one ESM file per shard, game modules as externals
  through an import map) is the later step that lets the engine `import()` a runtime by URL. It needs a public
  module contract for `@wildshard/game`, so it waits for SHARD-PLATFORM-NEXT.
- **How it is closed:** (1) the lint rule `wildshard/runtime-standalone` (§3.3) refuses any import from source
  `runtime/` that leaves `runtime/`, other than allowed package specifiers. (2) The build re-checks the same thing on
  the copy: every import in `out/<slug>/runtime/` must resolve inside `out/<slug>/runtime/` or to an allowed package,
  with no JSON, asset or `?raw` / `?url` imports. Data comes through the loader. (3) The validator checks
  `runtime.files` hashes against the copy and refuses a runtime in a non-first-party load (unchanged rule, C3-R1-C11).
- **How the runtime gets data:** the loader hands the plugin its admitted product. Platform sections arrive already
  parsed by their format schema. A custom section is read with
  `product.section('custom/windLook', WindLookSchema)`, where the schema is declared inside `runtime/` (counted, a
  few lines). Small magic numbers may simply be duplicated into `runtime/const.ts` (Jake, 21:35). Blobs are read with
  `product.file('models/roc.glb')`. `runtime/source.ts` (which imports the product JSON) is deleted.

### 2.7 Versioning

- `formatVersion` is an integer major. The engine declares the majors it reads (2 at first). The v1 monolith is read
  through an adapter only until every shard is rebuilt, which happens in the same commit set since outputs are
  generated (row P1).
- Each platform schema id carries its own major (`wildshard:quests@1`). Additive optional fields keep the major. A
  breaking change bumps it, and the engine keeps the previous reader until no output uses it.
- `identity.revision` is the content revision of the shard. `state/state.json` plus `state/migrations.json` carry
  save compatibility (unchanged semantics).
- Output bytes are deterministic: canonical JSON, sorted index lists, no timestamps. The same inputs give the same
  index hash.

### 2.8 Validation: one command, one meaning

`wildshard validate out/<slug>` (the same code the build runs last) passes only when all of these hold:

1. `shard.json` parses against the index schema, and `formatVersion` is supported.
2. Every listed file exists with its hash and byte size. No unlisted file exists (only `validation.json` is exempt).
3. Every file's bytes match its declared kind (magic, structure, caps; §2.4).
4. Every section parses against its schema (platform from `@wildshard/format`, custom from `schemas/custom/`).
5. Cross-references resolve: every hash a section names is a listed file or a declared commons hash, and every
   quest, item, ledger, spawn and encounter id refers to an id that exists. These are today's `validateProject`
   checks, run per section.
6. Platform rules: budgets and the 1.0 / 1.2 GB admission math, the four entryways and edge profile (grid-ready),
   tile coverage, the script ABI and limits, the content gate (G304: no private binaries).
7. `runtime/`, if present: first-party, hashes match, the import closure is closed (§2.6), and `runtime.binds` names
   only sections that exist.

"Valid" means all seven pass. `validation.json` records the validator revision, the index hash and the
worst-case memory. The app build refuses an output whose receipt is missing or stale (today's
`__SHARDFILE_VERDICTS__` check, pointed at `out/`).

### 2.9 How the engine discovers and loads a shard at startup

1. **Discover.** The app reads `catalog.json` (precached by the service worker for offline play). Each entry holds
   slug, index path and hash, title card fields and thumb blob paths, accent, and grid placement. Placement is game
   configuration from one repo-level grid file, not part of a shard. This replaces `manifest.json` →
   `discovery.generated.ts` → `src/shards.generated.ts`. The six frozen `-legacy` folders keep their old manifest
   path until they are deleted.
2. **Admit.** On SHARD SELECT, or when a grid cell comes into range, the loader fetches `<base>/shard.json`,
   checks it against the catalog hash, parses it, checks `admission` against the memory gate, then fetches the `boot`
   sections in parallel and verifies each hash.
3. **Enter.** It fetches the `enter` sections, assembles today's in-memory `Shardfile` object from them (so every
   current host keeps working unchanged), and starts the platform hosts.
4. **Runtime.** If `runtime` is present, and the load is first-party and the build has a registry entry for the slug,
   it lazy-imports that chunk and passes it the product (`RuntimeProduct` with `section()` and `file()`). Hosts skip
   `runtime.binds`. Otherwise the shard runs purely on platform hosts, the way the Template already does.
5. **Stream.** Tiles and their blobs stream through `ClientAssets` as today. Only the URL builder changes, to
   `blobs/<kind>/<hash>.<ext>`.

---

## 3. The SOURCE spec (what people and agents edit)

### 3.1 Layout

```
src/shards/<slug>/
  shard.config.ts     the build entry: identity and which data modules and generators make which sections
  README.md           what the shard declares, its runtime and why, open rows
  data/               BUILD-TIME. TypeScript using the authoring SDK: rows, layouts, quests, schemas
                      (defineSection), small handwritten JSON. Evaluated at build -> sections/*.json
  generators/         BUILD-TIME. Any JS/TS, Blender / Python scripts, AI-mesh steps -> blobs + section rows
  behaviour/          BUILD-TIME. AssemblyScript .as (+ its .json rows) -> blobs/wasm
  assets/             BUILD-TIME inputs: hand-made / Blender / CC0 GLBs, images, audio, thumbs (storage policy)
  blender/            BUILD-TIME. Blender build scripts (the GLB is committed, the .blend never is)
  runtime/            SHIPS (transitional). Standalone trusted TypeScript: index.ts (the plugin entry),
                      const.ts (duplicated magic numbers), sections.ts (schemas for the custom sections it reads)
  test/               optional tests (never shipped, never measured)
```

One rule to remember: **everything outside `runtime/` is build-time only.** The legacy play folders (`world/`,
`look/`, `models/`, `weapons/`, `quest/`, `combat/`, `species/`, `creatures/`, `npc/`, `loadout/`, `ride/`, `vm/`,
`grapple/`, `life/`, `compendium/`, `boot/`, `debug/`, `dev/`, `playground/`, `explore/`) go away. Each file either
moves into `runtime/`, where it counts, or becomes `data/` / `generators/` code that emits sections. The root files go
too: `plugin.ts` → `runtime/index.ts`; `manifest.json` → `data/card.ts` (→ `ui/card.json`); `roster.ts` → a
`debug/roster` section that the Model Explorer reads; `layout.ts`, `strings.ts`, `budgets.ts` → `data/`;
`discovery.generated.ts` and `ktx2.generated.ts` are deleted (the catalog and index replace them).

### 3.2 The rules

1. **`runtime/` is standalone** (Jake, 21:35). Its files import only other files in its own `runtime/` folder,
   `@wildshard/game` plugin modules listed in that package's `exports` (G307), the public engine modules those
   plugin interfaces hand it, and `three`. It never imports, even type-only, any other file in the shard
   folder, another shard, `@wildshard/commons` (G143), JSON or asset files.
2. **Nothing the game runs imports build-time code.** No file in `src/engine`, `src/game`, `src/sdk/runtime`, the
   composition root, another shard, or a shard's `runtime/` may import a shard's `data/`, `generators/`,
   `behaviour/`, `assets/` or `shard.config.ts`. Only the build (the SDK CLI and `scripts/`) reads them.
3. **Build-time code doesn't import `runtime/`.** Bakes that run runtime code in Node are G297 bridges with an exit
   row each. They are listed and ratcheted, not open-ended.
4. **`data/` and `generators/` import the authoring SDK, format and commons only** (G307, unchanged).
5. **The output is the only bridge.** Whatever `runtime/` needs from build-time code reaches it as a section or a
   blob in the output, or is duplicated into `runtime/`.

### 3.3 The lint rules (in `lint/wildshard-plugin.js`, beside `shard-sandbox`)

- **`wildshard/runtime-standalone`**: in `src/shards/<slug>/runtime/**`, every `import`, `import type`, `export …
  from`, dynamic `import()`, `import.meta.glob` and `new URL(…, import.meta.url)` must resolve inside that same
  `runtime/` folder or be an allowed package specifier. JSON and asset imports are refused.
- **`wildshard/no-build-time-import`**: no module outside a shard's build-time set may resolve into
  `src/shards/<slug>/(data|generators|behaviour|assets|blender)/` or `shard.config.ts`. Combined with the rule
  above, this also closes legacy play folders once they are emptied.
- Both start as **ratchets** in `lint/ratchet.json` (today's violation count per shard, shrink-only, G349), and become
  hard errors per shard as each shard's migration row lands. `shard-sandbox`'s existing "game imports only from
  `runtime/`" check stays.
- `lint/shard-layout.json` loses the legacy play folders when the last shard empties them. During migration they are
  allowed only in shards that still have them (shrink-only).

### 3.4 The template changes

`src/shards/_template/` becomes the reference source layout. It keeps `shard.config.ts`, `data/` (TS through the SDK,
which it already is: 693 lines, none reached by play code), `generators/`, `behaviour/`, `assets/` and `README.md`. The
empty play folders (`boot/ combat/ explore/ look/ models/ playground/ quest/ species/ weapons/ world/`) and
`discovery.generated.ts` are removed. `manifest.json` becomes `data/card.ts`. The template ships no `runtime/`, which
is the point: a shard can be pure output. `wildshard new` writes this layout, and SHARDS.md §2 is regenerated from
the new `lint/shard-layout.json`.

---

## 4. The build CLI: `wildshard build <slug>`

One command per shard, plus `--all`. It is the existing `wildshard build` with a slug resolver and the new writer.
`pnpm shard:build <slug>` is a thin alias.

| Step | What it does | Notes |
|---|---|---|
| 0. key | hash the shard folder + SDK / format / commons revisions + flags | `scripts/shardfile-cache.mjs` today; on a hit, fill `out/<slug>` from `~/.cache/wildshard/shardfiles/<slug>/<key>/` and stop |
| 1. generate | run `generators/` (shared generation-job cache), evaluate `data/` modules in Node | data and generators never boot the game (G320) |
| 2. bake | SDK bake: tiles + LODs, colliders, far proxy, navmesh, KTX2, map; AssemblyScript → wasm | today's `sdk/bake`, `buildBehaviourProject` |
| 3. emit sections | validate each value against its schema, write canonical JSON to `sections/`, custom schemas to `schemas/` | the monolith split, same values |
| 4. emit blobs | write each blob to `blobs/<kind>/<hash>.<ext>`, record logical names | private `public/assets/<slug>` files move here |
| 5. runtime | check that `runtime/` is closed, copy it verbatim, record hashes and lines | refuses on any escape |
| 6. index | write `shard.json` and update `out/catalog.json` | deterministic |
| 7. validate | `wildshard validate out/<slug>` (§2.8), write `validation.json` | refuses on any failure |

Then it publishes the folder to the content-addressed cache.

- **The app build:** `scripts/build-shardfiles.mjs` calls `wildshard build --all` into `out/`. Vite copies
  `out/*/` minus `runtime/` into `dist/shardfiles/` and compiles `out/*/runtime/index.ts` through the generated
  registry.
- **Pre-commit (≤ 10 s, G370):** only the lint rules and a cheap closed-runtime check. It does no bake.
- **The push gate:** runs the full build in the build mirror as today, then the ruler on that `out/`.

---

## 5. The ruler on the output

**Rule:** custom % = (code lines in `out/<slug>/runtime/**/*.ts` + G294 one-user platform code) ÷ the shard's frozen
`<slug>-legacy/` TypeScript lines (unchanged denominator, G291). Code lines use the same unit as today (`codeLines`:
nonblank, comments removed). Because `runtime/` is standalone, these lines equal the source `runtime/` lines. The ruler
still reads them from the built output: `scripts/shard-platform.mjs` runs `wildshard build --all` (cache hits make
that fast when nothing changed) and then measures `out/`.

- **G294 on the output:** the roots of the per-export reach analysis become the output `runtime/` files plus the
  platform hosts of section kinds that only this shard's output contains. Engine, game and SDK runtime code used by
  one shard still counts for that shard, and G441 pending credit is unchanged.
- **Build-time SDK code** that only one shard's `data/` or `generators/` reaches doesn't ship, so it leaves the
  numerator (consistent with G446). It is printed as a report-only "one-user build tools" column (Q4).
- `data/` and `generators/` no longer appear in the measure at all. `RULES.runtimeExcludedFolders` and the G445
  `data/*.ts` clause go. What counts is whatever ships as code.
- **Report-only columns:** custom-section bytes, AssemblyScript lines (G315), private binaries (G304).

**Expected numbers** (from the closures above; G294 today: Sky 51, Signal 26, Pine 1,630, Driftwood 413, Nalati
1,750, Nine 817):

| Shard | Ruler today (G445, source) | Output ruler, built honestly today (no code moved) | After the rewire (JSON data → sections, play folders → `runtime/`) | After look graphs ship as graph JSON |
|---|---:|---:|---:|---:|
| Sky Reach | 92.1 % | 37 % (2,530) | ~15–17 % (~1,000–1,150 incl. ~100–200 lines of runtime-side schemas) | **~10–12 %** |
| Signal Dunes | 43.5 % | 35 % (1,449) | **~12–13 %** (~500–550) | ~11–12 % |
| Pine Hollow | 90.4 % | 91 % (19,409) | ~66–68 % | ~66 % |
| Driftwood | 82.7 % | 83 % (14,230) | ~57–58 % | ~57 % |
| Nalati | 105.9 % | 106 % (30,010) | ~102 % | ~102 % |
| Nine Dragon | 77.0 % | 77 % (16,231) | ~72 % | ~72 % |

How the rewire column was worked out: closure − JSON-evaluable data − deleted generated roots (`discovery.generated`,
`ktx2.generated`, data-only manifests) + an allowance for the schemas each runtime declares for the custom sections it
reads. Pine and Driftwood land near their pre-G445 readings (67 % and 59 % at 19:10), because most of their TS data was
already plain tables. Sky and Signal don't drop to 10 % from the rewire alone. Sky's last ~5 points are its 335 lines
of look-graph builders plus `world/` (307 lines). Signal's are `world/` (177) and `plugin.ts` (75). Those are W1's
remaining real work.

---

## 6. Migration plan

Rows in order. Codex = mechanical, non-graphical. Opus = judgment or anything that changes how the game looks (G407).

| # | Row | Size | Who |
|---|---|---|---|
| **P0** | Lint rules `runtime-standalone` and `no-build-time-import` as ratchets with today's counts in `lint/ratchet.json` | S | Codex |
| **P1** | Output v2 writer: `out/<slug>/` with index `shard.json`, `sections/`, `blobs/<kind>/`; loader adapter assembles today's `Shardfile` from sections (v1 monolith still read until every output is rebuilt); blob URL builder; validator §2.8 steps 1–4; all shards rebuilt in the same commit set | M | Codex |
| **P2** | Custom sections and named blobs: `defineSection` in the authoring SDK, `schemas/custom/`, `product.section(name, schema)` and `product.file(name)` on `RuntimeProduct`; the loader passes the product into the plugin (no more `runtime/source.ts`) | M | Codex (Opus reviews the API) |
| **P3** | Runtime copy + registry + catalog: build step 5, `import.meta.glob` registry over `out/*/runtime/index.ts`, `out/catalog.json` replacing `discovery.generated.ts` / `shards.generated.ts` for the six ported shards and the Template; the title menu reads the catalog | M | Codex |
| **P4** | Ruler on the output: `shard-platform.mjs` builds, then measures `out/*/runtime`; G294 roots from the output; drop `runtimeExcludedFolders` and the G445 clause; new report columns; G390 port % re-baselined | S | Codex |
| **S1** | Sky: rewire 19 play files (52 imports) from `data/*.ts` to sections or `runtime/const.ts`; move `world/`, `look/`, `models/`, `weapons/`, `quests/` play files and `plugin.ts` into `runtime/`; flip Sky's lint rules to errors | M | Codex |
| **S2** | Signal: same (14 files, 26 imports); `plugin.ts` (75 lines) into `runtime/` | S | Codex |
| **S3** | Sky and Signal private assets (`public/assets/far-reach`, `sunscar-dunes`: 120 files, 20 MB) into blobs, read by logical name | S | Codex |
| **S4** | Sky look-graph builders (7 modules, 335 lines) and Signal `fire.ts` serialize as SF59 graph JSON at build; before / after board | M | Opus |
| **S5** | Sky `world/` (307) and Signal `world/` (177) onto platform hosts or build-time sections, where possible, toward 90/10 | M | Opus + Codex |
| **T1** | Template: new source layout, `data/card.ts`, `wildshard new` writes it, SHARDS.md §2 regenerated | S | Codex |
| **W2a** | Pine: rewire 92 files (189 imports) from `data/`; move `world/ quest/ combat/ models/ loadout/ weapons/ species/ boot/ dev/ debug/ compendium/ life/` play code into `runtime/` (counted); private assets (282 files / 120 MB) into blobs; lint to errors | L (2 lanes split by folder) | Codex |
| **W2b** | Driftwood: same (113 files, 219 imports; 110 assets / 61 MB) | L (2 lanes) | Codex |
| **W2c** | Pine `cabinLook`, `keyedSkyRows`; Driftwood `groundLook`, `coverLook` → graph JSON; boards | M | Opus |
| **W3a** | Nalati: play folders into `runtime/` (most code is already play code; data is small) | L | Codex |
| **W3b** | Nine Dragon: same | L | Codex |
| **Z1** | Delete the v1 monolith reader, `gen-shards` discovery for ported shards, `runtime/source.ts` patterns and the legacy play folders from `lint/shard-layout.json`; ratchets become hard errors everywhere | S | Codex |

Notes:
- **No row hand-converts `data/` to JSON** (Jake, 21:30). `data/` stays TypeScript, and the build emits the JSON.
- **Moving play folders into `runtime/` is honest, not a regression.** It doesn't change the output-ruler number,
  because that code ships either way. It makes the source and the measure agree, and later conversions shrink one
  folder.
- **Engine loader changes (all in P1–P3):** `readDescriptor` reads the index and fetches sections; `ClientAssets` uses
  the new blob URLs; `RuntimeProduct` gains `section()` / `file()`; plugins receive the product instead of importing
  it; the shard list comes from `catalog.json`. The in-memory `Shardfile` type and every host stay as they are.
- P0–P4 can run on Codex lanes now beside W2's noon close (G443). They touch the SDK, format, loader and scripts,
  not Pine or Driftwood play code. S1–S5 follow at once (W1 reopened, G446).

---

## 7. Questions for Jake

Option 1 is always "Skip for now".

1. **Where the built shard goes.** (1) Skip · (2) **`out/<slug>/` at the repo root, gitignored** (recommended:
   `dist/` is already Vite's, and inside `src/` the copied runtime would be type-checked and linted twice) ·
   (3) `src/shards/<slug>/dist/` · (4) keep `public/shardfiles/<slug>/`.
2. **Form of the temporary output `runtime/`.** (1) Skip · (2) **the TypeScript copied verbatim, compiled by the app
   build from `out/`** (recommended: the ruler counts exactly what ships, and it works now) · (3) one bundled JS file
   per shard that the engine `import()`s by URL (truly dynamic, but needs a public game-module contract first:
   SHARD-PLATFORM-NEXT).
3. **Blob file names.** (1) Skip · (2) **hash names grouped by kind (`blobs/glb/<hash>.glb`) plus readable logical
   names in the index** (recommended: dedupe, caching and commons keep working) · (3) readable paths on disk
   (`models/roc.glb`) · (4) flat hash names as today.
4. **One-user SDK code that only a shard's build reaches** (bakers that never ship). (1) Skip · (2) **don't count it;
   print it as a report column** (recommended: it doesn't ship, same as G446 generators) · (3) keep counting it under
   G294.
5. **Pine and Driftwood play folders.** (1) Skip · (2) **move them into `runtime/` wholesale now (counted), and shrink
   them in W3** (recommended: mechanical, makes source equal what's measured) · (3) convert each to sections before
   moving.
6. **When the platform rows run.** (1) Skip · (2) **P0–P4 tonight on Codex lanes beside W2, then Sky / Signal S1–S5**
   (recommended) · (3) after W2 closes at noon · (4) after W3.
