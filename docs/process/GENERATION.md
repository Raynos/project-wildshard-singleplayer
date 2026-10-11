# Generated content (G292)

Shard generators stay in `src/shards/<slug>/generators/`. `scripts/generate.mjs` discovers their bake entry points and
reads the explicit job sidecar `scripts/generation-jobs.json`. Its DO NOT EDIT notice applies to the listed outputs.
That sidecar names the retained source command, input roots, outputs and platform policy. Unregistered entry points
are reported as migration gaps. The full committed-output inventory is in
[the G292 report](../../progress/shard-platform/g292-outputs.md).

`pnpm gen`, used by Vercel, CI and the push gate's Vercel export, prepares the sidecar's explicitly admitted
`buildOutputs` before asset tables and shard packing. The first cohort is Sky's goat and Roc rigs, Nalati's bodies,
Pine's cabins and Signal's grain tile. Each admitted file has a pinned SHA256: a cold job generates in isolation,
a warm job verifies its cache, and only missing admitted files are restored after the complete job passes.
Different committed bytes or generated hashes refuse the build. Other jobs remain report-only migration gaps.
Nine Dragon's layout/specimens pilot is Darwin-normative: Linux retains those files and reports that
its bit-exact comparison is unavailable. Native witness jobs run on Linux too, with separate OS/architecture keys.

Run one declared job with `node scripts/generate.mjs --job=nine-layout`. Add `--compare` to force fresh generation and
compare both the existing cache and every committed output. `--restore` may materialize absent outputs after the same
checks; it never overwrites different committed bytes. The pilot keeps stamp seeds because its schema imports them;
the producer must write every declared output, so a copied seed cannot masquerade as a fresh bake. Removing these
seeds requires separating schemas from generated data before uncommitting them.

Jobs hash every regular file in their declared conservative input roots plus the runner, sidecar, loader and lockfile.
Produced files are excluded from input keys unless explicitly declared as schema seeds, so removing or restoring an
admitted output does not invalidate its own cache. The complete output list remains verified even when only part of
a job is admitted for build restoration. `buildOutputs` cannot admit schema seeds, Darwin-only or browser jobs.
Bakers with dynamic reads must declare their complete source/asset closure. Conservative extra inputs cost cache hits,
not correctness. Node commands run without a shell in a fresh, dependency-linked source copy, never against the shared
checkout. All outputs are verified before publishing. Changing inputs during copying or generation refuses publication.

`scripts/generation-cache.mjs` is the one asset/witness backend. `runGenerationJob(root, job, {generate, forceCompare})`
passes an isolated output directory to the producer and returns its verified directory, key, hit, hashes and elapsedMs.
Keys include exact input SHA256s, command/tool identity and Node version; native/Darwin jobs also include OS/architecture.
Independent processes coalesce on one key. A failed job publishes nothing; corrupt warm hits regenerate. Forced
comparison preserves an existing valid cache if new output differs. Cache files live outside git, under
`WILDSHARD_GENERATE_CACHE` or `~/.cache/wildshard/generate`.

The backend elapsedMs includes waiting, isolated copying, generation, post-run input verification and publication.
Warm elapsedMs includes output-hash verification. Initial input-map collection and key verification precede that timer. Neither is a fabricated per-producer estimate. Record cold time and portability evidence before allowing
the small-and-expensive committed exception (<2 MB **and** >30 s). Blender GLBs remain committed under G293. Browser
captures and other undeclared producers remain retained until their build path is explicitly proven; the inventory's
missing producer/timing evidence is a blocker to deletion.

Browser capture jobs require a pinned preview and run through `scripts/browser-lane.sh`. They hash the preview's source
and public inputs plus the Chromium executable; the build id is fenced before/after. Invoke the producer against the
immutable preview export, rather than mixing current working sources with an older page. Cold/forced cache comparison
remains byte-exact. Comparison to older committed captures excludes **only** top-level `revision`, `build`, and `inputs` (where recorded);
all nested gameplay, clock, actor and collider data stays exact. New provenance is reported and retained in the cache;
no capture overwrites committed files. Seed outputs are explicitly declared, not copied by default.

Digest-pinned external inputs (for example, uncommitted raw HDRIs) also use this backend. The sidecar declares an
HTTPS URL and SHA256 for each input; a changed upstream file refuses publication. The verified raw source is copied
into the isolated tree before the baker runs, so an OS temp cache or mutable discovery API cannot select different
bytes. Encoder jobs include the executable's bytes and version output in their key. No raw source is committed.

`recordedInputs` is restricted to `RECORDED_BAKES` in `bake-input-hashes.mjs`. It compares committed data using that
existing rule: only the top-level `inputs` map may differ. Cache cold/forced hashes, including that map, must still
match exactly. This exception cannot be applied to arbitrary outputs or combined with browser provenance exclusion.

Node jobs that read active-level terrain explicitly preload `scripts/generation-level.mjs` after the TypeScript loader,
with `--generation-shard=<slug>`. It installs that one real manifest, without discovering or loading other shards. The
preload and the manifest belong to the declared input closure; a missing composition root never falls back to a fake level.

A standalone pixel generator declares `browser: true` even when it needs no running preview (`sky-textures`).
Its Chromium executable digest participates in the key; it uses exact bytes for both cache and committed comparisons.
Run these jobs through `scripts/browser-lane.sh` too. This differs from `capture`, which fences a page build and has the
explicit top-level capture-provenance comparison described above.

Shared root tooling declares `shard: null`, with its real `scripts/bake-*.mjs` entry; it never receives a synthetic shard
identity. Discovery also reports undeclared root bakers. The explicit helper list excludes only the loader, check runner,
input-hash reader and output writer. Shared producers use the same cache, isolation, hash verification and failure rules.
Those that query the complete level registry explicitly preload `scripts/generation-registry.mjs` after the TypeScript
loader. Its generated manifest list and all source manifests belong to the input closure.

A shared browser producer with raw binary/image outputs declares `browser: true, preview: true`, and places
`<preview-url>` in its command argument at the producer's actual URL position. Pass `--url` and `--revision` to the runner;
it substitutes the URL, binds the preview build and Chromium digest in the key, and checks the build again after baking.
This grants no provenance exclusion: every output byte must match. Only `capture: true` has the existing, narrowly
defined physics/spots JSON provenance comparison. All browser producer commands run through `scripts/browser-lane.sh`.


## Linux portability evidence

`.github/workflows/generation-compare.yml` runs `scripts/generation-linux.mjs` against a real Linux checkout. It calls
`generateShardJob` from `scripts/generate.mjs` for every job not marked Darwin-only: a cache miss generates in isolation,
a warm hit verifies every cached hash, and workflow-dispatch `force` requests fresh regenerate-and-compare. It uses the
same asset/witness cache, with native keys partitioned by OS/architecture. No committed file is restored or removed.

The report artifact has schema `generation-portability/1`, source pin, actual host/Node identity, and per-output retained
and generated SHA256s. `bitExactOutputs` includes only raw byte equality. Recorded-input/provenance equivalence is a
separate field and cannot put a differing file on that list. Producer failures, including unavailable encoder tools or
external inputs, remain explicit `unavailable` rows; missing evidence is null. Strict refusal still occurs in the runner;
the observer merely records it. Migration differences are report-only, not deploy gate failures. A workflow/infrastructure
failure cannot produce a portability claim. Results must be read from the actual Linux artifact before any deletion.

All six physics producers, Pine and Driftwood quest spots, and Nalati placements now run in Node with exact committed
comparisons. These producers are Linux comparison candidates; their Darwin proofs do not establish Linux byte equality.
Nine layout and Driftwood fixed models retain their documented Darwin-normative policy. This policy does not waive
committed comparisons or claim Linux evidence from Darwin runs. In particular, a missing `magick` executable is a tool gap, not output inequality;
the HDRI producer stays unavailable until that real dependency is supplied.


## DS1.5: builds without a browser

Authoring-only JSON recipes use `node --import ./src/sdk/bake/source-loader.mjs src/sdk/bake/json.mjs
<shard-generator> <function> <output>`. The resolver admits only that shard's six authoring folders plus SDK,
commons and format; it refuses game, engine, runtime, frozen legacy and sibling-shard imports before evaluating them,
including computed imports. It does not install the app, simulation bindings or page services. Nine's portal-floor
job uses this path and retains its pinned output hash. The clean room audits an authoring preload's closure too;
the old simulation/page preloads remain blocked. Selecting a job for an incremental rehearsal does not grant a
complete shard-product match or permission to delete its legacy source.

`node scripts/build-without-browser.mjs -- pnpm build` runs the real build with a fail-closed Playwright preloader.
All Chromium, Firefox and WebKit launches, persistent launches, browser servers and connections refuse; the preloader
is inherited by Node children. Push/PR CI wraps its checks/build step the same way. Runtime browser proofs and GPU
asset captures use their separate browser lane; they are not part of a cold application build.

The initial DS1.5 sidecar audit at `08eb8cbd2` found these four browser/capture producers:

| Job | Flag | Work | Route |
| --- | --- | --- | --- |
| `pine-spots` | `capture` | Native quest placement and prompt metadata | Node native construction, `d80f47f31` |
| `driftwood-spots` | `capture` | Native quest placement, reward pose and prompt metadata | Node native construction, `6e34cb556` |
| `nalati-places` | `browser` | Native geometry, collider rows and specimens | Node canonical producer, `27b0d8da1`; deliberate last-bit re-record |
| `sky-textures` | `browser` | Canvas2D painting and image encoding | Retained pixel producer: Canvas2D paint and JPEG codec, no WebGL |

`sky-textures` is the only remaining sidecar job with `browser: true`; none retain `capture: true`.
No temporary `compare-*-physics-page` scripts remain tracked. All six physics producers execute in Node. The broader
source audit also found `bake-maps` (actual WebGL map rendering), `bake-viewmodel-sets` (Canvas2D painting) and Nalati's
`bake-coats` mode (CPU coat painting and image encoding). Those image outputs remain committed; they are not admitted
`buildOutputs`, and a CI build never captures them. Canvas2D is recorded explicitly rather than called a WebGL bake.
This is the pixel-bake branch of [the design system, §3.1](../plans/shard-platform/design-system.md#31-the-basis-real-threejs-in-node-g311-decided):
pixel producers use the browser lane or an existing CPU path, while native placement and physics run in Node.
The descriptor refuses browser/capture jobs with admitted build outputs; missing retained files fail instead of
starting an implicit browser.

## G320: removal requires a complete product

`scripts/precommit-generation-removals.mjs` runs only when the commit deletes a tracked output from the predecessor's
generation catalogue. It reads the pathspec/private index, requires the exact predecessor SHA256 in that output's
`buildOutputs`, and requires a retained shard-owned producer plus a registered complete `shard.json` producer.
It then rehearses the affected shard jobs from the immutable staged tree, with a new empty cache and every runtime,
legacy directory and registered generated output removed. The complete product and the deleted output must both
match exactly. A component-only pass, a missing product, a changed pin or a Darwin-only/browser/seeded producer
refuses removal. A quiet window refuses the new rehearsal. Normal source commits and historical removals do no
generation work; no working-tree output is restored or overwritten by the guard.

The six Template/Pastel terrain, props and behavior component jobs pass their author-only cold and clean-room gates.
Their **complete products are BLOCKED ON SKINS (WAITING FOR OPUS)**: the current skin exporter reaches the native
factory, AnimalView and game species views, then copies generated fixture outputs. These rig and geometry producers
are graphical O work. Retained component proofs cannot authorize output or legacy deletion while that closure is
open. Linux byte parity, the build and boot gates also remain required for a subsequent per-output promotion.

Nine's complete portal-entry JSON job uses the SDK's authoring-only source resolver and JSON driver. Its input list
contains the entry scene, its data rows and the SDK/format closure; it no longer loads the simulation resolver or
panel renderer. The unchanged veil literal is checked where the native page consumes it. The entry JSON retains its
original pinned hash, and a fresh runtime/legacy/cache/all-output-deleted clean room rebuilds it exactly. Nine's
complete shard product remains a separate gate; this component does not authorize any deletion.

Pine’s `pine-night-director` job compiles its retained typed AssemblyScript and declared ABI through the shared confined authoring loader. Its two pinned products (the one-page module and DO-NOT-EDIT transport JSON) regenerate without runtime, legacy, seeds or a warm cache. This component proof does not admit a whole-product removal.

Nalati’s `nalati-raid-director` job compiles its retained typed AssemblyScript and declared ABI through the shared confined authoring loader. Its two pinned products (the one-page module and DO-NOT-EDIT transport JSON) regenerate without runtime, legacy, seeds or a warm cache. This component proof does not admit a whole-product removal.

Nine’s `nine-fronts` job builds its ten solid fronts from the retained three.js-shaped author scene. The exact scene reader, JSON writer and confined loader closure is keyed without runtime, legacy or seeds. Cold, forced and official clean-room output comparison proves the complete component; it does not admit whole-product removal.

Nine’s `nine-floor-boxes` job builds its ordered floorBoxes colliders from the retained three.js-shaped author scene. The exact scene reader, JSON writer and confined loader closure is keyed without runtime, legacy or seeds. Cold, forced and official clean-room output comparison proves the complete component; it does not admit whole-product removal.

Nine’s `nine-portal-floors` job builds its ordered portalFloors colliders from the retained three.js-shaped author scene. The exact scene reader, JSON writer and confined loader closure is keyed without runtime, legacy or seeds. Cold, forced and official clean-room output comparison proves the complete component; it does not admit whole-product removal.

Nine’s `nine-deck-caps` job builds its ordered deckCaps colliders from the retained three.js-shaped author scene. The exact scene reader, JSON writer and confined loader closure is keyed without runtime, legacy or seeds. Cold, forced and official clean-room output comparison proves the complete component; it does not admit whole-product removal.

Nalati’s `nalati-ghost-volley-director` job compiles its retained typed AssemblyScript and declared ABI through the shared confined authoring loader. Its two pinned products (the one-page module and DO-NOT-EDIT transport JSON) regenerate without runtime, legacy, seeds or a warm cache. This component proof does not admit a whole-product removal.

Sky’s `sky-rising-islets` job builds its four rising socket islets from the retained three.js-shaped author scene. The exact scene reader, JSON writer and confined loader closure is keyed without runtime, legacy or seeds. Cold, forced and official clean-room output comparison proves the complete component; it does not admit whole-product removal.

Driftwood’s `driftwood-director` job compiles its retained typed AssemblyScript and declared ABI through the shared confined authoring loader. Its two pinned products (the one-page module and DO-NOT-EDIT transport JSON) regenerate without runtime, legacy, seeds or a warm cache. This component proof does not admit a whole-product removal.

The Driftwood director component remains report-only: its retained outputs are not admitted as buildOutputs, and no removal is authorized before its complete shard product passes.

Pine’s `pine-clock-director` job compiles its retained typed AssemblyScript and declared ABI through the shared confined authoring loader. Its two pinned products (the one-page module and historical transport JSON) regenerate without runtime, legacy, seeds or a warm cache. The job remains report-only. This component proof does not admit activation or whole-product removal.

Signal’s `signal-skitterer-behaviour` report-only job compiles its retained native AssemblyScript policy through the confined SDK author loader. Its exact historical transport shape and hash regenerate without runtime, legacy, seeds or a warm cache. No activation or removal is admitted until the whole shard product passes.

Nalati’s existing `nalati-qara` component now runs through the confined SDK author loader with its exact compiler/retained AS closure. Cold, forced and official clean-room regeneration preserve the original transport hash. Existing activation is unchanged, and this component evidence cannot authorize whole-product removal.

Pine’s `pine-elite-behaviours` report-only component compiles the four retained native elite policies after their exact shared AS prelude, through the confined SDK author loader. All four original transport hashes regenerate without runtime, legacy, seeds or a warm cache. No activation or removal is admitted until the whole shard product passes.

Nalati’s `nalati-weapon-hooks` report-only component compiles retained `behaviour/weapons.as` with the typed sabre hook declaration, whose parameters come from the existing authored weapon profile. The original module and declaration hashes regenerate without runtime, legacy, generated seeds or a warm cache. No activation or removal is admitted until the whole shard product passes.

### Nine static physics placements (G320)

The complete `nine-physics-placements` component compiles eight ordered
floor/front/deck/guard rest pieces from retained collider scenes and the
floor plan. Its 7.4 KB JSON is generated on a cache miss and pinned to
SHA-256 `044b4d71b4a17d42afbcce23672ac51fb97e2e9ece0c205d31a0fd855fd9606d`; it is never a copied physics snapshot. The native
physics baker adopts these placements directly, keeping the remaining
mesh-derived pieces and hooks as an explicitly transitional capture.
Live guard state, grid cap selection and body ownership stay unchanged.
This component cannot authorise removal of the complete physics product.

### Sky static physics placements (G320)

The complete `sky-physics-placements` component compiles sixteen ordered
island-top and road-lip rest pieces from retained island rows and SocketLift
authoring. Its 11.4 KB JSON is generated on a cache miss and pinned to
SHA-256 `cc7ce2378d56f43ad1b40f9ab90518bc618110494de9a2456628070d88a68473`; it is never a copied physics snapshot. The native
physics baker adopts these placements directly, keeping the remaining
mesh-derived hulls and creature rigs as an explicitly transitional capture.
Live islet mover poses and body ownership stay unchanged.
This component cannot authorise removal of the complete physics product.

### Signal camp physics placements (G320)

The complete `signal-physics-placements` component compiles the caravan,
well and three waymarks from retained source recipes on an authored dune
field, simplex seed, trail bed and entry grading. It never reads captured
heights, world constructors or recorded collider JSON. The shipping height
law remains unchanged; the retained author version is compared exactly
against it across seeds, terrain samples and all native placement fields.
Its 4.5 KB JSON is generated on a cache miss and pinned to SHA-256
`dc53caf1683fea1aa8e0117b93485ef09e6956fbd55b29846f0783e5ee8bd92f`. Remaining creature rigs, tower/model placements and prompt
readbacks are transitional; this component permits no whole-product removal.

### Signal tower colliders (G320)

The complete `signal-tower-colliders` component emits forty tower boxes
from retained leg/deck/rail/open-stair/bowl recipes and the authored dune
height law. No retained tower JSON, world constructor, material or geometry
producer is an input. The native producer adopts these generated rows in
its original registration order. The cheap JSON is generated on a cache
miss, pinned to SHA-256 `fd9796b48b293c9408a637fc0bc863da71a0009f3a95c55c1c0db6573af9439c`. Geometry/rig/body and prompt owners
remain transitional; no whole-product output removal is authorised.

### Sky bridge colliders (G320)

The complete `sky-bridge-colliders` component emits eleven rope/hover/
updraft/winch rest placements (975 boxes) from retained layout, chord,
quaternion and sag expressions, plus authored rising-islet rows. No world,
geometry, material, runtime helper or captured collider is an input. Live
mode gates and winch/islet motion stay with their existing owners. The
cheap JSON is generated on a cache miss, pinned to SHA-256 `d5545bc47278abcf37fbefea7a2fdbad75a8998b684e309a1585da081ce425f7`.
Remaining mesh/rig/body owners are transitional; no whole-product output
removal is authorised.

### Driftwood native ground (G320)

The complete `driftwood-ground` component recompiles the original 256²
WSTR lattice from retained island, seeded noise, grading, trail and road
source. The native physics producer uses that source directly, with the
exact G164 drop/unshift arithmetic. No runtime, manifest, retained grid or
captured collider is an input. The pinned output SHA-256 is `7ee9dec5bd542063dce4c19d70d3e2fe9c3f61b54eff23387c0aec5629346c43`.
The committed terrain stays until the whole-product clean room is green.
Navmesh completion still requires all collider/floor dependencies; a ground
component pass grants no output removal.
