# Pearlglass Medusa DI-N17 — source checkpoint

Status: authored candidate, **not admitted to Arena and not quality accepted**.
Only this folder was edited. No shared catalogue, engine, runtime, store, reward,
or production asset was changed.

## Authority and construction

Read the approved `pearlglass-medusa-hero.png` pixels first. The Explorer and
corrected World sheets informed hidden sides only; their geometry is approximate.
The candidate is a closed, hollow scalloped bell, sixteen connected-looking ivory
radial ribs, an amber core/crown, ten small amber fronds and eight physically thick
ribbon tentacles carrying recessed ivory barnacles. There are 4,644 triangles,
27 own bones and ten packed parts. Ribbons have 1,152 blended vertices; no vertex
has more than two influences. No flat sprites or placeholder primitives remain.

Palette is opaque faceted pearl/mint/coral with warm amber internals. “Glass” here
is the approved pastel facet treatment, not an unimplemented transparency promise.
Current visual limitations: the bell has stronger stepped scallops than the hero;
ribbons have regular faceting and sharp lower tips; barnacle spacing is regular.
The static source renders are not native-engine lighting or gameplay evidence.

## Coordinate and flight decision

The producer authors +Y up, +Z front. Blender is `(x,-z,y-3.35)`, a proper rotation
and deliberate origin translation. Native geometry and absolute binds use the
same origin: **body/core at y=0**, not a standing-creature root below the tentacles.
GLB contains its own real 27-joint skin; native animation does not reuse Blender
bone orientation channels.

Inspected `AnimalSim.place/fly`, `FlightMotion`, `DiverBrain` burst behavior,
Far Reach flight body/species rows, `numericCreaturePose`, and `RigidCorpsePose`.
`medusaBehavior.ts` prepares the existing native burst-diver/flight body contract,
with no new engine exemption. Scale .35 yields an approximately 1.49 m tall,
1.40 m wide creature. Existing burst target root height is 1.2 m. An actual weighted
THREE pose sweep over 41 live attack/hit frames gives minimum y **0.09895 m** and
maximum y **1.65496 m**, with no authored root translation. This is a posed geometry
measurement at the real contract height, **not** a fight/contact replay.

**Death is a verified admission blocker.** Existing standard `FlightMotion` lowers
the dead root to floor y=0. Replaying that implementation with the actual weighted
rig/death pose over 121 fixed steps reaches minimum vertex y **-1.1920 m**. Keep
`sharedArenaEnabled: false`. The numeric clips contain rigid transforms only and
are accepted by the existing rigid-corpse animation classifier, but an actual
physical corpse body/shape integration is still required. Do not “fix” this by
lifting the root, exempting collision or raising global flight height.

Current AnimalDims describe the core hit volume; full bell/corpse hit volumes are
not accepted. No death/contact/phone performance or visual score is claimed.

## Reproduce

- `blender -b -t 2 -P art/driftwood-isle/approved-pearlglass-medusa/build_medusa.py -- --out art/driftwood-isle/approved-pearlglass-medusa/v2 --render-dir tmp/pearlglass-medusa-v2`
- `python3 art/driftwood-isle/approved-pearlglass-medusa/audit_medusa.py art/driftwood-isle/approved-pearlglass-medusa/v2`
- `node node_modules/vitest/vitest.mjs run art/driftwood-isle/approved-pearlglass-medusa/native.test.ts --config art/driftwood-isle/approved-pearlglass-medusa/vitest.config.ts`
- `python3 art/driftwood-isle/approved-pearlglass-medusa/prepare_review.py`

Five focused tests pass: actual packedCreatureBodies typed roundtrip, fresh
ownership/normalized skin, supported numeric behavior and stable death, live
weighted floor bound, and retained rejection of standard flyer death. Python
audit verifies finite/nondegenerate triangles, exact typed packing, actual GLB
skin names, closed expected components with positive volume and no nonmanifold
edges. Hollow barnacle mouths intentionally have boundary edges.

## Retained failures and evidence

`first-pass-source.py`, `v1/` and `failed-first-pass-hero.webp` retain the first
standing-origin, insufficient underside-read study. It is rejected. V2 fixes bell
side winding, core-origin coordinates, palette regions and actual lamp aim.
`failed-overbright-hero.webp` retains the overexposed lighting attempt. A denoising
attempt failed because the installed Blender has no OpenImageDenoise; final
renders use ordinary Cycles samples without denoising. The first test launch via
pnpm tried dependency auto-install and failed; installed Vitest was used directly.
A stable-death test initially distinguished -0 from +0; only signed-zero equality
was normalized. Raw captures and failed command logs remain in the named tmp
folders, under the 30 MiB cap; they are not Git deliverables.

Next gate belongs to the coordinator: inspect actual hero/nine source views,
review native/model admission, then authorize isolated game-host integration with
existing physical corpse support. Continue through real birth/approach/strike/
recovery/hit/death/retry and store/reward-isolation tests before Arena enablement.
