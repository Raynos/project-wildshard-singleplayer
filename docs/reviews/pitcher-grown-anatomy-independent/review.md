# Brine Pitcher: independent grown-fan anatomy review

2026-10-20. Static likeness only. Candidate preferred, **3.4525/5** versus freshly reviewed selected predecessor **3.2025/5**. Neither reaches 4/5. Preserve both and prior disagreements; do not treat this preference as admission or quality completion.

## Scope and independence

I inspected the approved original `art/driftwood-isle/concepts/approved-nine-2026-10-19/brine-pitcher-hero.png`, then each of the ten original candidate PNGs, then each of the ten freshly rendered predecessor PNGs, then both supplemental hero PNGs individually. The nine-view set is front, left, right, back, top, elevated-front, elevated-left, elevated-right, elevated-back; hero is an additional view. These are actual model renders, not AI redraws or a contact-sheet-only judgment. The original hero is authoritative; unseen surfaces cannot be established from that image.

This is an independent evaluator but **not a blind review**: task and filenames identify the candidate and predecessor. Required reading of current plan STATE exposed historical headline scores, including the selected Pitcher 3.23. I did not use that number as a scoring starting point, read earlier review arguments, or average prior scores. The fresh 3.2025 predecessor judgment is separate and does not replace its historical 3.23. Construction/source audits inform provenance only, not visual merit.

## Unchanged rubric, no rounding

| Category | Weight | Candidate /5 | Fresh predecessor /5 | Candidate contribution | Predecessor contribution |
|---|---:|---:|---:|---:|---:|
| Silhouette / proportions | 35% | 3.30 | 3.20 | 1.155 | 1.120 |
| Face / expression | 30% | 3.40 | 3.10 | 1.020 | 0.930 |
| Defining details | 20% | 3.60 | 3.25 | 0.720 | 0.650 |
| Facet / style | 15% | 3.65 | 3.35 | 0.5475 | 0.5025 |
| **Total** | **100%** | **3.4525** | **3.2025** | **3.4525** | **3.2025** |

Face/expression means the three pitcher mouths, inner teeth, lips and canopy gesture, not invented eyes or a humanoid face. Improvement is 0.25, not a threshold pass.

## Findings from the originals

- **Hero / front:** The candidate presents green lids and open mouths more clearly. The thick cream scalloped rim is closer to the concept's substantial lip than the predecessor's thin ring with separate needles. However, the concept has broad asymmetric overhanging canopies with visible branching green support beneath them; the candidate reads as three round, upright parasols. Its central pot is still a regular squat vessel on a relatively exposed trunk rather than the concept's large organic hanging pitcher integrated into a tangled tree. Left and right head repetition is too orderly. Both versions retain recognizable three-head hierarchy, burgundy vessels, pale rims, woody roots and sea-growth accents.
- **Left / right:** The candidate lids become nearly edge-on vertical plates on thin stems. This reveals that the improved frontal green presentation has not solved canopy anatomy. The predecessor is excessively shallow and plate-like in the opposite direction. Both retain a long bare rear trunk and angular branch prongs rather than convincingly grown transitions into the pitchers. Root thickness/depth and pot volume are present, so neither is merely a frontal cutout.
- **Back:** Candidate foliage breaks up the trunk better, but the enormous simple lime triangular webs under the lids look like flat braces, not the concept's branching veins/stalk. Back pitcher surfaces remain regular faceted eggs, and supports join abruptly. The original does not establish an exact rear design, so this is an anatomical/style coherence reservation rather than a claim of precise hidden-surface mismatch.
- **Top:** The candidate exposes three cavities where the predecessor mostly hides them under discs. Radial lid facets are more numerous and shaped than the predecessor's few large sectors, but the pinwheel repetition remains conspicuous. The model still reads as a near-planar three-pot arrangement. The approved hero suggests more organic spatial interweaving without establishing a definitive top view.
- **Elevated front:** This is the candidate's clearest gain: substantial cream lips, interior burgundy structures and leaves produce a richer pitcher identity. Yet cream teeth are comparatively uniform scallops, cavities read as manufactured bowls, and the concept's jagged fleshy lip and inward dentition are not fully reproduced. The predecessor exposes mouths but its lids are flattened hovering discs.
- **Elevated left / right:** Candidate cavity depth and lid stems are visible, but skeletal support remains narrow and straight. The predecessor's broad low lids cover more of the mouth. The common roots/rocks remain clean, sparse angular pieces rather than the concept's denser irregular knot of roots and encrustation.
- **Elevated back:** Candidate additional leaf clusters help completeness, while bright triangular canopy backing dominates. The predecessor's bare trunk and simple discs are less resolved. Neither rear arrangement establishes the natural folded/veined canopy continuity visible in the authoritative hero.

The palette and triangular low-poly language are broadly correct. Candidate fan tessellation and thicker lips improve detail/style, but its regular radial lid patterns, repetitive tooth rhythm and uniform pot construction are more procedural than the concept's varied sculptural planes. Barnacles and stones are present, not missing, but placement/scale and branching density remain simplified.

## Framing qualification

The original fixed protocol uses 600×720, orthographic scale 5, target (0,0,2), hero azimuth 28° / elevation 15°. The raised candidate crown is cropped in hero/front and side-level views, and the back crown is cropped too. The predecessor also has clipping in some views, including elevated back. Cropping is not a geometry defect and I did not deduct a separate framing penalty or assume missing geometry was absent.

Both supplemental hero captures use identical scale 6 with unchanged angle, target, lighting and materials. I inspected the full candidate crown there: it really is a taller, circular green fan rather than the reference's asymmetrically broad canopy. This pair supports the modest silhouette gain, not a high score based on a favorable crop. Supplemental images complement, not replace, the fixed nine-angle evidence. They are not at the same framing scale as the original fixed hero and must not be mixed into an unlabeled A/B.

## Independently checked correspondence

I compared source renderer blocks directly: byte-identical text from `if a.render:` through camera manifest writing between candidate and selected predecessor. Both use Cycles, 24 samples, no denoising, Standard transform, identical area lights, ground, camera target/radius, 600×720 output, scale 5 and all ten named poses. Both fresh `cameras.json` files are byte-identical. All 54 entries in the final raw-evidence manifest independently match their recorded byte lengths and SHA-256 hashes. The supplemental script applies exactly the same scale-6 and hero-only substitutions to each source; supplemental camera manifests match.

For each version, fresh-render GLB, native-source, payload, metadata and construction files match the corresponding selected artifact folder by SHA-256. Supplemental GLB/native/payload likewise match that version's fixed capture inputs. The frozen candidate build script matches its editable-checkpoint SHA. These checks establish consistent source/evidence inputs; they are not independent regeneration or cryptographic proof of how pixels were produced. I did not rerun Blender, test native behavior, modify model sources, or make Git/public writes. Remote protection commit `6fe8a68b9f44dbdc7d3072d6f44dd01dafb16d64` was supplied by the coordinator; I did not independently query that remote commit.

## Next useful direction, not acceptance

Keep this candidate as a better static WIP. The next meaningful change is anatomically continuous, asymmetric canopy-and-stalk construction plus less regular pitcher/lip shapes, assessed across the same actual views. Avoid treating more facets, additional leaves, brighter green or fixed camera changes as substitutes. Animation, contact/corpse physics, native rendering, gameplay readability and performance remain **unscored and unverified here**.

## Evidence fingerprints

- Authoritative hero: `39b586abd4d1b956e13d6249311a71ece6ce1669f8fb0443db4ff02703318e76`
- Candidate build source: `dda37399619931c3b09d894c61e17387876116d3eac2b14c9d8cf34594175953`
- Predecessor build source: `34c80f467604fd6ae91c75f9b65d1e12d63de0045ff64596a076f63b27887e8a`

### final

- `brine-pitcher-v1.glb`: `e432ad5c21a3e7ab7e2ee380c1d065868692ea680dbc6adef3db25073b996de9`
- `native-source.json`: `93d08f181778edf158c3b8fcafd0d28c3e6fde789aec6ef260dcc0a0a77c3da2`
- `payload.bin`: `12c6c958a161a57f7dc63b747224f243ea8b5e42074a45203feb853d9f3fa51c`
- `cameras.json`: `e786801cab422130047a2801c8209f907ba44ef943815e5487a779d488f41157`
- `hero.png`: `ddd00b8607a8f03d01bd102461af74db84be756e8aa0d9bc397852e22de64bee`
- `front.png`: `e5b9028e1037e1182109e26bd77bf651ff430131bacf2ba1086c55e69b996a95`
- `left.png`: `124a87c83cef0d2161767bcc192312dad5795033b764c9107c64a062b9b7bed9`
- `right.png`: `9fc3993dee21709e9115fb0f3f45e812c5d3bd0132120ec9adc38e262413bc6c`
- `back.png`: `046088c58a4a7b2673cd0d4d185019b09badeabed4b4106540def3107d5df2aa`
- `top.png`: `159bf8b410765a8782d8c71cc8d009ee8f7f535bdb907d8253d86003f1af8be9`
- `elevated-front.png`: `6469aaee91b0a65721dfb0780a53458e97e89d91548697483d040c06f1d84ebf`
- `elevated-left.png`: `8c12f670f72f10089dc7de4edf73ea5e753702b4f00c28b1e75eab9f657b8229`
- `elevated-right.png`: `a112ce635ce339bccbad1660b8b1604f4278d22d60331b04c7fcee2e120a1292`
- `elevated-back.png`: `64d85922462dd7c3d34b61fe98a9b07d35a1bf9825404a561cd6cf0eb7c5140a`

### predecessor

- `brine-pitcher-v1.glb`: `465657cbdf055d1f1da097a4e4f9e910897942750d5f21cddc89e4f96c46e2c3`
- `native-source.json`: `5230fb109a4d89163e84fff6569a2a6bb1ea5fd402c79fa7be4a14085ac4fecf`
- `payload.bin`: `75823a44e5376318e988ed5c89a504382fe81b2db91edc247952f249495277ec`
- `cameras.json`: `e786801cab422130047a2801c8209f907ba44ef943815e5487a779d488f41157`
- `hero.png`: `3f15866800bd00cc9ea479b15ba8860109f3f1f13e7619a286186e65c132993b`
- `front.png`: `121ea7b3384fdc823bbe9170935c5292ae66e074e886049c6e67a6e145b09b74`
- `left.png`: `a0ee4a4b9e491549e9581f0f32c0cab1af9372474372dc2160e1c9134b7437a2`
- `right.png`: `57bd6ecd48653a788a16ab847701ccf1baa45a5017e41d0b5fe82b42d293d5fb`
- `back.png`: `814fdda84e673c89c074b40dc85e3499e2d558df996a0c58da7af3a0325e7066`
- `top.png`: `4377717d65e29c7c7ae43bf947fc493b8a902e083ca1d62a989913794f745331`
- `elevated-front.png`: `5d10ed8903af3eec9c0afaa6a150bd4e5f6bb82de35508f37fa13fcfee53cd8d`
- `elevated-left.png`: `e0cbe7bbd1d19fd64acf40d28ee01f9eb198a13ec34d9e2dccc126c0baa25ff6`
- `elevated-right.png`: `73f68347bed98b1b4d07054703c4c167e0119d817b95ae3ea3409448bbf4efb6`
- `elevated-back.png`: `6d4dbafe7e285d6b9ebd4b97f4130f172f9ed61895b8cd430cc0d4222e9f152b`

- Supplemental candidate hero: `69ec4fabee13d29c40039ac5646599e2090be2525f39fc64c3f69b3811dae9ba`

- Supplemental predecessor hero: `1cb47012d2084fa99f15e64746d5fefed3c5abee678e7444e48ee69c5ee37f60`
