# SF57 — PMREM render targets accumulating on every grid circuit

The fix is `5d5769036`. Before it, `640c190` was the parent.

The soak that found it was e632fe913 (`../e632fe913-dev-subset/attribution/README.md`). Labelled GL grew by
**+2 `PMREM.cubeUv` colour atlases and +1 depth buffer, all 336 × 256, every circuit**. That is 1,720,320 B a circuit,
born on the Driftwood → Pine and template → Driftwood legs.

## Cause

`src/shards/driftwood-isle/look/backdrop.ts` is `STYLIZED_BACKDROP`.

- A grid region builds its level's sky backdrop as a layer each time the region is admitted. This is G223 / G232:
  `regionalWorld.ts` → `SkyRig.layeredBackdrop` → `buildRegionSky`.
- When the region leaves, the layer calls `backdrop.dispose?.()`.
- Driftwood's backdrop declared **no `dispose`**. Every Driftwood visit therefore left behind:
  - its live environment target from `PMREMGenerator.fromScene(..., { size: 64 })`: a half-float colour atlas plus a depth
    renderbuffer. The last one was born by the 15 s refresh during the D → P exit leg;
  - its `PMREMGenerator`, whose ping-pong target (a colour atlas) is born on admission, on the template → D leg.
- Disposing the holder scene's `environment` texture, which the scope does, frees nothing of a render target's GL storage.

Pine's backdrop already disposed of its targets. The engine's HDRI path and `DummyStudio` dispose of their generators
right after use.

## Fix

The backdrop has one owner for its environment:

- `dispose()` frees the environment target and the generator, along with its ping-pong, blur and GGX passes. It also clears
  `scene.environment` if it still points there.
- `dispose()` is idempotent. A refresh after it does nothing.
- `gpuBytes()` and `gpuCeiling()` are new: 1.72 MB held, 2.75 MB ceiling. The region's sky claim now charges what it holds;
  before, it charged 0.
- The render path is unchanged.

## Proof

**Node: `test/driftwood-backdrop-pmrem.test.ts`.** It runs six crossings through the real backdrop, `BackdropLayer` and
`buildRegionSky`, using PMREM's real `_setSize` / `_allocateTargets` with the GPU passes stubbed.

- Live cube-UV targets go back to 0 after each crossing.
- Each visit peaks at 2 targets, 1,720,320 B. The census equals what is held, and the claim covers it.
- On the old backdrop the test fails at crossing 0 with 2 targets left behind.

**Chromium (iPhone 16 Pro, muted, Developer on, phone tier, 2×).** Four complete circuits of D → Pine → Nalati →
template-2 → D, driven with `ownedSoakPlans(..., 'prepared')` and the soak's own legs. The `scripts/parity/glbytes.mjs`
census reads after every leg. Raw rows are in `before-640c190.json` and `after-5d57690.json`.

| Settled at Driftwood | before: PMREM handles / MB | after: PMREM handles / MB |
| --- | ---: | ---: |
| start | 3 / 1.720 | 3 / 1.720 |
| circuit 1 | 6 / 3.441 | 3 / 1.720 |
| circuit 2 | 9 / 5.161 | 3 / 1.720 |
| circuit 3 | 12 / 6.881 | 3 / 1.720 |
| circuit 4 | 15 / 8.602 | 3 / 1.720 |

- After the fix, every leg repeats exactly: Pine 2 / 3.146 MB (Pine's own), Nalati 0, template 0, Driftwood 3 / 1.720 MB.
- Before the fix, Chromium reproduces the iPhone soak's +3 handles and +1.720 MB a circuit exactly.
- Both runs had 0 page errors and 0 route failures.

**Pixel diff.** `pixel-diff.json`, `side-east.jpg` and `side-north.jpg` cover two fixed poses at the Driftwood home
reference (east and north), after circuits 1 and 4, with Time of day set to midday.

- Before vs after: mean |Δ| is 0.17–0.28, and 0.45–0.77 % of pixels differ by more than 8.
- Noise floor, the same build at circuit 1 vs circuit 4: mean |Δ| is 0.81–3.53, and 4.4–26.4 % of pixels differ by more
  than 8.
- What differs is weapon sway, palm and foliage sway, water ripples and the overlay's text. The sky, the dome and the
  environment-lit surfaces are identical.

**Also run:**

- `scripts/test-facade-instancing.mjs` on the fixed build: PASS, desktop / phone-tier / iphone-desktop-quality.
- Full vitest on a clean export of `5d5769036`: 5305 passed, 7 failed, all of them `test/map-coverage.test.ts` (SF66
  baked-map entries), which this change does not touch. In the shared working tree that file passes; there the failures
  are others' work in progress.

## Reproduce

These two scripts are the reproducer. The screenshots are not committed.

```
scripts/serve-build.sh --rev <sha>
scripts/browser-lane.sh node progress/memory/sf57/pmrem/drive.mjs --base=http://127.0.0.1:<port>/ --out=<dir>/after --circuits=4
python3 progress/memory/sf57/pmrem/compare.py <dir>    # expects <dir>/before and <dir>/after
```

This is Chromium. It is not a WebContent or iPhone reading, and it says nothing about the separate +197 MB of WebContent
growth (sp-x3's diagnostic).
