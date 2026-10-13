# Sky grid-ready construction

C1 remains **OPEN** until two plain `far-reach-road-entry` Simulator runs
meet travel p95 <= 35 ms. This slice bakes keeper fit/partition and paces
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
