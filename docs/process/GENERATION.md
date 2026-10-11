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
