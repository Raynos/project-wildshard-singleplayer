# Puffer native export contract

Build-time preparation only. No candidate is visually accepted, no gameplay model
is replaced, and no other enemy is rebaked by these helpers.

## Blender producer

Import `native_export.py` from this directory and call:

```python
export_native_puffer(out / 'brine-puffer.mesh.json',
                     [obj for obj, joint in parts], arm)
```

Call after applying all geometry modifiers and authoring vertex groups, before
join/export. The helper reads final mesh triangles and actual group weights,
not the nominal per-part joint label. Non-armature modifiers fail explicitly.
`Col` may be CORNER or POINT; `.color` supplies linear RGB, never `.color_srgb`.
Coordinates bake object/world transforms and map Blender `(x,y,z)` to game
`(x,z,y)`. Winding is reversed, including the second-reflection case of mirrored
object transforms. Matching corner paint follows the reversed loops.

Each vertex retains up to four normalized influences; unknown joints, negative
weights, unweighted vertices and more than four influences fail. No truncation
or single-joint fallback occurs. Outputs are unindexed triangles with position,
linear color, skin indices, skin weights and zero fur length.

Bone order is parent-first with `body` the first root and `head` present as a
socket. `BoneDef.pos` is the world-space absolute rest head, mapped into game
axes. Native bind rotations are identity. Blender edit-bone orientation is not
exported; Blender pose curves cannot be reused as numeric game poses.

## Rig and animation admission

The intended hierarchy is body → belly → head, with tail and four fins under
body. In this hierarchy a belly scale carries the eyes and mouth along with
the hull. Parent-local head rest translation is absolute head minus absolute
belly. Keep head translation at that new rest value and head rotation/scale
identity during the first inflation proof. Do not retain the old `.43` body
height, `.33` head forward shift, or `1.57` inflation from the rejected rig.

The pure tests prove that a head under belly shares the belly's deformation at
1.00, 1.05 and 1.10 uniform scale, including blended attachments. This is a
mathematical contract proof, not a visual, battle or animation acceptance.
New numeric pose curves and real geometry need independent motion review.

## Packed-body consumer

`pack_native_puffer(data, dims)` returns metadata and zlib bytes for the existing
`packedCreatureBodies` reader in `src/game/plugin/geometry.ts`. The caller must
supply reviewed `AnimalDims`; `bodyY` must equal the new body bind height. The
helper does not guess hit shapes from the full hull or select gameplay tuning.

The returned body key is `brine-puffer.brine-puffer`, matching the current
Driftwood generators. It has hard parts only; glossy eyes are deliberately not
introduced. Attributes are Float32 position×3/color×3/skinWeight×4/furLen×1,
and Uint16 skinIndex×4. Blocks are little-endian and four-byte aligned, with
absolute offsets, no index and no lane shuffle. The filename contains SHA-256
of the returned compressed bytes. Write those bytes at the declared asset
location and feed metadata to the existing reader only during later authorized
integration. The reader returns an `AnimalSpecies` without a new runtime path.

Limits: source JSON ≤5 MB and compressed binary ≤1 MB. This helper writes no
GLB or `.blend` and makes no production files. GLB storage remains the producer's
responsibility. Existing rejected assets stay intact.

## Focused validation

```sh
python3 -m unittest discover -s art/driftwood-isle/approved-puffer -p test_native_export.py -v
```

The tests cover reflected winding, four-way weights, typed packed round trips,
parent ordering, malformed payload rejection and coherent inflation. Run
`validate_native` on each real export and then exercise the actual packed-body
reader before runtime integration. Synthetic tests alone do not prove the
Blender export or game render.

For the real payload proof, prepare explicit candidate dimensions in scratch
(they are codec-test inputs, not gameplay approval), then run:

```sh
python3 art/driftwood-isle/approved-puffer/native_export.py ACTUAL_NATIVE_JSON DIMENSIONS_JSON tmp/puffer-native-codec
PUFFER_NATIVE_SOURCE=ACTUAL_NATIVE_JSON PUFFER_NATIVE_PACK=tmp/puffer-native-codec pnpm exec vitest run test/puffer-native-export.test.ts --maxWorkers=1
```

The opt-in test feeds the real packed bytes through `packedCreatureBodies`,
checks every Float32/Uint16 attribute value against the actual native source,
checks hierarchy/dimensions, normalized four-lane weights, and fresh geometry
ownership. Missing inputs explicitly skip the test; a skip is not codec proof.
The test requires the intended head-under-belly hierarchy. Run it only after
the coordinator grants the test lane. It does not render or establish visual
acceptance, hit-shape tuning, phone performance or gameplay integration.


## Completed V23 codec proof

On 2026-10-18 the real V23 Blender native export passed the existing
`packedCreatureBodies` consumer test: one test passed, zero skipped (9.52 s).
The source has 5,732 triangles, 17,196 unindexed vertices, 35 parts and eight
bones. Native JSON is 2,469,432 bytes; the compressed packed binary is 70,888
bytes. Every typed attribute, hierarchy and explicit test dimension survived
the round trip. See [the compact receipt](native-v23-validation.json) for exact
input/output hashes and the actual commands, distinct from synthetic proofs.

V23's exported bone order is body, belly, tail, finL, finR, rearL, rearR, head.
Head is index 7; future numeric clips must resolve that actual exported order.
The codec test used scratch-only dimensions to exercise the schema; these are
not final hit volumes or gameplay approval. Actual rendered deformation,
numeric pose review, visual acceptance, runtime admission/fight integration and
phone performance remain open. No production model was replaced by this proof.
