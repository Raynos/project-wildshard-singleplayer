# W2a Pine creature rigs and birds from the product, sp-o288 (2026-10-16)

Reader slice for sp-x6's producer splits (`51f128720` rigs, `fd31bb0f7` birds): Pine's 8 creature hulls and its bird
atlas now load from the built shardfile's named blobs, not public GLBs with embedded maps.

| Commit | What |
|---|---|
| `192f3b3b6` | `riggedHulls` `files` option (SDK): per hull `{ rig, base, normal }` URLs, data only (G454); maps through the new engine `ktx2File(url)`, sampled by `riggedHullMap` as the glTF maps were (flipY false, repeat, anisotropy 4, base sRGB, normal in its file's colour space). Pine `runtime/species/hulls.ts` + `rigs.ts` on `models/creatures/<hull>[.phone].{rigged.glb,base.ktx2,normal.ktx2}`; the 16 public rig URLs left the `rigs` boot stage and the propBase concat. |
| `04540acb9` | `posedAssets` `atlas` option (game): the atlas as its own KTX2 URL, exactly one of `atlas` / `atlasModel`. Pine `runtime/birds.ts` on `models/life/birds-rest[.phone].glb` + `birds[.phone].base.ktx2`; the 2 public bird URLs left the `world` boot stage. The image-free `birds[.phone].glb` is not read (only its map ever was). |

Coat cache: `pineCoatUrl` keeps the rig's original public path, so every coat KTX2 key is unchanged; the test checks
all 16 + 16 keys in `coatPages.generated.json` are still produced (`test/sdk-rigged-hull-files.test.ts`).

Escapes: `runtime/species/hulls.ts` no-shard-host-callback 4 -> 3 (the `rig` callback became data), `rigs.ts`
shard-sandbox 1 -> 0; runtime-standalone / no-build-time-import unchanged (hulls 2 / 2, birds 1 / 1);
sim-in-runtime/pine-hollow 28 -> 28.

Proof (build mirror, `192f3b3b6`): cold `pnpm gen`, root `tsc --noEmit`, `tsc -b tsconfig.layers.json`, sim-in-runtime
green; pine-product-reads, pine-runtime-mirrors, runtime-mirrors, pine-output and the new test pass. The 17
shard-headless checks could not run: `build-shardfiles --reuse` refuses with the known "Import signature outside ABI"
(Template Wasm, sp-x8's fix), so Pine-only builds (`serve-build.sh --rev … --shard pine-hollow`) stood in.

Board (`creatures-a.jpg`, `creatures-b.jpg`; `specimens.mjs` + `board.py`): the Model Explorer, iPhone 16 Pro portrait,
phone tier, a finger held so the turntable stays on its opening angle. Before `4c31416d2`, after `192f3b3b6`, all 8
hulls: they look the same (mean pixel difference 0.5-2.7 / 255 over all 25 variant cards, the idle animation's
timing). After: 0 page errors, 0 console errors, 0 rig warnings, no public rig request, 16 more product KTX2 reads.
Standalone Pine boot (sp-o280's `boot.mjs`, after build): normal play in 11 s, 0 page / console errors, crossbow held,
wildlife draw up, a 7 m walk.

Bird board (`birds.jpg`): the raven, great grey owl, pileated woodpecker and snowshoe hare (one shared atlas and posed
draw) in the Model Explorer, before `192f3b3b6`, after `04540acb9`: the same (mean pixel difference 0.4-0.6 / 255),
0 page / console errors on both.
