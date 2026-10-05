# SF58 — untrusted shardfile admission

Source is complete through `55a0ee50d`. The coordinator owns the final serialized gate/push and plan closure; this receipt does not substitute for that gate. [receipt.json](receipt.json) records the proof pins, commands and numbers. [focused.txt](focused.txt) is the clean `55a0ee50d` test output.

| Gap | Implementation and witnessed refusal |
| --- | --- |
| 1′, 7, 8 | `ef9add963`, `8be956ece`, `31271762a`, format `c0448247f`, `1463b1e92`: shared manifest-first bounds, 2,000,000-byte source/cache/inline cap, 256,000,000 distinct wire bytes; collection/text caps, descriptor-safe JSON, iterative dependency traversal. Reachable and orphan valid-hash 3 GB declarations make zero asset requests. Headerless network, filesystem and cached inputs refuse actual over-cap bytes. An empty compatibility adapter invokes no authored version getter. |
| 1 | `3b4605525`, `b511c5fda`, `0f53e850f`: every file belongs to a library/critical/tile/far root; LUTs join the charged library; exact commons wire declarations and actual admitted lengths rechecked. Orphans refuse before reads/copies. |
| 2 | `ddb84d917`, `761427563`, `dbaacea92`, `12fe1d897`, `9c3c33b31`: separate Node worker, parent/worker watchdog, aggregate input command cap, atomically published completed ticks, exact checkpoint resume. A blocked ten-second query is preempted; unfinished state/effects stay private. Validation is terminal so temporary walk colliders cannot perturb a later tick's allocator. |
| 3 | `e5fb0f2d6`, `55a0ee50d`: trusted catalogue quantity/policy; durable entitlement keyed by stable instance/shard/reward, atomic grant/fact/entitlement, shard-scoped feats. Revisions, renamed facts, reload and New game cannot regrant; copies remain independent. 1,000 capped outcomes retain one profile fact and one native receipt, including pending storage. Exact 600-tick restored suffix remains identical. |
| 4 | `9f1a0f35d`, `888e8d87e`: 1,285 deterministic valid/mutated/truncated GLB/KTX2/WAV/terrain cases; finite binary positions, index/component bounds; admitted geometry constructs/steps/snapshots/disposes in independent Rapier worlds using one WASM module. |
| 5 | `488ebafcc`, `1d1037a9c`: inert bounded SVG only, inline `data:` or admitted charged-library hash, no active/network resources. The pure dimension helper bills decoded/GPU raster expansion once per owner; duplicate refs deduplicate. Template 390×844 explicitly adds the approved 2,633,280 bytes, without a cap raise. |
| 6 | `2305010d7`, docs `39b05446f`: admitted-position/index-derived advisory raster layers, blended/masked split, conservative node/instance stacking. Same-size two-triangle stacks increase the estimate; coordinate scale does not. O(1) traversal scratch; no pixel/occlusion promise or admission cap. |
| 9 | `5942395a7`: first-party slugs refuse outside products; actual external load/save paths bind SHA-256(origin, slug) identity. Legacy empty fixture/projection helpers have no production boot callers; external production boot uses product admission. |
| 10 | `49170e085`, `a12b825396f03085e48b4921cd811263ee55b496`, cancellation `43d367ce7`: per-page allocator product leases reserve source/wire before reads, deduplicate admissions, pin active consumers, evict unused entries and release unpublished refusals/published regions. Quota refusal preserves the previous claim. |
| 11 | `4413b76d3` … `aa9160d1e`, guard `7118d4c81`: actual author-facing inventory, shop, completion, settings/feedback, HUD/TouchControls, loading identity, title cards and Explore render names/labels through text nodes. DOM shape, CSS, actions and trusted icons stay the same. Typed DOM-sink guard has 33 fixtures and no debt allowance. |

The clean focused suite is **17 files / 117 tests green**. The broader parallel CLI policy run was **626/628 files, 3,936/3,938 tests**: the real SDK build, terrain and watchdog files passed with no deadline failures; the two unrelated failures were the drafts atlas and the generated real-tree graph, owned by their respective lanes.

The packed `1463b1e92` SDK installed with no repository workspace aliases: **27 public modules** pass strict consumer types, two outside-project builds are byte-identical (**550 files**), and the real CLI/worker validates **60 ticks / 92 lanes / 46,094 capsule steps**. Packed declarations carry their third-party/ambient closure (`4c41c2d9e`). To repeat: export the committed tree, link dependencies with `scripts/link-node-modules.mjs`, run `node scripts/test-sdk-distribution.mjs --keep`, copy [installed-worker.mjs](installed-worker.mjs) into its printed consumer directory, and run it there. Worker proof covers exact native replay, aggregate overflow refusal, terminal validation and deterministic admission. Tick timing in the JSON is advisory.

Policy clarification approved by the coordinator: CI/offline validation never passes or fails on contended wall time; it enforces deterministic limits and reports timing. Runtime workers enforce the declared wall deadline, with a bounded first-touch allowance. The template declares 5,000 µs to cover the measured ~1.1 ms Mac maximum and the documented ~2× phone throttle. Overdraw is a conservative pre-camera advisory, not a replacement for actual rendering measurements.

No HUD look/layout/control change, new rendering family or asset look was introduced. SF58 has no G51 content exception. Signed manifests/first-party allowlists remain the plan's MMO note (G41). No owned browser, server, Simulator, gate or push remains.

## Council-3 follow-ups: declared commons costs and raw graph limits

`b46c74540` defines the exact, bounded `commonsCosts` table; `9aa8527d9`
(sp-x5) wires the main format and SDK facade. `66661398d` and `14b2de582`
migrate the existing nonempty fixtures without changing assertions.
`232ddac08` derives selected commons wire and residency metadata from pinned
bytes again, refusing mutated pins rather than trusting catalogue numbers.
`f303e1a64` checks declared transitive bundles and the worst-location envelope
before immutable cache reads, hashing or network requests; actual admitted
header costs must then equal every declared commons cost field.

The eight admission fixtures prove zero reads on an over-envelope or malformed
cost table, exact header equality, eleven distinct downloads with a local alias
sharing its admitted bytes, and a forged stream cancelled at its declared wire
bound. Four focused files passed 37 checks; ten broader admission/format files
passed 90/90. The missed product-lease fixture is separately 7/7 green.

`76bda4045` caps untrusted raw graphs before typing: 64,000 UTF-8 JSON bytes,
depth 64, and all 160 nested nodes, including unreachable nodes and loop bodies.
It refuses accessors/cycles without invoking them. Eighteen graph checks include
256 deterministic parser/compiler mutations. Trusted built-in presets keep
their separate compile budget; material content cannot supply that override.
`aa49543c2` (sp-x5) records this actual contract in SHARDFILE.md.

These source steps ride the coordinator's serialized clean gate and push; they
do not widen a policy budget, historical allowance or ratchet ceiling.
