# Captured corpse native terrain/contact fixture

Source: `803359c25722126591ea08c9e4e63872af5b5db5`. This is a controlled CPU-native regression fixture, **not an actual candidate5 gameplay capture**, nonflat gameplay evidence, a terrain-host acceptance test, or a phone-performance result. Its two starting local bone poses, actor velocities, hit directions and damage come from candidate4's recorded `arena-candidate4/solver-study1/replay-case-0.json` and `replay-case-1.json`. Both recorded actor velocities happen to be zero; the unchanged native killing-hit throw produces immediate root linear/angular motion.

The fixture imports the actual `Physics`, `Ragdolls`, `RigidCorpsePose`, numeric-pose admission and Rapier WASM. It opts only the copied recipe into `posePolicy: 'captured'`. No product, engine, default or authoring edits are involved. Original Frame2 geometry has 13,374 single-bone-weighted vertices, eight bones and eight strict hulls with 435 input points. Every observation measures **all original vertices**, rather than trusting a sparse directional hull-support proof.

## Matrix and placement

Two recorded poses × four root orientations × flat, 15° and 26° planes = 24 scale-1 cases. Four extra representative cases use both poses at arbitrary orientation 2 on 26° terrain, each at 0.5× and 2× actor scale. Euler XYZ orientations are `(0,0,0)`, `(0,π/2,0)`, `(0.43,1.13,-0.61)` and `(-0.78,-0.91,1.27)` radians. Recorded root XYZ is retained; only the declared orientation/scale matrix varies.

Each WORLD terrain collider is an actual finite native cuboid with half-extents `(100,2,100)`, friction 0.5 and restitution 0. Its top plane is positioned **once**, using the initial posed mesh minimum, to provide nominal 2 mm initial signed clearance. This is fixture placement, not gameplay terrain/root correction. No per-step floor correction, root lift, padding, velocity bias, geometry change, solver changes or post-hoc threshold adjustments occur. Signed world distance uses the native collider's returned rotation and translation, including f32 quantization. Every vertex's footprint is checked against the finite top face.

## Measurements and checks

- Every 60 Hz fixed physics endpoint measures all 13,374 vertices from actual native root pose and captured bone transforms.
- Render observations call the actual ragdoll pose publisher at every endpoint, each half-step at 120 Hz, every other endpoint at 30 Hz, and explicit alpha-0 interpolation ends. These are common-phase deterministic render observations, not three independent wall-clock gameplay runs.
- Failure threshold remains signed distance below −0.005 m; frozen rest must be within ±0.005 m and meet the existing 0.12 m/s speed/spin criterion. Native MAX_T freezes are identified separately from quiet/sleep and moving/sliding cases.
- All local bone transforms and collider-local transforms/vertices must remain unchanged. Native mass, inertia eigenvalues, damping, gravity and solver settings are checked and recorded. The engine's scale-dependent inertia calculation is retained.
- Each case checks frozen body cleanup, a fresh spawn/dispose retry, and absence of the optional recipe retaining the ordinary single-box body with no fixed-pose ownership. This is body lifecycle evidence, not full gameplay Retry evidence.

Run from repository root:

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs docs/reviews/captured-corpse-terrain/run.mjs
```

`summary.json` records exact input/source/WASM SHA256 pins and outcomes. Each ordinary editable case JSON preserves all measured fixed and render samples, contacts, velocities and failures; no archive or chunk format is used. Each file is capped at 5 MB by the runner. The completed outcome is below.

## Result: failed, do not treat as general contact acceptance

All 28 cases completed on 2026-10-19. **13/28 pass** the combined contact/rest criteria. **5/28 violate the 5 mm penetration threshold**: 21 of 5,577 fixed endpoints and 92 of 25,088 render observations. Render observations include intentionally duplicated rate endpoints; these are observation counts, not unique gameplay frames. Four contact failures are at scale 1 on flat terrain. Their worst penetration is **19.3174 mm fixed / 19.3172 mm rendered** (pose 0, orientation 2). The 2×, 26° representative case reaches **47.0517 mm fixed / 47.0514 mm rendered**.

Eleven cases freeze at the existing MAX_T boundary (301 fixed steps, ~5.0167 s); **ten are still moving above 0.12 m/s**, with final speeds up to 4.7963 m/s. The 0.5× pose-0/orientation-2/26° case freezes **205.046 mm above the plane**, moving at 3.9799 m/s: this is a floating, moving MAX_T failure, not successful rest. One MAX_T case is below the instantaneous quiet-speed criterion but has not accumulated the engine's quiet-time window. The other ten overall failures are moving MAX_T cases; they do not overlap the five penetration cases.

All 28 cases preserve the exact captured bone transforms and collider-local geometry; all mass/inertia/default checks and body cleanup/retry/default-absence checks pass. All vertices remain within the finite top-face footprint (maximum coordinate 21.5794 m against a 100 m half-extent). Initial native clearance ranges from 1.97063 to 2.02316 mm because the terrain transform is stored as f32. None of these findings changes the engine or widens a threshold.

### Preserved penetration failures

| Pose | Orientation | Slope | Scale | Worst fixed (mm) | Worst rendered (mm) |
|---|---|---|---|---|---|
| 0 | 0 | 0° | 1 | -11.4063 | -11.4064 |
| 0 | 2 | 0° | 1 | -19.3174 | -19.3172 |
| 1 | 1 | 0° | 1 | -11.7698 | -11.7698 |
| 1 | 3 | 0° | 1 | -10.6407 | -10.6400 |
| 0 | 2 | 26° | 2 | -47.0517 | -47.0514 |

Each named case JSON retains its entire observation sequence and native manifold distances/impulses. The largest case JSON is 435,863 bytes. No engine/product source, dependencies, browser, Mac, Git state or plan STATE was changed by this lane.
