# G227 Nalati authored world capture

Source pin: `cd1890836` (includes shared environment/native setup `f0f46f4ba`, nativeGround `e4983946f`).
Run from a clean `git archive` export, linked through `scripts/link-node-modules.mjs`, after `node scripts/gen.mjs`:

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs \
  scripts/bake/nalati-capture.mjs --out=<summary.json>
```

The actual manifest/world installer, original native terrain and production model producers ran in Node. No
second placement builder, cull filter, guessed load delay or rendered substitute supplied the inventory.
The clean-pin and separate working-tree captures produced **identical 119,518-byte reports**:
SHA256 `30bd5b9bea2ce01933be2676f8ecc31aa332a3ce53f89a8bcf777ede0dd74378`.

| Witness | Result |
| --- | ---: |
| Ordered placement rows / copies | 74 / 38,567 |
| Static-candidate copies / hybrid copies | 38,303 / 264 |
| Drawn-into roots / mesh references / unique physical meshes | 29 / 58 / 56 |
| Builder outputs / weld outputs | 2 / 0 |
| Authored registry colliders | 2,747 |
| Mixed-role roots | 0 |
| Page scope counters after disposal | All 15 zero |
| Owned level / physics / render slots after capture | All released |
| Child process exit | 0, normal teardown; no forced process exit |

`summary.json` hashes independent copies of every decoded attribute, index buffer, instance matrix/colour array
and each model's ordered authored poses. It retains invisible meshes and capacity even where the initial
instanced drawer has zero visible copies. Actual async chest, watchtower and other generated GLBs are present.
The original WSTR is 540,483 bytes, hash `8e610bab24eeae2d8fbd710466c99fbaf9f7fdfe721adbbfb218b4f5550855fa`.

Two root aliases matter for packing: the watchtower includes its separately registered stone steps, and the
hybrid Kokpar root includes the separately registered static goals/posts. Capture-local `sourceMesh` identities
make both overlaps explicit; copying each root independently would duplicate these meshes.

Focused proofs: settlement/inventory **6/6**, combined native-ground/world-row fixtures **2/2**, actual CLI
fixture **1/1** (normal exit and scope cleanup). Root strict typecheck and scoped typed lint passed.

This is the real-host inventory slice, **not a complete or admitted static world product**. Static/hybrid
per-mesh assignment, named painterly prop materials and exact atlas textures, combined tile packing, far proxy,
whole-product admission and browser parity remain. Actual props use unnamed painterly Lambert materials;
applying the ground-only `nalati.ground` family to every primitive would lose their look. No live boot path changed.
