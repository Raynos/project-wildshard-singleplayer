# Adversarial review of the shardfile design (2026-10-16)

A fresh Opus 5.5 reviewer checked `README.md` (2ead9dfa1, e6980c490) against the code, read-only. **Verdict: sound with
fixes.** The core matches Jake's ask: `data/` is TypeScript run only at build, the runtime reads sections instead of
importing `data/`, `runtime/` is standalone, and the ruler measures the built output. Rebuilding today's `Shardfile`
from sections is cheap (the uncommitted `src/format/sections.ts` slices today's top-level keys and `outputDescriptor.ts`
puts them back). But the loader and discovery work is under-sized, and the "a server loads it unchanged" claim isn't
true yet.

The planner adopted every fix below as the default (AGENTS.md: never pause lanes); Jake can override any of them.

| # | Issue | Evidence | Fix (adopted) |
|---|---|---|---|
| 1 | "A server loads `sim` + `both` and ignores `runtime`" is false: a hybrid shard's sim is its runtime | `src/sdk/headlessRuntime.ts:119-123` loads `runtime/headless.ts` as a local module | Say plainly that a shard with a runtime needs it on the server (transitional); list `runtime.headless` in the index; a custom section may be `sim`/`both` only if `headless.ts` reads it |
| 2 | Replacing discovery with `catalog.json` is far bigger than sized: `ShardManifest` has ~40 level-config keys plus code loaders (`render`, `roster`, `ktx2`, dev poses, `treeFactory`) and value imports; startup is synchronous today | `discovery.generated.ts`; `src/game/shard/manifest.ts:585-729`; `src/shardList.ts:6-8` | Add a level section (`ManifestMetadataSchema`, `format/minimap.ts:213`); move code loaders into the runtime registry; design async boot explicitly; **P3 resized M → L with a spike first**; plan the 3 non-ported shards (`ink-cel-valley`, `pastel-plain`, `blender-template`) before Z1 |
| 3 | ~57 play files import `shard.config.ts` or `runtime/source.ts` (Pine 16, DW 14, Nalati 11, Nine 8, Sky 4, Signal 4), some at module load; `prepareHybridShard` checks identity against it | `far-reach/models/gear.ts:5-10`; `hybrid.ts:270-300`; `runtimeVariant.ts:35` | Count these in the ratchet and in the S1/W2 row sizes; check identity against the catalog (slug, revision, runtime hash); make module-level catalogue builders functions of the product |
| 4 | The output ruler gets expensive and `out/` races: the cache key hashes the whole tree, so any engine edit rebakes every shard (Nine 173 MB); gate/CI never read the cache; the in-progress P4 calls `build-shardfiles.mjs --reuse` outside `heavy-lane`; `catalog.json` is a read-modify-write shared by ~10 agents | `scripts/shardfile-cache.mjs:1-17, 88-92` | Run the ruler through `heavy-lane` or measure the gate's last HEAD build; build into a temp dir and rename into place; regenerate `catalog.json` from `out/*/shard.json` in one pass; narrow the cache key to the shard's import closure |
| 5 | Custom sections are an unmeasured loophole (Sky ~25, Signal ~15; unlimited, report-only) | §2.5 | Shrink-only ratchet on custom-section count and bytes in `lint/ratchet.json`, an exit row each, no new ones after S1/S2 |
| 6 | An old cached product can meet a new runtime offline; Z1 deletes the v1 reader while players hold v1 copies | `product.ts:134`; `shardProduct.ts`; `hybrid.ts:298` | The compiled registry entry carries the `runtime.files` hash and the loader refuses a mismatched product; version custom schemas `custom/x@N`; evict v1 caches before Z1 |
| 7 | Contradicts G304/G307: step 6 refuses private binaries yet S3/W2a move Pine's 121 MB and DW's 62 MB of runtime-decoded `.bin`/`.json`/`.gltf` into blobs (`.gltf`/`.json` aren't blob kinds); Nalati's 166 assets / 56 MB are in no row; moving Pine wholesale puts 514 engine imports into `runtime/` (G307); the SDK is allowed in the intro but not in §3.2 rule 1 | §2.8, §3.2, §6 | Write the exact package allowlist now (engine imports ratcheted during migration); keep G304 report-only in validation; convert `.gltf` → `.glb` and runtime `.json` → sections; add a Nalati assets row |
| 8 | Nothing catches `runtime/const.ts` drifting from `data/` | §2.6 | The build imports `out/<slug>/runtime/const.ts` and checks it against values `data/` marks as mirrored (or a per-shard test) |
| 9 | Boot gets slower: sections fetched 4 at a time, ~13 rounds for Sky's ~50 files vs one fetch today; `load`/`audience` unused | `outputDescriptor.ts:58-63` | Fetch all sections in parallel; cut `load` and `audience` until something reads them |
| 10 | Memory impact unestimated: private assets enter `files[]` and the 1.2 GB admission math for the first time | §2.3 | Measure each shard's admission before and after S3/W2a; report it in the row |

**Ceremony to cut:** the `load` and `audience` fields; generated JSON Schema files for custom sections beside the
valibot registry that actually checks them; the duplicate `actors/strikes` vs `combat/strikes` sections.

**Numbers corrected:** Sky play files importing `data/` ≈ 20 files / 61 imports at 2ead9dfa1 (the doc left out the
gitignored `discovery.generated.ts`); Signal 15 / 35 (not 14 / 26); Driftwood assets 128 files / 62 MB (not 110 /
61 MB); Sky look-graph builders ≈ 467 lines (not 335). The 37 % Sky output figure is consistent with a ~6.8k
denominator once generated files are excluded.

**Genuinely good:** the §7.4 spawns example is exactly Jake's model; the output is content-addressed and deterministic;
keeping today's `Shardfile` and every host is the right low-risk bridge; Q2 is honest that runtime loading stays static
for now.
