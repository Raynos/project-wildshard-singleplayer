# Sky grid-ready construction

The Sky road travel target **PASSES twice** on `66ca64cf7`; C1 remains
**OPEN** for the remaining static-world work and construction margin.
This slice bakes keeper fit/partition and paces
world groups, model loads, install phases and body allocation. It changes
no precompile policy, native NPC motion, roster order, RNG, or colliders.

The diagnostic on `cf35205ed` recorded play 104 ms with no GL work,
world tasks 52/53/59 ms and activation 71 ms. The first scope-only plain
candidate `4f18d7852` still FAILED: travel p95 39 ms, max 84 ms; play
71 ms, world 84 ms, activation 83 ms, and three afterPlay tasks up to
72 ms. Neither run earns timing qualification.

Keeper fit and triangle partition now run in the retained author-only
recipe, emitting ordinary GLB accessors. The released native partition
fixture proves exact local channels, indices, bounds and pivot hierarchy.
The empty head remains an explicit zero-count part; missing nonempty
parts refuse instead of fitting at runtime. Native motion and registration
remain with the existing NPC host.

The roster proof covers ordinary and retained entry, identical body IDs,
allocation/RNG order, late landing and disposal, and owner cancellation
between bodies. Scope-paced yields use 4 ms only for Sky construction;
the engine default and shader warm-up policy remain unchanged.

Automated C1 parity compared `fc33c8254` against `868e2b62e`: all 18
phone/desktop poses had zero differing pixels, draws, triangles, GPU
bytes, programs, shader sources and colliders. Nine focused tests across
five files and narrowed strict types passed on that exact product.
Subsequent rebase preserves the one-graph mapped-material binding.

CALL: keep the native empty keeper head as declared zero-count metadata;
a missing nonempty baked pivot is damaged content, never a runtime fit.

## Two plain same-pin Simulator runs

Command: `node scripts/frame-floor.mjs --rev=66ca64cf7 --shards=grid
--grid-scenario=milestone --grid-routes=far-reach-road-entry --devserver
--surface=sim`. Both completed with zero errors. No profiling, GL timing,
task clock or timeline observer; the default GL census was on.

| Run | Sky travel p95 | Drive p95 / max | Interior p95 | Whole verdict |
| --- | --- | --- | --- | --- |
| 1 | 34 ms | 34 / 73 ms | 34 ms | PASS: all six rows |
| 2 | 34 ms | 34 / 86 ms | 34 ms | FAIL: home spawn 38 ms only |

The second run's home-spawn max was 177 ms. Its Sky travel, drive and
interior rows passed. These are normal shared-load readings: one-minute
load was 15.58 -> 27.83 for run 1 and 27.83 -> 15.93 for run 2. No clean
quiet-window claim is made. Raw callback/rAF frame samples stay in
scratch; `plain-summary.json` preserves every row and verdict.

Long-frame attribution remains coarse hook overlap, not exact task CPU.
Run 1: world 2 frames up to 73 ms, play 64 ms, activation 73 ms, afterPlay
58 ms. Run 2: world 86 ms, play 71 ms, activation 66 ms; no afterPlay
frame exceeded 50 ms. A four-ms yield budget does not prove every
indivisible operation is below four ms. Those task margins remain open;
the Opus warm-up owner received both measurements. Shader policy is
unchanged.

Official map: tiles `7617343b`, pixels `a3d5aa3b` identical to the parent.
All six official physics products compare exactly. The post-hook map
key and pixel checks passed before the atomic source landing.
