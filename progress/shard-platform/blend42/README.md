# G328: the Blender Template's shardfile proofs (op-blend42, 2026-10-10)

Jake approved the filled cell (G328, `art/blender-template/round-3-filled/board.jpg`); these are `src/shards/blender-template`'s
shardfile proofs, on a clean `scripts/serve-build.sh --head` build of `a21816808` unless a row says otherwise.

| Proof | Result | Evidence |
|---|---|---|
| 1 Boot | **PASS** in 2.1 s, frame 12, 0 faults, 0 error reports: SHARD SELECT (Developer) ▸ its card ▸ SHARDFILE, the boot smoke's own `bootCase` | `boot-blender-template.json`, `boot-capture.jpg` |
| 2 Walk | **PASS** 12 / 12 legs, 0 stuck (four entries to the hub, bridge 19.2 m, hall roof, watchtower 28.2 m, stoa roof, amphitheatre top tier, aqueduct + cistern 14.2 m, obelisk dais, ring road on the hoverboard); now in the shared walk set | `walk-blender-template-a218168.json` |
| 3 Witness | **PASS** headless, replay, ledger, boot, grid-ready (6 files, 27 tests, clean export); `compatible: true`, `transitional: false`, correct: no `runtime/`, no trusted shard code, `shard.runtime` null | `content-gate.json` (milestones) |
| 4 Content gate (G304) | **PASS** after a reporter fix: 80 tiles (64 L0, 16 L1); 150 files (82 glb, 65 platform-decoded binaries = 64 mesh-collision tiles + the door panel, 1 KTX2, 1 card image, 1 wasm); colliders 64 mesh tiles + 1 panel, no heightfield; **0 shard-private binaries**; `structuralWorld: true`; 0 runtime lines, public share 90.2 %, AS 23 lines | `content-gate.json` |
| 5 Regenerable (G320) | **PASS** after the map fix: `build.sh --check blender-template` rebuilds `assets/world.glb` with the **same bytes**; the SDK tarball outside the repo builds a byte-identical product (152 files, `shard.json` sha256 `94c22c09…` = the served build's) and validates; the map is now baked in Node from `assets/world.glb` | `sdk-copy.json`, `map-board.jpg` |
| 6 Frame floor | **PASS** in a push-free quiet window on `731dea27c` (`SERVE_OWNER=op-blend42`). Standalone: desktop 59.9 fps (p95 16.8 ms) at spawn and reversed; Simulator 30.3 fps (p95 34 ms) both. Grid cell (`--grid-scenario=cell --grid-cell=blender-template --devserver`): desktop 59.9 fps on travel, the whole drive (0 frames > 50 ms) and the interior; Simulator 30.3 fps travel and interior, whole drive p95 34 / p99 58 / max 95 ms (2 frames > 50 ms, under the 200 ms gate) | `frame-floor-standalone-731dea27c.json`, `frame-floor-grid-cell-731dea27c.json` |

## Fixes
- **Boot smoke:** with Developer on, a shardfile-only card shows LEGACY disabled; `bootCase` clicked LEGACY and timed out.
  It now enters through SHARDFILE when LEGACY is disabled (`scripts/parity/boot-smoke.mjs`).
- **Content gate:** `scripts/shard-platform-content.mjs` named every `binary` file as shard-private, including the mesh-collision
  chunks, the heightfield payloads and the look LUT that the platform's own decoders read; those now count as
  `platformBinaries`. `look/map.baked.json` (the map's freshness stamp, read by no runtime code) is no longer a private binary.
  Effect on the others: `_template` keeps one real private file (`public/assets/baked/_template/terrain.bin`); Pastel Plain and
  Ink-Cel Valley read `structuralWorld: true`; the ports are unchanged (trusted runtime).
- **Map (G320):** `scripts/bake-maps.mjs` booted the game page. `scripts/bake-map-glb.mjs` rasterizes the shard's world GLB
  top-down in Node (no browser) into the same colour and height passes and runs the same stylizer; `look/map.json`'s new
  `"from": "assets/world.glb"` routes the shard there and `bake-maps.mjs` skips it. The class `match` colours moved to the
  unlit albedo tones; the fills did not. Old vs new: MAE 0.97 / 255 (`map-board.jpg`: the old capture's lit shadow
  specks and the guardian are gone; the light-clay plazas read lighter).
- **SDK pack (S19 path):** `scripts/build-sdk.mjs` broke on HEAD twice: SF79's aliased exports (`./shardfile/moverRuntime`
  → `./plugin/mover.ts`) were read as file paths, and a doc comment quoting `import('./look/render')` was followed as an
  import. It now resolves a specifier through its layer's exports and scans only code.

## Left open
- **Upstream npm, today:** `@loaders.gl/core@4.5.4` (published 13:34 UTC) needs `@loaders.gl/worker-utils@4.5.4`, which is not
  on npm, so a fresh install of the SDK tarball fails until it is (or the SDK pins `@loaders.gl/core` 4.5.3). The outside-repo
  proof above ran with a consumer override pinning `@loaders.gl/core` 4.5.3; nothing else changed.
- **The card JPEG** (`assets/d5ae6929…`, a labelled capture of the real door) is an authored input in the shard folder,
  so it rebuilds, but it was captured from the running game once. Jake may want it rendered from the GLB instead.
