# Rendering and physics rules

Linked from [AGENTS.md](../../AGENTS.md). Moved from AGENTS.md by E423 (2026-10-03), plus the traps that already cost hours.

## No facade multi-draw anywhere (E271 / E272)

- **Facade multi-draw is prohibited across the baseline, every shard, every quality tier, and every platform.**
  Jake explicitly made this global on 2026-09-28. Do not narrow it to iOS, mobile, Nine Dragon, or a default setting.
- Read [the permanent incident and evidence](../audits/nine-dragon-mobile-multidraw.md) before changing facade
  rendering, batching, `BatchedMesh`, `WEBGL_multi_draw`, shader preparation, or memory policy. The facade batching
  implementation, shader branch and toggle were removed. Do not reintroduce them, create another toggle, rename the
  same path, or move it into a shared helper. Use instancing and preserve the scene's visual content.
- Extension support, a Simulator pass, a desktop benchmark, lower draw-call counts and JS heap readings did not
  establish safety: an actual iPhone killed WebContent after multi-GB allocations while the Simulator stayed below
  1 GB. New rendering optimizations require physical-device memory/stability evidence as well as local tests.
- `pnpm test:gpu-boot` includes `scripts/test-facade-instancing.mjs`: it requires the actual facade to stay instanced
  with multi-draw available on desktop, phone tier, and an iPhone using desktop quality. Keep this regression check;
  do not weaken it to make an optimization pass. Memory targets remain 1.8 GB loading / 1.0 GB Explorer (decimal).
- **A risky rendering or memory change** (batching, multi-draw, texture or memory policy) ships **default-off behind a
  Debug row** until a physical-device reading backs it (E423 decision 6). It is the one exception to "no phone checks".

## Loading work and diagnostics

Code-built geometry still costs CPU, allocation and upload. Prefer deterministic
bakes and workers; slice unavoidable runtime work and report completed units within
long steps. The loading screen owns its clock, identity, bytes and current wait from
first paint. SF67 targets tasks below about 100 ms, with tasks above 50 ms attributed
in a separate cold/warm SHARD SELECT benchmark. A frame-floor pass does not prove
loading responsiveness, and a Chromium emulation result is not Safari evidence.

"Models as code are cheap" does not hold at load (E461 audit: Driftwood's world 3.3 s, Nalati's 5.4 s at 4× CPU,
warm too). Any world-build output that is a pure function of committed files is baked by a Node baker that runs the
page's own functions, listed in `scripts/bake-check.mjs` so a source or asset change without a rebake fails the gate;
the page keeps the code path only as the fallback when the bake is missing or does not fit (first: Driftwood's cove
cover splat, `scripts/bake-island-cover.mjs`). Bakes are per tier when the output depends on the tier.

Debug instruments are gated work: ordinary boot fingerprints are lazy, and the GPU
allocation journal is Developer/census-only. Preserve harness evidence without making
its scene walks, task observers or resource journals unconditional production work.

Texture policy follows memory admission, not a blanket images-first rule. With Auto,
a measured images-first phone estimate above the playing cap selects KTX2 on the first
visit (G188); an explicit Debug choice takes precedence. The cache-marker fallback
still applies where no tier policy selects a mode. Configure final samplers before
upload, retain compressed mips until the first successful real draw, and reject an
unresident clone without upload data. Cache presence alone does not prove GPU residency.


## Physics (Rapier)

- **`src/engine/physics/` owns collision.** It is the only code that imports Rapier. Nothing else hand-rolls a collision test:
  no ray-vs-box maths, no terrain bisection, no push-out loops. Ask the queries: a shard imports `castRay`,
  `castSegment`, `lineOfSight`, `floorBelow` and `sticksIn` from `@wildshard/engine/physics/query`; engine code also has `sweepBall`
  (`src/engine/physics/query.ts`). Engine code gets the world from `app.physics`; `activePhysics()` is a legacy
  singleton the `wildshard/no-active-singleton` ratchet is retiring. `heightAt()` stays for placement and drawing only.
- **A new static thing collides by registering.** The builder emits `ColliderDesc`s (`boxDesc` from `@wildshard/engine/world/registry`) beside
  the geometry it draws:
  - box / capsule / ball / hull;
  - `treads` for any stair: rise ≤ 0.35 m and tread depth ≥ 0.36 m, or the capsule rides the edges;
  - trimesh only for walk-inside shapes.
  A shard registers it with `ctx.piece({ id, name, category, file, object, colliders, surface, floor?, active?,
  model? })` in its plugin's `world` hook; the piece leaves with the shard's scope. Engine code registers with
  `app.registry.add(…)` (`WorldRegistry`, `src/engine/world/registry.ts`). A moving piece `follows` its Object3D, which
  puts it on a kinematic body; a door is a piece whose `active()` is false while it is open. `model` puts it in
  Explore's catalog: it is the one registry, so never register a built thing a second time for Explore. The old
  `player.colliders` bridge is retired (F11).
- **The player walks on colliders.** Step 0.35 m, max climb 40° (the user's picks). A walkable surface needs real
  geometry. A path over a crag is graded into the terrain (`TerrainSpec.graded`, never inside the Blender cove's
  baked area); a steep one gets a walkway from `pathRampDescs` (`@wildshard/engine/physics/paths`). After changing a builder's colliders, re-run
  `node scripts/physics-baseline.mjs --no-build --mode=walk` (and `--trails`): 0 stuck is the bar. If structures
  moved, re-bake the navmesh (`node --experimental-transform-types --import ./scripts/bake-loader.mjs
  scripts/bake-navmesh.mjs`; `--check` tells you when it's stale).
- **Moving things** go in the fixed step: a system in phase `'fixed.pre'`, `'fixed.step'` or `'fixed.post'`
  (`ctx.system` in a shard; 60 Hz, hit-stop slows it), interpolated with `game.alpha`. Dynamic bodies go through
  `activeBodies` (`@wildshard/engine/physics/bodies`), which enforces the per-tier caps (phone 40 awake /
  2 ragdolls).

## Traps that already cost hours

- **Blocky black squares** in a frame are one NaN pixel smeared by the mip bloom. Render plainly into a FloatType target,
  count NaNs with `readRenderTargetPixels`, and bisect by hiding scene children. Past culprits: a splat shader's 0/0, and
  height fog's `exp()` above ~1.4 km of camera height.
- **`pow(x, y)` with a negative `x`** works on every Apple GPU but is NaN (black) on Chrome for Windows (ANGLE D3D
  computes `exp2(y * log2(x))`). Square by hand (`d * d`) or clamp the base. Reproduce on the Mac by injecting
  `#define pow(a, b) exp2((b) * log2(a))`.
- **Nine Dragon stores view depth in alpha**: a canvas readback comes out white unless flattened over black. Off-screen
  renders that move the camera call `game.shardFrame()` first.
- **"Importing a module script failed"** on iOS means any failed module download (a 404 or an LTE drop mid-file), not
  necessarily a deploy race. Compare the report's build and time with the deploy runs before blaming skew.
- **Real-resolution game video** needs the canvas itself (`canvas.captureStream(60)` → `MediaRecorder`); Playwright's
  `recordVideo` and CDP screencasts deliver CSS-pixel frames.
- **A new asset outside a shard's asset folder** must be in `bytes.generated` before a capture of it counts: an export
  that copied only the shard folder once scored a council round on a LUT-off game.
