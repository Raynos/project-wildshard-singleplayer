# E357 jobs X1–X9 — the sweeps (10-sweeps.md)

One file, one section per job; a builder does **only its own section**. Read `brief-common.md` first: its rules bind you.
Browser runs allowed: the narrow parity check on all four shards after each step (`scripts/browser-lane.sh --max 15 node
scripts/parity.mjs --export=SHA --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses|walk+combat+leak
--out=/private/tmp/e357-JOB/N`); the full two-tier batch is the lead's. The m5 baselines are on `ee0dd78b` (B27);
judge your change against your own before-run. Each job reads its section of `10-sweeps.md` in full, the `01-architecture.md`
sections it cites, the S1–S3 handoffs in `docs/tasks/asks/E357.md` for the systems it touches, and `13-lead-resolutions.md`
(grep its row id). Coordinate shared files over herdr (`herdr agent list` shows who is live). Never commit code that imports
another builder's uncommitted file; check the committed tree with `bash scripts/vercel-tree-gate.sh` (a post-commit hook
warns on ratchet rises). A visible change goes on its wave board (10's section names it): put the before / after evidence
in your handoff.

## X1 — input: actions, contexts, rebinding, buffer + coyote, touch (10 §X1)
Every action and context; key rebinding; the 120 ms buffer + 100 ms coyote (two numbers per shard); TouchControls drawn
from the merged context stack; reserved verb slots; the hoverboard to `#kit/tools/` as a Tool; with X2 the last
listeners onto scopes and the `addEventListener` patch deleted. A HUD change: announce over herdr (AGENTS.md).

## X2 — UI layers, HUD slot bands, registered Bag tabs (10 §X2)

## X3 — boot and assets from the manifest; the chunk layout (10 §X3)
Staged steps, per-shard asset lists (fixes Explore's offline preload on 3 shards), DEPLOYMENT_ASSET_TRIM T3 and the
KTX2 unused-assets fix; Vite 8 `codeSplitting.groups` (three · engine + game + kit · one chunk per shard) and the
build check that no `src/shards/**` plugin module is in the main chunk; the E188 import-retry re-test on iOS 27 in the
Simulator through `scripts/sim-lane.sh` (queue it for the lead if it would take over ~4 min).

## X4 — the animation engine layer (10 §X4)

## X5 — world and look leftovers (10 §X5)
The sky rig + backdrop, the fog-patch registry, the other water bodies on `WaterBody` (after S4.1 built it), one geometry
kit, one AO baker, one LUT loader, one particle pool, one RNG check, the helpers (lin, smoothstep, pan-from-yaw,
loop-at-offset), one skin locker.

## X6 — WebGPU containment (10 §X6)
The renderer type only in `engine/render`; every `onBeforeCompile` site through one shader-patch registry; one precompile.
Pixels and program sources identical.

## X7 — tiers as data, budgets per manifest, tier selection (10 §X7)

## X8 — session health, analytics, capture, strings, flag hygiene (10 §X8)

## X9 — the game-layer extras: travel-ready items, the Wildshard summary, the travel type (10 §X9)
The title deck's summary strip is a Look board item (A / B, decision 76): build both variants as Debug rows, default A,
and put the two images in your handoff.
