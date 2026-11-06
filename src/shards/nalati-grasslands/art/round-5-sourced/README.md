# Nalati round 5: sourced CC0 / CC-BY assets

2026-09-23. The user approved free **CC0 and CC-BY** 3D assets and a Nalati download budget of about 25 MB on
desktop (ask N8). This round searched the free libraries for assets that fit the painterly target
(`round-1/1-art-style/style-B-painterly.jpg`, `round-4-camp-9angle/sheet-mockup-3x3.jpg`), rendered the
candidates in headless Blender (soft warm key, cool fill, rim, 3/4 view), and optimised the chosen ones into
`public/assets/nalati/sourced/`. **Nothing is wired into the game.** The model owners decide what to adopt.
Credits and CC-BY attribution text: `public/assets/nalati/sourced/CREDITS.md`.

## Sheets

| file | what it shows |
|---|---|
| `sheet-trees.jpg` | conifer candidates: MegaKit pines (textured) against Quaternius 2020 / Ultimate Nature, Kenney, KayKit, Poly-by-Google spruce |
| `sheet-ground.jpg` | grass, flowers, ferns, bushes: MegaKit against Poly Haven shrubs, KayKit, Kenney |
| `sheet-rocks.jpg` | MegaKit rocks and pebbles against Poly Haven scans (rock_09 / 07, rock_face_01 / 02, namaqualand boulder, stone_01, rock_moss_set_02), KayKit, Kenney, Ultimate Nature |
| `sheet-animals.jpg` | Quaternius animated animals, sheep, horses, eagles, hawk, birds |
| `sheet-camp.jpg` | tents, Fantasy Props MegaKit, village fences and wagon, saddle, firewood, Poly Haven pots, bowls, baskets, stool |
| `sheet-adopted.jpg` | **the shipped files**, rendered from the compressed GLBs after decoding them. This checks the optimisation: skinned animals are posed at frame 12 of their first clip |

Tile labels give the triangle count and the native height in glTF units. Several Poly Pizza animals are
authored far above real size (see Scale).

## Shortlist: what shipped, and where to adopt it

Desktop bytes are the `.glb`. Phone bytes are the `.phone.glb`, which halves textures to 512 px; files
without textures have no phone variant. Tris are for the whole file.

| file | tris | desktop | phone | licence | adopt where | verdict against the painterly target |
|---|---|---|---|---|---|---|
| `trees/megakit-pines.glb` (Pine_1 … 5) | 17.6 k (1.6–5 k each) | 478 KB | 388 KB | CC0 | spruce owner (gully, camp tree line, near slopes). Pine_4 / Pine_5 are the tall narrow Schrenk-spruce shape of the mockup. | **Best fit.** Painted alpha-card needle clumps, gradient bark, 7–10 m native. Instance them. Tint the foliage darker and bluer for Picea schrenkiana, and give distant stands an impostor. |
| `trees/megakit-deadtrees.glb` (DeadTree_1, 3) | 12 k | 377 KB | 265 KB | CC0 | kurgan field at dusk, lightning snag, gully | Fits: a painted grey-violet bark silhouette. Use sparingly. |
| `ground/megakit-grass.glb` (Common Short / Tall, Wispy Short / Tall) | 1.6 k | 32 KB | same | CC0 | grass owner (B1): near-field hero clumps and verges, and wispy gold grass on the dry slopes | Good. Wide, soft, curved blades with a root-to-tip gradient, which is exactly lever 4. Native height is 1.3–1.9 m: scale to 0.3–0.5. |
| `ground/megakit-flowers.glb` (Flower_3 / 4 group and single, Plant_7 (+Big), Clover_1 / 2) | 4.5 k | 264 KB | 175 KB | CC0 | dressing: flower drifts. Flower_4 (yellow) for the buttercup drifts, Plant_7 (purple) as a low violet mat. | Good as a painted style. The species are generic (pink lily, yellow bell); purple sage and edelweiss are still missing, so keep the painted alpha cards for those. Scale to 0.2–0.35. |
| `shrubs/megakit-bushes.glb` (Bush_Common, Bush_Common_Flowers, Fern_1, Plant_1 (+Big)) | 3 k | 362 KB | 230 KB | CC0 | dressing: shrubs around boulders and gullies, ferns under spruce | Bush_Common_Flowers and Fern_1 fit. Bush_Common is autumn red: hue-shift it to green, or use it only for autumn / sunset accents. Plant_1 is a tropical bromeliad. It doesn't fit an alpine meadow, so skip it. |
| `rocks/megakit-rocks.glb` (Rock_Medium_1 … 3, Pebble_Round_1 … 5, Pebble_Square_1 … 6) | 2.2 k | 191 KB | 114 KB | CC0 | world / dressing (B0): boulders with a moss cap, pebbles on the gravel bars and road verges | **Strong fit.** Painted granite with green moss on top reads as "rocks with moss / lichen colour". 250–520 tris per boulder, so dense scatter is cheap. |
| `rocks/megakit-pathstones.glb` (RockPath_Round_*) | 8.9 k | 256 KB | 218 KB | CC0 | camp paths, stepping stones at the ford | Fits. Round_Wide is 3.5 k tris, so use it near the camera only. |
| `animals/horse.glb`, `horse-white.glb` | 2.3 k | 292 / 290 KB | – | CC0 | creature owner (B4): far and mid herd LOD, and as a rig and clip reference | Faceted flat-colour low poly, not painterly. Its value is the **rig and 13 clips** (Walk, Gallop, Gallop_Jump, Idle, Idle_2, Idle_Headlow, Eating, Attack_Headbutt, Attack_Kick, Death, HitReact L/R, Jump_toIdle). Good enough for the distant herds on the plateau. Too crude for the tamed hero horse up close. |
| `animals/wolf.glb` | 2 k | 257 KB | – | CC0 | wolf pack LOD, the Kokbori pack at range | Same as the horse. 12 clips (Walk, Gallop, Attack, Eating, Idle_2_HeadLow …). |
| `animals/fox.glb`, `stag.glb`, `deer.glb`, `dog-husky.glb` | 1.9–3.7 k | 227–263 KB | – | CC0 | ambient wildlife (fox, maral stag, roe deer), camp dog (the husky reads as a tobet / laika) | Same style caveat as the horse. |
| `animals/sheep.glb` | 690 | 54 KB | – | CC0 | camp flock at range | Rigged, but only Idle and Jump. Too crude up close. |
| `animals/sheep-textured.glb` | 894 | 48 KB | 33 KB | **CC-BY** | camp flock | Softer: textured fleece, a better silhouette. Static, so bob and translate it in code. |
| `birds/golden-eagle-perched.glb` | 1.6 k | 73 KB | 51 KB | **CC-BY** | the eagle on the camp perch (mockup master frame), the Qyran trophy | **Good fit.** A painted feather texture on a perched pose. Static. |
| `birds/hawk-flying.glb` | 10 k | 201 KB | 184 KB | **CC-BY** | soaring birds of prey over the plateau, with the `Fly` clip | Fine at a distance. 10 k tris is heavy for a speck in the sky, so a 3–4-bird flock is the limit. |
| `camp/fantasy-props.glb` (Barrel, Bucket_Wooden_1, Cauldron, Pot_1 + Lid, Bag, Pouch_Large, Rope_1 / 2, Stool, Bench, Banner_1 / 2_Cloth, FarmCrate_Empty) | 13.7 k | 985 KB | 477 KB | CC0 | POI owner (B5): camp clutter by the yurts and the hitching rail. **Cauldron = kazan**, Pouch_Large = saddlebag, Bag = grain / kumis sack, banners → retint as tug / prayer ribbons. | **Strong fit.** Hand-painted trim sheets with soft bevels, the same family as the MegaKit. One file sharing four trim-sheet texture sets (wood, metal, cloth, props), so the whole camp clutter costs a handful of materials. |
| `camp/village-fence.glb` (WoodenFence_Single, Extension1 / 2, Wagon) | 1.8 k | 272 KB | 129 KB | CC0 | the hitching rail and corral fence in the master frame, a cart near the camp | Good. Rough-hewn rail fence, painted wood. |
| `camp/woodpile.glb` | 5.6 k | 142 KB | – | **CC-BY** | stacked firewood by the yurts | Stylised with vertex colour. Fits at mid range. |
| `camp/firewood-logs.glb` | 420 | 10 KB | 8 KB | CC0 | loose logs by the fire pit | Flat low poly. Filler only. |
| `camp/saddle.glb` | 1.4 k | 62 KB | 43 KB | **CC-BY** | saddles on the rail and on the tamed horse | It is a western saddle. A Kazakh saddle has a high wooden pommel and cantle and a felt pad. Usable at mid range; ideally reshape it. |
| `camp/ceramic-pot.glb` | 3.6 k | 298 KB | 115 KB | CC0 | clay pots in the FP-front mockup | Photo-scanned. Reads as painted only after the painterly post, so keep it for near props. |

**Totals:** 5.96 MB desktop and 2.46 MB of phone-only variants. With the sheets, the commit is about 9.7 MB,
well inside the 25 MB Nalati budget and the 15 MB commit cap. A phone build that loads everything downloads
about 4.5 MB (the `.phone.glb` where there is one, otherwise the desktop file).

## Scale (native heights, before any scaling)

MegaKit, Fantasy Props, Village and Poly Haven are close to real metres. The Poly Pizza animals are not.
Suggested uniform scales: horse 4.8 → ×0.45 (about 2.2 m to the ear tip), wolf 3.1 → ×0.27, fox 3.3 → ×0.17,
stag 5.8 → ×0.38, deer 5.2 → ×0.3, husky 3.7 → ×0.2, sheep 5.4 → ×0.19, sheep-textured 4.9 → ×0.2,
golden eagle 10.3 → ×0.08, saddle 3.7 → ×0.25. Grass is 1.3–1.9 m and flowers about 2 m native, so scale
them 0.2–0.5.

## How to load

- Every file has one scene. Each asset is a named root node: `gltf.scene.getObjectByName('Pine_4')`. Clone that
  node per instance, or pull its geometry for `InstancedMesh`.
- Geometry is **EXT_meshopt_compression**. Call `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)` from
  `three/examples/jsm/libs/meshopt_decoder.module.js`. Textures are WebP (EXT_texture_webp).
- Static meshes are quantized (KHR_mesh_quantization, handled by three). **Skinned meshes are not
  position-quantized**, because quantizing POSITION broke the skin (spikes on the husky at frame 12). If you
  re-run the pipeline, keep that exclusion.
- Animal clips are the short names (`Gallop`, `Walk` …). The duplicate `AnimalArmature|…` copies were removed.
- MegaKit foliage and grass use alpha-mask cards. Set `alphaTest` and `side: DoubleSide`, and put the
  painterly shader on top.
- Pipeline (reproducible): the scratchpad build script merged each pack, then ran dedup, prune, resample and
  weld, WebP-resized the textures to 1024 / 512, and compressed with meshopt `high` (skin-safe variant for
  rigs). Sources: the Quaternius itch.io zips, Poly Pizza `static.poly.pizza/<uuid>.glb`, and the Poly Haven
  API 1k glTF.

## Looked at and rejected

| candidate | licence | why not |
|---|---|---|
| **A yurt / kiyiz üy** | – | **Nothing usable.** Poly Pizza "yurt", "ger", "nomad" and "tent" return huts, A-frame tents and a tipi. Sketchfab has CC-BY yurts, but downloads need a login and API token this session doesn't have. Keep the procedural yurt (POI owner). Other routes: the image-to-3D track (N8, TRELLIS 2), or the user fetching a Sketchfab CC-BY yurt by hand. |
| Quaternius Tent (poly.pizza/m/5Q7qIrfDxA), Kenney tents | CC0 | Modern camping tents, the wrong culture. |
| Kenney Nature Kit (329 GLB) | CC0 | Flat-colour, very low poly, candy palette. Opposite of the painterly target. |
| KayKit Forest Nature Pack | CC0 | Smooth gradient-atlas blobs (a mobile-cartoon look). Rocks are grey primitives. |
| Quaternius Ultimate Nature Pack (2019) | CC0 | Flat-shaded facets. Superseded by the MegaKit. |
| Quaternius Textured Stylized Trees (2020) | CC0 | Predecessor of the MegaKit pines. Its FBX / OBJ don't bind the leaf texture on import (they render white), and the MegaKit versions are better anyway. |
| Quaternius Farm Animals (2018) | CC0 | About 700-tri blocky horse and sheep. The animated animal pack replaces them. |
| Quaternius Wolf / Sheep (poly.pizza XU7oNeKShV, rgJXF570ZK) | CC0 | Minecraft-style cubes. |
| Poly Pizza "Bird" / "Pigeon" (Quaternius) | CC0 | Cartoon mascot birds. |
| Poly-by-Google spruce (ahT2_ZxtLIq) | CC-BY | 905 tris but a 2048² 4 MB texture, a lumpy faceted silhouette, 16 m tall. The MegaKit pines are better. |
| Robert Mirabelle Eagle | CC-BY | 7 k tris of flat-shaded soaring silhouette, 32 m wingspan native. The hawk covers flight. |
| Poly Haven rock_face_01 / 02, rock_07 / 09, namaqualand boulders, stone_01, rock_moss_set_02 | CC0 | Photoscans: 12–98 k tris, brown sandstone / desert colours, 2–5 MB per asset at 1k. They clash with the painted look, and the repo already ships rock_moss_set_01. rock_face_02 (layered, mossy) is the only one worth a second look, for the Crags, behind the painterly post. |
| Poly Haven shrub_03 / 04, fern_02, dry_branches | CC0 | Photoreal thin-stemmed plants, 6–27 k tris each. Invisible at the painted look's scale. |
| Poly Haven jug_01, wicker_basket_02, wooden_bucket_02, barrel_03, folding_wooden_stool, brass_pot_01, wooden_bowl_02 | CC0 | Floral porcelain jug / oil drum (wrong culture), 7–18 k tris for small props, or a 13 cm bowl that cost 546 KB. The Fantasy Props MegaKit covers these. |
| Poly-by-Google rabbit (for a marmot) | CC-BY | Wrong animal. No CC0 / CC-BY marmot found. |

Not searched further: ambientCG and Poly Haven *textures* (the painted-texture agent owns textures) and
Poly Haven HDRIs (the painterly sky replaces an HDRI).
