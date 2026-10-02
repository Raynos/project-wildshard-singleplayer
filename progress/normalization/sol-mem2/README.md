# E357 L2/L4 — sol-mem2 memory audit

The comparison base used for `3270c035` was **ff0741816dc34eaf5a7b98f4f4442fe10aa4d9c3**,
`~/.wildshard/gpu-perf/memory-2026-10-02T00-12-29-502Z-ff07418.json`.
Its Pine medians were 0.541331392 GB play and 0.546099160 GB Explorer.
That collection failed to load `_template` (all three template rows fail) and its memory step exited **124**.
Every saved historical memory collection exited 124, including ones that wrote complete green tables.
`history.json` retains their relevant rows and steps. None is a valid comparison reference.

## Timeout cause and repair

`nightly.mjs` waits for the spawned lane command's **close** event, which requires every inherited
stdout/stderr pipe to close. `sim-lane.sh` killed its watchdog shell before `pkill -P` could kill
that shell's `sleep`. The sleep was reparented and kept stdout open until the full lane deadline.
The memory table had already finished; the pipe delay consumed the nightly deadline before soak.
A standalone reproduction exited 0 at **1055 ms** but emitted close only at **15005 ms**.
The fix isolates both watchdog output streams and kills sleep before its parent. The regression
test executes the actual watchdog/cleanup lines without booting a Simulator, and checks prompt pipe closure.
The current lane script is now carried with the current harness when nightly measures an older runtime.
Nightly parity/offline also use parity's own per-browser slots, removing the obsolete outer lane lease.

## Cold runtime measurements

Terminating Safari does not clear service workers, Cache Storage or saved settings. An old controlling
worker can serve a cache-first old document on a reused preview port. The old driver never checked the
executed build or Explorer shard. In the 3270 report `_template` Explorer actually showed Driftwood's
195 MB geometry, while the teaching shard's play was only 0.224 GB.
The revised driver unregisters workers, clears Cache Storage and saves before each shard, and verifies
`__wildshard.boot.build` against the server's network-only version plus the actual world shard both
after load and in Explorer. Hidden template Explorer uses its own HUD entry, avoiding a missing title card.
Saved reports explicitly identify this measurement protocol; previous unverified or broken reports cannot
be selected automatically or supplied through `--previous`.

Both endpoints used clean `serve-build.sh --rev <sha>` exports and the same revised driver through
`sim-lane.sh run --max 7 wildshard-iphone node scripts/sim-memory.mjs --url=<preview> --shards=pine-hollow
--runs=1 --play=60 --fly=60 --out=<fresh dir>`. Each terminated with exit 0 and its preview was stopped.
`endpoints.json` preserves verified build identities, the selected three samples, spread, raw peaks and scene counts.

| Runtime | Loading median GB | Play median GB | Explorer median GB |
|---|---:|---:|---:|
| 720dd05b | 0.585011112 | 0.583651240 | 0.586616768 |
| HEAD c9693a71 | 0.639455072 | 0.610439104 | 0.610815936 |
| Change | +9.31% | +4.59% | +4.13% |

Every phase is within the unchanged 10% growth band and raw-peak absolute caps. Both endpoint scenes
hold exactly **54,650,208 geometry bytes, 3,210,472 instance bytes, 14,123,048 texture-image bytes,
1,439 arrays and 186 scene textures**. GPU geometries are 244/243 and textures 416/416; calls are 48/48.
There is no reproduced allocation growth requiring a runtime fix or commit bisect. This is one cold
sample per endpoint, not a claim that allocator/GC noise has disappeared. The warm, unverified initial
repeats varied from 0.622 to 0.715 GB in play and had 18.14 MB texture images; they are excluded.
The original 0.739/0.749 reading cannot establish a causal allocating commit against its invalid base.

J13 ammo and L8 sky split predate 720dd05b. The newer Pine navmesh is only **297 bytes larger**
(171474 → 171771). G26/G27 add floor/fall behavior; no persistent scene resource increase appears
in the verified endpoints. Cache/settings contamination and allocator retention explain why the old
comparison was not trustworthy; attribution of the native variance to GC is an inference, not an allocation trace.

## Validation and remaining integration run

Clean HEAD export plus these harness changes: whole-tree TypeScript, touched-file oxlint, shell syntax,
and **23 focused tests** pass. The hidden-template smoke verifies `_template` at load and in Explorer (1.29 MB retained geometry), with the actual piped lane command exiting 0 at 72517 ms and closing its pipes at 72518 ms (`template.json`). The shared working tree has unrelated in-flight type errors, left untouched.
The normal nightly and all-shard pin reading exceed the builder's four-minute wait limit and belong to the lead:

- queued: `bash scripts/gpu-perf/nightly.sh --memory-only --sha=<landed-and-pushed-full-SHA>`
- queued: `bash scripts/gpu-perf/nightly.sh`

No pin move, new ask, push or shard edit by this builder. Full raw runs and diagnostic traces remain
under `/private/tmp/sol-mem2/`; nightly history is unchanged under `~/.wildshard/gpu-perf/`.
