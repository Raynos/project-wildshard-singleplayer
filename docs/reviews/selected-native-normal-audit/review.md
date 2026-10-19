# Selected Conch and Mantis native normal audit

2026-10-19. **No new source-normal remediation is needed for either selected preparation.** The Medusa omission does not generalize to these selected payloads. This is an exact read-only data/source audit, not a render, quality score, acceptance, or public promotion.

## Fresh independent check

`check.py` independently parses GLB accessors and zlib/typed packed blocks, without importing either producer. Receipt: `tmp/selected-native-normal-audit/receipt.json`. It verifies every expanded ordered source position, NORMAL and linear base-color component against the native JSON and verifies all six packed attribute arrays against that JSON. It checks source node transforms used here are identity rotation/scale with optional translation. Existing consumer/GPU captures were not rerun.

- Selected corrected Conch: 6,570 vertices / 2,190 triangles; all source NORMAL values retained. 21 triangles have a source-normal/facet cosine below .999, minimum 0.1021281717893707; none opposed or degenerate. These are retained source polygon/triangulation differences, not export loss. Existing host diagnostic's 25 triangles above 1 degree uses a different threshold, so the counts are not contradictory.
- Selected Mantis complete-integrated-next: 9,300 vertices / 3,100 triangles; all source NORMAL values retained. Minimum normal/facet cosine 0.9999999171940773, zero below .999, none opposed or degenerate.
- Neither exact source GLB has a nonzero emissive material. Source generators set linear base colors and roughness (.76 Conch, .88 Mantis), without authored emission. There is no missing source emission to restore. All source materials are double-sided (14 Conch, 10 Mantis); packed primitive sidecar flags do not convey per-material runtime sidedness or PBR response.

## Three Conch identities must stay distinct

1. Original selected-geometry-admission native preparation lacked NORMAL. Its normal-bearing successor already exists at `approved-conch/selected-native-normals/native`; use that exact successor for source-normal-preserving preparation. Its reviewed consumer tests already exercise the actual packed consumer and skin-normal equations.
2. Selected source-normal-bearing preparation is the 2,190-triangle corrected source. The later selected-native-color branch preserves its normals while isolating authored color through an extra channel; do not undo or duplicate that existing work.
3. Public Conch4 is `character-native15-motion4-upper-readable-r2`, sourceHash `e41d1e7600a94074384a00fca22b58f634c060f5eb0458c5d34ec2bf44db6cb8`, native payload `a820f64e2252058c7a02fe3ce551e704e4262990c59b6d28a9b323ee1356d610`. It has 7,338 vertices / 2,446 triangles and 15 parts, with five channels and no NORMAL. It is different geometry, not the selected corrected source minus normals. Its existing faceted native host computes triangle normals downstream. No public4 missing-normal repair or substitution is justified by this audit; selected binds/dimensions/poses cannot simply replace that public product.

## Actual consumer versus actual presentation

`src/game/plugin/geometry.ts` packedCreatureBodies admits generic declared attributes and copies them. It does not generate an absent normal. Both selected six-channel payloads already meet that contract. This confirms the Medusa finding without introducing a global defect claim.

The practice path in `src/practiceContent.ts` explicitly sets `faceted: true`; the applicable low-poly branch of `AnimalFactory.ts` invokes `facetGeometry`. `lowpoly.ts` recomputes triangle normals and applies deterministic default .12 face color gain. The strict `practicePresentation.ts` schema offers no authored-normal/faceting field. Merely adding NORMAL to a packed payload does not promise end-to-end source shading preservation.

Existing selected Conch actual-host evidence already quantifies this transformation: all positions and skin channels survive, while 75 vertices / 25 triangles differ by more than 1 degree and every color component changes. Native Toon/flat shading, tint, roughness and FrontSide differ from the source GLB Standard/double-sided materials. Do not attribute native/source appearance differences, stippling, contact problems or silhouette shortcomings solely to normals. No new host rendering or shadow studies are useful for closing this particular audit.

For Mantis, the stored normals already agree with source triangle facets, so facet recomputation is not evidence of a meaningful normal-direction defect. Color/material/lighting treatment and the geometry itself still require their own independent review; no native visual parity is inferred.

## Exact pins and existing evidence

All exact input/runtime hashes are retained in the machine receipt; key payload/source pins:

- Conch source GLB: `21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a`
- Conch normal-bearing payload: `cfd4a13e900eaea9675c047b73759411eaa6d2f484d2bc110fb32669d9e3d544`
- Conch metadata: `8b5ee001154cf9d781214d97231af3b7ddaf9e97199e7b641fd684cbc754bd58`
- Mantis source GLB: `7630296952be80e40f14c2dc531afde1ed7945b40953322e81e070382681c4a6`
- Mantis payload: `4e16ec3ad543d219277af1410147b7254c27eedefdfc64af1445a83259dfcb10`
- Mantis metadata: `39b710c14cb2f6089d56a5b6f209cad77693720ccd26aa2f41c1cb91542f3370`

Read alongside `conch-selected-native-normals.md`, `conch-selected-native-view.md`, `conch-native-shading-diagnosis/REPORT.md`, `conch-native-color.md`, and `mantis-complete-integrated-independent/review.md`. Existing exact consumer tests are retained in each preparation directory. This audit does not present their earlier runs as fresh runs.

## Action

**No new normal fix, engine change, export rewrite, host render or source-model modification.** Preserve the selected normal-bearing preparations and existing independent-review distinctions. Any future changed model should retain exact GLB-normal/position/color and packed-consumer tests; any claimed source-normal presentation requires actual downstream normal/material verification, not a payload-only assertion. Geometry and motion/readability work remain separate from this closed normal-transport question.

No Git, runtime/model/build/browser/Site operations performed. Only this review, its small checker and ignored JSON receipt were created. Structural checks award no score and do not meet the independent likeness or animation/readability target.
