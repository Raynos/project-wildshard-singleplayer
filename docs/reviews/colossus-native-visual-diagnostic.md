# Colossus V4 native rest diagnostic

2026-10-19. **Source analysis and diagnostic preparation only.** The selected
static model remains V4, independent likeness **3.65/5**. No polish, repair,
material adaptation, animation or runtime admission has been selected here.
No browser, Blender or build was run for this preparation.

## Finding: a local correspondence discontinuity

The pinned `build_colossus_v4.py` root helper changes its guide axis whenever
`abs(tangent.y) > .94`. In `Shin growth -1 living seam` (GLB node 81), the
three stations use Y, X, Y guides. The middle station's tangent Y is −.95541158;
adjacent local U vectors have dot products −.36969998 and −.46045161.

The read-only reconstruction reproduces all 18 unique GLB points within
1.455e−7. All three opposed triangles belong to the second station span
(rings 1→2): side polygons 6, 7, 8; primitive/triangle pairs 0/11, 1/7, 1/9.
Each has a same-stored-normal neighboring triangle on its source polygon.
This is evidence for a folded-side correspondence problem, not justification
for flipping the entire mesh or reversing isolated triangles blindly.

Both spans' shortest aggregate ring connectors occur at cyclic shift 2,
not the original shift 0. That is only an investigative metric. It does not
prove manifold geometry, stable normals, unchanged appearance or a satisfactory
material boundary. **Any repair must remain a separate local candidate**,
preserving the 18 points, both original caps, source material ownership and
all other nodes. Compare original and candidate in the actual game renderer
before selecting one. No repair geometry has been emitted.

Evidence: `art/driftwood-isle/lowpoly-colossus/runtime-admission/visual/seam-analysis.json`.

## Frozen original and appearance blockers

`visual/frozen-inputs.json` records ordinary source, selected V4 evidence and
all preexisting admission inputs as SHA256 plus byte count (38 files,
4,596,980 bytes at preparation). It changes none of those files. The capture
script refuses mismatching pinned inputs. Root owns source publication.

- Source: `f10cdec46537f8d579fa7af687890aebe6c2f0e9d82c962e64a478567e3a0218`.
- GLB: `8c94ed4a452f10ca5c9e1e663c7437c2905e42b90bf5abe9faaf970391a8189b`.
- Native payload: `bfb9cd8333fb8ba2b17209a51126e26cc5c1e56a521627fc68910af86b506e46`.

There are 1,733 stored-polygon/triangle normal deviations below .999 cosine,
including the three opposed triangles. Existing native faceting recomputes
triangle normals and applies .12 deterministic color jitter. Source GLB
polygon normals, Standard material response and native toon lighting therefore
cannot be assumed equivalent even with identical positions and linear colors.
All 15 source materials are DoubleSide; the packed body does not encode that.
The `heartLight`, `heart` and `eye` emission factors are retained in the source
material record, but are absent from the packed body. This is explicit semantic
loss. Do not silently drop it or globally change the engine to hide it.

## Prepared real-host comparison

`visual/diagnostic.ts` uses the real `packedCreatureBodies`,
`mergeAnimalGeometry`, `facetGeometry`, `oneMaterial`, `SkinnedMesh` and
`Skeleton` path. It clones the host material rather than editing the original
opponent's material. The original GLB uses GLTFLoader with its source materials.
Native isolation uses the **12 batch order**, not the 22-bone order; node81 is
in `foliage-leg-1`. This distinction is essential for a correct seam close-up.

`visual/capture.mjs` prepares 14 matched cameras × four diagnostic modes:
source DoubleSide, native FrontSide, native DoubleSide, source FrontSide.
Nine full-body views, eye/heart, two shin views and two isolated seam views
separate overall likeness from local culling. Side overrides are diagnostic
controls, not accepted material adaptations. Source emission is retained.

It uses the unchanged V70 game host's lights, sky material setup and composer,
phone-portrait viewport, muted supported cloud headless shell and burned-in
labels. Both models occupy the same lifted diagnostic origin and camera;
this is a rest comparison, **not an arena/contact screenshot**. The original
opponent and first-person layer are hidden only in the temporary browser scene.
The report records cameras, host preview metadata, passes, lights, material,
errors, file hashes and browser storage. These captures remain **not run**.
No engine, Puffer source/app, production asset or catalogue is edited.

After the coordinator grants a heavy/browser boundary, build the dedicated
bundle under the repository build lease, then run the capture script through
`scripts/browser-lane.sh`. The dedicated Vite config asserts the build lease.
Outputs are restricted to `tmp/colossus-native-visual/`; no Vite dev server.
Inspect all pairs and crop/framing first, retain actual captures, then decide
whether to prepare the separate correspondence candidate or an explicit
material adaptation. Do not label numeric/source tests as appearance proof.

## Rig and remaining admission bar

The 22-joint derived rig has weighted, intersecting roots and foliage, not
welded authored anatomy. Spatial LBS continuity is already numerically tested;
attachment quality under motion remains unproven at torso/shoulder, torso/hip,
neck/mask and palm/digits. Existing unrelated Colossus clips are incompatible.
Matched deformation review, new bind-aware clips, contacts/colliders, actual
combat, nonpersistent reward/retry behavior and phone performance remain open.

## Preparation verification

Three focused Python tests pass: frozen SHA/bytes, repeatable source seam
reconstruction and all native isolation ranges/batch order. Capture JS syntax
passes. Node TypeScript syntax checks pass; this is not a typecheck or
build. The installed TypeScript 7 package does not expose the old
`transpileModule` API; Node syntax checking was used instead. No full suite, render, runtime appearance or gameplay pass is claimed.

```sh
python3 -m unittest discover -s art/driftwood-isle/lowpoly-colossus/runtime-admission/visual -p test_preparation.py -v
node --check art/driftwood-isle/lowpoly-colossus/runtime-admission/visual/capture.mjs
```
