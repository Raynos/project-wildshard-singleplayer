# E357 F12 proof — 2026-10-01

Rapier upgrade: `18a91b48` (exact 0.21.0). Clean served build:
`18a91b4-mup8i53w`; ANGLE Metal, phone tier. Reference: F11's corrected
`8f711032` walk proof (0.20.0), which predates concurrent F10/S1.1 integration.

| Shard | Colliders (unchanged) | Walk legs / stuck | Largest endpoint difference | Largest maxY difference |
|---|---:|---:|---:|---:|
| Driftwood Isle | 2195 | 8 / 0 | 0.072 m | 0 m |
| Pine Hollow | 2419 | 7 / 0 | 0.141 m | 0.01 m |
| Nalati Grasslands | 2772 | 12 / 0 | 0.072 m | 0.01 m |
| Nine Dragon Stack | 525 | 19 / 0 | 0.129 m | 0.39 m |

Every escape leg has zero out-of-bounds frames. All endpoints remain within the
1 m comparison floor. Nine Dragon's escape-hover-rim peak is 127.99 m against
128.38 m in the paired F11 trace; F11's three repetitions already measured
[128.0, 127.99, 128.38]. No new fall is observed. This single paired maximum
exceeds the 0.3 m floor; the lead must inspect it with the full parity spread.
No baseline, tolerance, rename map or pending board was changed.

All four narrow phone walk/combat/pause/unload checks pass, including Pine Hollow
and Nalati weather cleanup. Their baseline fields are null: these prove runtime
thresholds and the unload census, not exact full fingerprint/visual parity.

Clean `18a91b48` Vercel-tree gate passes generation, CSS, application/API
typechecks, whole oxlint, ratchet, Vitest and Vite build. Full `pnpm test` passes
bakes/derived copies and 166 files / 1262 cases. Whole app/API/scripts typecheck
also passes. The unchanged physics subset passes 13 files / 49 cases.
Navmesh `--check` exits 0; no baked bytes changed.

The [official 0.21 changelog](https://github.com/dimforge/rapier/blob/master/bindings/typescript/CHANGELOG.md#0210-24-september-2026)
changes low-level step, remove, serialize, debug and raw World constructor
arguments. The game calls World wrappers, which supply the new SoftBodySet.
World.free also frees that set. Package paths, WASM import namespace, bindings
setter and engine calls remain compatible. No API port is required.
Measured WASM bytes (raw / gzip level 9 / brotli level 11):
0.20.0 = 2,196,730 / 735,518 / 537,065;
0.21.0 = 3,292,228 / 1,151,160 / 836,316.

[f12-proof.json](f12-proof.json) holds measurements and SHA-256 provenance.
The eight adjacent `.json.gz` files preserve full walk traces and parity probes.
Decompress them before using the existing comparison script. Raw originals and
logs remain in `/private/tmp/e357-f12/`. Own preview and browser sessions are closed.

Queued to the lead: full trails (5–7 min per shard, over the four-minute builder
wait cap), both-lane/full-tier parity without a rename map, any numeric-only
rebaseline under case 5, and the M1 Simulator memory reading. Driftwood's E354
ten existing trail failures remain separate per B21. No push or pin change.
