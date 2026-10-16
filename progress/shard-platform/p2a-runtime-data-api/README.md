# P2a: the runtime data API (2026-10-16, sp-o258)

Row P2a of the shardfile design (`progress/shard-platform/shardfile-design-2026-10-15/README.md` §2.6, §2.9, §6) with
Jake's picks G450. Today a shard's play code imports source `data/*.ts` and `*.generated.json`. After this row its
standalone `runtime/` (G449) reads the **built output** instead, through one object the loader hands it: the
**product**. The build validates every value (G445 / G448); the runtime trusts it and runs no schema on a shipped page.
That trust is what removes the class of hitch in STATE.md (Pine's plugin import ran `parseShardfile` on every graph
table synchronously: a 99.6 ms road hitch).

The typed skeleton is in the tree with this spec: `src/format/sections.ts`, `src/game/shardfile/shardProduct.ts`,
`ShardContext.product` (`src/game/plugin/context.ts`), `src/sdk/runtimeMirrors.ts` and their tests. Codex lanes build the rest
from §6.

---

## 1. The surface

Module `@wildshard/game/shardfile/shardProduct` (runtime/ may import it: it is a public game module).

```ts
interface ShardProduct {
  readonly slug: string;
  readonly revision: number;
  readonly shardfile: Shardfile;                       // assembled by the loader; hand it to hosts (§3.3)
  readonly has: (name: SectionName) => boolean;
  readonly section: SectionReader;
  readonly strings: <const K extends string>(keys: readonly K[]) => Readonly<Record<K, string>>;
  readonly hasFile: (name: string) => boolean;
  readonly file: (name: string) => Promise<Uint8Array>;
  readonly url: (name: string) => string;
}
interface SectionReader {
  <K extends PlatformSectionName>(name: K): PlatformSections[K];                       // platform: typed by format
  <R extends CustomSectionSchemas, K extends keyof R & CustomSectionName>(name: K, schemas: R): v.InferOutput<R[K]>;
}
type CustomSectionSchemas = Readonly<Record<`custom/${string}`, v.GenericSchema>>;
class ProductError extends Error { readonly slug; readonly item; readonly reason: ProductRefusal }
type ProductRefusal = 'absent' | 'missing-section' | 'stream-section' | 'missing-strings' | 'missing-file' | 'schema';
function createShardProduct(input: ShardProductInput): ShardProduct;                  // the loader's constructor
function absentShardProduct(slug: string): ShardProduct;                             // no built output
```

| Call | Sync? | Returns | Refuses (throws `ProductError`) |
|---|---|---|---|
| `section('quests/quests')` | sync | the section file's value, typed by `PlatformSections` | `missing-section` if the index doesn't list it; `stream-section` if the loader left it to its host |
| `section('custom/trades', SECTIONS)` | sync | the value, typed by `SECTIONS['custom/trades']` | as above; `schema` only in a checked product (§2.2) |
| `strings(['raised', 'vaneTurned'])` | sync | a frozen `{ raised: string; vaneTurned: string }` | `missing-strings`, naming **every** missing key in one error |
| `has(name)` / `hasFile(name)` | sync | boolean | never |
| `file('behaviour/director.wasm')` | **async** | verified bytes | rejects `missing-file` for an unknown name; the reader rejects on a hash mismatch |
| `url('models/roc.glb')` | sync | the content-addressed blob URL (`<base>blobs/glb/<hash>.glb`) | `missing-file` |
| `shardfile` | sync | today's in-memory `Shardfile` | `absent` on an absent product |

Rules:

- **Why sections are sync.** The loader fetches, hash-checks and `JSON.parse`s every section it loads (today
  `resolveOutputDescriptor` loads them all) **before** the plugin's first hook. `section()` is a map lookup. No section
  read ever awaits, so `rows`, `build`, `install` and constructors-in-hooks stay as they are.
- **Why files are async.** Blobs stay content-addressed in `blobs/<kind>/<hash>.<ext>` and stream on demand
  through the shard's existing verified reader (`ClientAssets.read`: hash check, product cache, offline copy, leases).
  The product holds no bytes itself. `url()` exists for loaders that only take a URL (`GLTFLoader.load`, `<audio>`);
  new code prefers `file()`, which also gets the hash check.
- **Caching.** One product per admitted shard per page, keyed by the index hash, shared by the data client, the
  hybrid runtime and the grid cell; it lives as long as the longest scope that leased it (the same lease rule as
  `provideRuntimeProduct`). Section values are decoded once and shared by reference.
- **Never mutate a section value.** Types stay the plain schema output types (not deep-readonly) so they pass straight
  into existing hosts. A checked product deep-freezes values, so a mutation fails loudly in tests.
- **Refusals are wiring or build bugs.** Nothing catches a `ProductError`: it fails the shard's load with the slug, the
  item and the fix. Call `section()` / `strings()` in `prepare`/`build`/`install` (load time), not in a frame loop.
- **Absent product.** An entry with no built output (a frozen `-legacy` folder, a test page) gets
  `absentShardProduct(slug)`: `has` is false and every read refuses `absent` with "run `wildshard build <slug>`".

## 2. Schemas: validated at build, trusted at runtime

### 2.1 Platform sections

`@wildshard/format/sections` declares `PlatformSections`: every platform section name (`world/edge`, `quests/quests`
…) and the type of its file. It mirrors the P1 writer's table (`OUTPUT_SECTIONS` in sp-x5's
`src/format/outputIndex.ts`): a section that slices today's `Shardfile` is a **root-key envelope**
(`section('quests/quests').quests`, `section('combat/strikes').rows.strikes`), so optional fields keep their absence
and the loader can reassemble the unchanged `Shardfile`. A section added after format 2 is a **plain value** and is
**not** added to `Shardfile` (v1 is going away): the runtime reads it and passes it to its host as an argument. The
new ones P2b lands first:

| Section | Value | Schema (in `@wildshard/format`) | Replaces |
|---|---|---|---|
| `ui/strings` | `Record<string, string>`, ≤ 1024 keys, ≤ 4 KB a value | `UiStringsSchema` (P2b) | `data/strings.ts` imports |
| `actors/strikes` | `CreatureStrike[]` | existing `CreatureStrikeSchema` | `data/brains.ts` `ROC_STRIKES` etc. |
| `world/physics` | the `prepareRuntimePlan` baked-physics rows | `WorldPhysicsSchema` (sp-x6, `@wildshard/format/worldPhysics`) | `data/physics.generated.json` imports |
| `sim/native-world` | the `prepareRuntimePlan` native-world rows | P2b | `data/nativeWorld.ts` imports |

`ui/level` (sp-x1, P3) holds the level metadata (`{ manifest }`, `LevelSectionSchema` in `@wildshard/format/level`),
moved out of `ui/card` (sp-x5 moves the mapping); its `PlatformSections` row is structural until `level.ts` lands, then
x1 types it from that module. The catalog carries `identity { slug, revision }` and `runtime.filesHash`; the loader
selects the runtime module only after the product's identity and inventory match them, and nothing evaluates on the
title screen. The three non-ported shards keep source discovery until their migration.

Note on names: the design's P2b row said "Sky's `combat/strikes` rows". `combat/strikes` is already today's
`rows.strikes` (player-weapon strikes, the Template uses it). The Roc's rows are creature strikes with a different
schema, so they get `actors/strikes`.

Adding a platform section is three edits: its schema in `@wildshard/format`, its entry in `PlatformSections`, its row in
the writer table. sp-x5 adds a type test that the writer table's names equal `keyof PlatformSections`.

**Trust.** A section file holds its schema's **output** (defaults filled), written by the build after
`v.parse`. For a **first-party** product the loader runs no valibot: not `parseOutputSection`, not the final
`parseShardfile` in `assembleOutputShardfile`. It checks size and hash (already done) and the `validation.json` receipt
(the app build refuses a stale one). A non-first-party product (a future third-party shard) still parses every
section at admission, asynchronously, before any hook. **This is a P1 change sp-x8 must make**: today
`assembleOutputShardfile` ends in `parseShardfile(result)`, which would bring back exactly the hitch above.

### 2.2 Custom sections (`sections/custom/<name>.json`)

The schema is declared **twice, on purpose** (Jake 21:35: whatever the runtime needs is duplicated in `runtime/`):

1. **Build side** (P2b, sp-x6): `data/*.ts` calls `defineSection('custom/trades', TradesSchema, TRADES)`
   (`src/sdk/sections.ts`). The build parses the value, writes the output to `sections/custom/trades.json` and the JSON
   Schema to `schemas/custom/trades.schema.json`; the validator checks one against the other.
2. **Runtime side** (counted lines): the shard's `runtime/sections.ts` exports **one registry**, plain valibot:

   ```ts
   import * as v from 'valibot';
   export const SECTIONS = {
     'custom/trades': v.array(v.strictObject({ id: v.string(), label: v.string(), give: v.array(…), … })),
   } as const;
   ```

   Runtime code reads `ctx.product.section('custom/trades', SECTIONS)`. The name is a key of the registry, so a read
   can't pair a section with the wrong schema, and the type is `v.InferOutput` of that entry.
3. **The proof** (build step 5, P3): the build imports `out/<slug>/runtime/sections.ts` in Node (it imports only
   valibot and `@wildshard/format`, which the `runtime-standalone` rule guarantees), and for every `SECTIONS` key:
   the section must be listed in the index, and `v.parse(SECTIONS[key], emittedJson)` must pass. A drift between the
   two schemas refuses the build. A shard with custom sections and no `SECTIONS` export refuses too.

So the runtime's type is proven against the shipped bytes at build, and a shipped page never parses. A **checked
product** (`createShardProduct({ check: true })`: tests, `wildshard validate`, the headless proof runs) parses a custom
section with its registry entry on first read and freezes the result.

A custom schema may import a public schema instead of copying one (`DirectorSchema` from `@wildshard/format/director`).
A shape that a **host** consumes (`HybridRuntimeRows`, `prepareRuntimePlan`'s inputs) is not custom: it becomes a
platform section with its schema in a public module, so both sides import it and nothing is copied.

### 2.3 `runtime/const.ts` mirrors (review item 8)

A value copied into `runtime/const.ts` (design §7.5: `CROWN`, `DAIS`, `ROC`) must not drift from its `data/` source.
`data/` declares each copy next to the value it mirrors, with `defineMirror` from `@wildshard/sdk/runtimeMirrors`
(in the skeleton):

```ts
// data/layout.ts (build-time)
export const CROWN = { x: 0, z: -190, r: 20 } as const;
export const RUNTIME_MIRRORS = [defineMirror('CROWN', CROWN), defineMirror('DAIS', DAIS), defineMirror('ROC', ROC)];
```

`shard.config.ts` hands the shard's mirrors to the build (`mirrors: [...RUNTIME_MIRRORS]`, P2b wires the field), and
build step 5 imports `out/<slug>/runtime/const.ts` in Node and calls `runtimeMirrorIssues(mirrors, constModule)`: every
mirror must be an export of `const.ts` whose value is canonically equal (key order ignored, numbers exact). A drift,
a missing export or a duplicate mirror refuses the build and names the constant and both values. Exports `data/` does
not mirror (runtime-only magic numbers) are allowed. `const.ts` holds plain JSON-valued `export const`s only, so it
imports in Node with nothing else.



### 3.1 The client: `ctx.product`

`ShardContext` gains `readonly product: ShardProduct` (in the skeleton). `shardContext(ctx, manifest, game, product?)`
defaults to `absentShardProduct(manifest.slug)`; `hybridInstallation` passes the base context's product through
(in the skeleton). The three other constructors must pass the loaded product (§6, sp-x8):

- `src/game/session/session.ts` (standalone page) and `src/game/shard/pluginLoad.ts`: before building the context,
  `await loadShardProduct(slug, browserShardfileOptions(base, true))` whenever the catalog lists an output for the slug.
  This holds **whatever the entry mode** (Pine's public LEGACY entry runs the same `runtime/` and needs its data too).
- `src/game/grid/regionalRuntime.ts`: `shardProductFromAdmission(admitted, scope)` from the cell's admitted product.

`loadShardProduct` (new, `src/game/shardfile/runtimeProduct.ts`) = `resolveOutputDescriptor` + `createShardProduct`:

```ts
createShardProduct({ slug, revision: index.identity.revision, shardfile: assembled,
  sections: descriptor.sections,                                   // decoded, hash-checked
  files: new Map(index.files.flatMap(f => f.name === undefined ? [] : [[f.name, { hash: f.hash, url: new URL(f.path, base).href }]])),
  read: hash => assets.read(hash) });                              // ClientAssets of the same product
```

**No more `runtime/source.ts`.** `prepareStandaloneHybrid` reads `ctx.product.shardfile` instead of
`rows.source()`; `StandaloneHybridRows.source` and the `source` parameter of `firstPartyStandaloneEntry` go;
`prepareHybridShard` takes the product's `shardfile` and skips its second `shard.json` read
(`takeFirstPartyDescriptor`). Pine's `source: () => import('./shard.config')` goes the same way: the config is
build-time and is never imported by play code again.

### 3.2 The headless entry: `product`

`HeadlessRuntimePreparation` (`src/sdk/headlessRuntime.ts`) gains `readonly product: ShardProduct`. The Node loader
builds it from `out/<slug>/` with the same `resolveOutputDescriptor` and a file reader (`read: hash => fs bytes,
hash-checked`), `check: true` in proof runs. `shard` stays (it equals `product.shardfile`) until Z1.

### 3.3 Hosts

Every host that reads a `Shardfile` today keeps its signature and gets `ctx.product.shardfile`
(`prepareClientWorld`, `bindQuestPageInteractions`, `runtimeLookMaterials`, `bindRuntimeProductProps`,
`prepareRuntimePlan`, the data client, `runtime.binds`). A host that needs a **new** platform section takes it as an
argument, read by the runtime: `prepareRuntimePlan(product.shardfile, assets, product.section('world/physics'),
product.section('sim/native-world'))`. No host reads `ctx.product` behind the runtime's back in P2a; moving hosts onto
`section()` is Z1-era cleanup, not this row.

**`HybridRuntimePlugin`** (`src/game/plugin/headless.ts`; Sky and Signal) builds its rows at construction from module
imports. It changes to `protected abstract rows(product: ShardProduct): HybridRuntimeRows`, called once in `world()`
with `ctx.product` and memoised; `HybridRuntimeRows.source` is deleted and the host uses `product.shardfile`.

## 4. Worked example: Sky Reach's Roc strikes and strings

**Before** (`src/shards/far-reach/runtime/index.ts`):

```ts
import { ROC_STRIKES } from '../data/brains';       // build-time TS, shipped in the bundle
import { STRINGS } from '../data/strings';
import { CROWN, DAIS, ROC } from '../data/layout';
import source from '../runtime/source';             // imports data/product.generated.json and parses it
const GALE_WALL = ROC_STRIKES[1];
…
protected readonly rows: HybridRuntimeRows = { ...SKY_RUNTIME_ROWS, source, owners: { … } };
…
built.winch.label = STRINGS.raised;
const wall = new Mesh(new BoxGeometry(GALE_WALL.shape.kind === 'lane' ? GALE_WALL.shape.width : 6, 5, 0.4), …);
```

**After** (S1):

```ts
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { PlatformSections } from '@wildshard/format/sections';
import { CROWN, DAIS, ROC } from './const';          // copied from data/layout.ts on purpose (design §7.5)
import { skyRuntimeRows } from './rows';

const SKY_STRINGS = ['raised', 'winchLocked', 'vaneTurned', 'roc'] as const;
function galeWall(product: ShardProduct): PlatformSections['actors/strikes'][number] {
  const row = product.section('actors/strikes').find(strike => strike.id === 'far.roc.galeWall');
  if (row === undefined) throw new Error('Sky Reach: actors/strikes has no far.roc.galeWall');
  return row;
}

export class SkyReachPlugin extends HybridRuntimePlugin {
  private strings: Readonly<Record<(typeof SKY_STRINGS)[number], string>> | null = null;
  protected override rows(product: ShardProduct): HybridRuntimeRows {
    return { ...skyRuntimeRows(product), owners: { … } };   // runtime/rows.ts, see below
  }
  protected override async build(ctx: ShardContext): Promise<void> {
    this.strings = ctx.product.strings(SKY_STRINGS);   // all four checked at load, one error if any is missing
    const compiled = await prepareClientWorld(ctx, ctx.product.shardfile, SKY_WORLD_PREPARATION, SKY_LIBRARY);
    …
    built.winch.label = this.strings.raised;
  }
  protected override async install(ctx: ShardContext): Promise<void> {
    const wallRow = galeWall(ctx.product);
    const wall = new Mesh(new BoxGeometry(wallRow.shape.kind === 'lane' ? wallRow.shape.width : 6, 5, 0.4), …);
    …
  }
}
```

`runtime/rows.ts` (S1) rebuilds today's `data/runtimeRows.ts` field by field from the product: `strings` from
`product.strings`, the quest page from `quests/*`, the species program from `actors/species` + `actors/strikes`; a value
no section carries yet is copied into `runtime/const.ts`. Build side (P2b + S1): `data/brains.ts` keeps computing
`SKY_CREATURE_STRIKES`; `shard.config.ts` emits them as `actors/strikes`; `data/strings.ts` emits `ui/strings`.
`runtime/source.ts` and the `source` argument in `plugin.ts` are deleted. **Headless** (`runtime/headless.ts`):

```ts
// before
import { SKY_NATIVE_WORLD } from '../data/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => prepareRuntimePlan(shard, assets, baked, SKY_NATIVE_WORLD);
// after
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ assets, product }) =>
  prepareRuntimePlan(product.shardfile, assets, product.section('world/physics'), product.section('sim/native-world'));
```

## 5. Worked example: Pine's watch director (`runtime/directorClock.ts`)

Picked because it shows all three reads: a declaration, a stage table and a Wasm module, none of which is in Pine's
built output today (the director, its stages and the base64 Wasm are imported as JSON).

**Before:**

```ts
import declaration from '../data/director.json' with { type: 'json' };
import rows from '../data/watchStages.json' with { type: 'json' };
import module from '../behaviour/director.json' with { type: 'json' };   // { module: <hash>, bytes: <base64 Wasm> }

export async function preparePineDirector(): Promise<() => DirectorLane> {
  if (module.module !== declaration.module) throw new Error('Pine director bake is stale');
  const create = await prepareDirectorModule(parseDirector(declaration), Uint8Array.from(atob(module.bytes), byte => byte.codePointAt(0) ?? 0));
  return () => create(357);
}
export function pineDirectorClock(lane: DirectorLane, ports: PineClockPorts, live = () => true) {
  const stages = new DirectorScriptStageLane(rows, lane, { observe, publish }, false, 1 / 60);
  …
}
export async function installPineClock(context: Pick<LevelContext, 'scope'>, ports: PineClockPorts, dawnAtBoot: boolean) {
  const scope = context.scope, create = await preparePineDirector();
  …
}
```

**After** (W2a):

```ts
// runtime/sections.ts (one registry for the whole runtime)
import * as v from 'valibot';
import { DirectorSchema } from '@wildshard/format/director';
import { DirectorStagesSchema } from '@wildshard/format/directorStages';
export const SECTIONS = {
  'custom/watchDirector': DirectorSchema,          // public schemas: imported, not copied
  'custom/watchStages': DirectorStagesSchema,
  'custom/nightDirector': DirectorSchema,
  'custom/nightStages': DirectorStagesSchema,
  'custom/trades': v.array(TradeSchema),            // shard-private shape: copied from data/trades.ts
} as const;

// runtime/directorClock.ts
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { ShardContext } from '@wildshard/game/plugin/context';
import type { DirectorStagesData } from '@wildshard/format/directorStages';
import { SECTIONS } from './sections';

export async function preparePineDirector(product: ShardProduct): Promise<() => DirectorLane> {
  const create = await prepareDirectorModule(product.section('custom/watchDirector', SECTIONS),
    await product.file('behaviour/director.wasm'));            // verified blob; prepareDirectorModule re-checks its hash
  return () => create(357);
}
export function pineDirectorClock(lane: DirectorLane, rows: DirectorStagesData, ports: PineClockPorts, live = () => true) { … }
export async function installPineClock(context: Pick<ShardContext, 'scope' | 'product'>, ports: PineClockPorts, dawnAtBoot: boolean) {
  const { scope, product } = context, create = await preparePineDirector(product);
  if (scope.disposed) throw new Error('Pine scope left during director admission');
  const clock = pineDirectorClock(create(), product.section('custom/watchStages', SECTIONS), ports, () => !scope.disposed);
  …
}
```

What moved where: the "bake is stale" check becomes the validator's cross-reference (§2.8 step 5: the declaration's
`module` hash must be a listed `wasm` file); `behaviour/director.as` already compiles at build step 2, and P2b's named
blobs give it the logical name `behaviour/director.wasm` (convention: `behaviour/<stem>.wasm`). `data/director.json` and
`data/watchStages.json` stay as build inputs, emitted with `defineSection('custom/watchDirector', DirectorSchema, …)`.
Pine's headless entry passes `product` from `HeadlessRuntimePreparation` to the same `preparePineDirector`. The same
recipe covers `nightDirector.ts`, `trader.ts` (`custom/trades`), `lodge.ts` and the other 23 Pine runtime files.

## 6. Files, lanes and build order

**Done here (sp-o258, the skeleton):** `src/format/sections.ts` (+ export), `src/game/shardfile/shardProduct.ts`
(+ export), `ShardContext.product` and the default in `shardContext()`, `hybridInstallation` passthrough,
`src/sdk/runtimeMirrors.ts` (`defineMirror`, `runtimeMirrorIssues`), `test/shard-product.test.ts`,
`test/runtime-mirrors.test.ts`.

| Step | Lane | Files | Done when |
|---|---|---|---|
| 1 | **sp-x5** (P1 writer) | `src/format/outputIndex.ts`: writer table type-tested against `PlatformSections`; sections hold schema output; `files[].name` written | `keyof PlatformSections` equals the table's names (type test) |
| 2 | **sp-x6** (P2b) | `src/sdk/sections.ts` (`defineSection`, in flight); `shard.config.ts` `mirrors` field (§2.3); `src/format/uiStrings.ts`, `world/physics` and `sim/native-world` schemas + `PlatformSections` entries; `actors/strikes` from `CreatureStrikeSchema`; named blobs incl. `behaviour/<stem>.wasm`; emit `data/strings.ts` → `ui/strings` | Sky and Signal outputs list `ui/strings`, `actors/strikes` (Sky), `world/physics`, `sim/native-world` and named Wasm |
| 3 | **sp-x8** (P1 loader) | `src/game/shardfile/outputDescriptor.ts` + `src/format/outputIndex.ts` `assembleOutputShardfile`: **no valibot for first-party** (§2.1); `src/game/shardfile/runtimeProduct.ts`: `loadShardProduct`, `shardProductFromAdmission`, the lease cache; `src/game/session/session.ts`, `src/game/shard/pluginLoad.ts`, `src/game/grid/regionalRuntime.ts`: pass the product to `shardContext` | a booted Sky / Pine page has `ctx.product.has('quests/quests')`; `parseShardfile` absent from a first-party boot profile |
| 4 | **sp-x8** (P1 loader, cont.) | `src/game/shard/runtimeVariant.ts`: drop `StandaloneHybridRows.source` and `firstPartyStandaloneEntry`'s `source`, read `ctx.product.shardfile`; `src/game/shardfile/hybrid.ts`: `prepareHybridShard` takes the product, no second descriptor read; `src/sdk/headlessRuntime.ts` + the Node loader: `HeadlessRuntimePreparation.product` | no caller passes a `source` loader; headless proofs get a checked product |
| 5 | **Codex (P2a build; first free of x8 / x6)** | `src/game/plugin/headless.ts`: `rows(product)` memoised, `HybridRuntimeRows.source` deleted; Sky and Signal plugins follow (mechanical) | Sky and Signal boot with `runtime/source.ts` unused |
| 6 | **sp-x1** (P3) | build step 5: import `out/<slug>/runtime/sections.ts`, check every `SECTIONS` key against the emitted JSON (§2.2); import `runtime/const.ts` and refuse on `runtimeMirrorIssues` (§2.3) | a deliberately drifted schema or constant refuses `wildshard build` |
| 7 | **sp-x4** (P0) | `lint/shardfile-boundaries.mjs`: already allows `@wildshard/game/*`, `format`, `valibot`; nothing new | — |
| 8 | S1 / S2 / W2a / W2b | the rewires, using §4 and §5 as the recipe; delete `runtime/source.ts` | the shard's `runtime-standalone` ratchet reaches 0 |

Order: 1 and 2 in parallel → 3 → 4 → 5 and 6 in parallel → 8. sp-x6 touches only the authoring side and format
schemas; sp-x8 touches only the loader and the entry plumbing; neither edits `shardProduct.ts` beyond adding a
`ShardProductInput` field if the loader needs one. Steps 3–5 change `src/game/plugin/context.ts` callers only, never
the type.

`docs/ENGINE.md` gets a "Runtime data" manual section with step 5 (the module's doc comments are the source).

## 7. Questions for Jake

None. Every choice above follows the design and G445–G450.
