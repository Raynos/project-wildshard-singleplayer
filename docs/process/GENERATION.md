# Generated content (G292)

Shard generators stay in `src/shards/<slug>/generators/`. `scripts/generate.mjs` discovers their bake entry points and
reads the explicit job sidecar `scripts/generation-jobs.json`. Its DO NOT EDIT notice applies to the listed outputs.
That sidecar names the retained source command, input roots, outputs and platform policy. Unregistered entry points
are reported as migration gaps. The full committed-output inventory is in
[the G292 report](../../progress/shard-platform/g292-outputs.md).

`pnpm gen`, used by Vercel and CI, runs the **report-only** phase. It validates declarations and prints uncovered
producers and missing outputs, without introducing a gate failure for migration gaps. No committed output is removed
in this rollout. Nine Dragon's layout/specimens pilot is Darwin-normative: Linux retains those files and reports that
its bit-exact comparison is unavailable. Native witness jobs run on Linux too, with separate OS/architecture keys.

Run one declared job with `node scripts/generate.mjs --job=nine-layout`. Add `--compare` to force fresh generation and
compare both the existing cache and every committed output. `--restore` may materialize absent outputs after the same
checks; it never overwrites different committed bytes. The pilot keeps stamp seeds because its schema imports them;
the producer must write every declared output, so a copied seed cannot masquerade as a fresh bake. Removing these
seeds requires separating schemas from generated data before uncommitting them.

Jobs hash every regular file in their declared conservative input roots plus the runner, sidecar, loader and lockfile.
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
the small-and-expensive committed exception (<200 KB **and** >60 s). Blender GLBs remain committed under G293. Browser
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
