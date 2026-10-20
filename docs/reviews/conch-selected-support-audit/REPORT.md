# Selected Conch support representability audit

2026-10-20. Read-only source audit and in-memory geometry calculations. This report is the only written deliverable. No implementation, physics run, test suite, app build, Git operation, source edit or public write. Read AGENTS.md, current driftwood-enemies STATE (20:20 UTC), the native corpse proposal/resource milestone/independent resource review, and the independent Iguana design correction. This review does not review the concurrent native actor-handoff implementation.

## Verdict

**Selected Conch is not admitted for complete motion/contact. However, neither its 15 joints nor its 94 blended vertices establishes an eight-hull impossibility. Its source point budget permits a concrete eight-group partition with 361 convex extreme points, largest group 84.** The missing contract is coherent anatomical ownership and actual complete motion, not a demonstrated point-budget overflow.

The selected source presently supplies 45 constant-zero rotation programs, not idle/locomotion/strike/hit/death motion. Consequently there is no selected complete-motion sequence whose compatibility this audit can honestly accept or disprove. Old 7,338-vertex canonical lifecycle results cannot supply it. There is also no selected rigidCorpse recipe in the inspected normal/color metadata.

An explicit whole-leg grouping cannot remain genuinely rigid if the existing hinge skin is independently bent at the knee: the precise counterexample below proves that narrower statement. It does not prove that no source-derived set of moving convex proxies could contain the deformed surface. Do not manufacture a generic impossibility or an anatomical redesign requirement from it.

## Exact source and independent verification

All paths below are repository-relative, below `art/driftwood-isle/approved-conch/`.

| Input | SHA-256 |
| --- | --- |
| selected-native-normals/native/conch-character-pass-native.json | 3dddaf6a2845ffea0c372fe46d8d422baaa2864bfaf5cc5f4c4cd98a9faa0929 |
| selected-native-normals/native/metadata.json | 8b5ee001154cf9d781214d97231af3b7ddaf9e97199e7b641fd684cbc754bd58 |
| selected-native-normals/native/payload.bin | cfd4a13e900eaea9675c047b73759411eaa6d2f484d2bc110fb32669d9e3d544 |
| selected-native-color/metadata.json | 99a4920df2bb3fa4368e456b38b40e27e85d905bcccdee8e93776bf0902ae219 |
| selected-native-color/payload.bin | 640861d7e12003814917b45d38d622a3e796084cf0b86bf88d01353ecfdc4cbb |
| selected-geometry-admission/conch-study.glb | 21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a |
| selected-geometry-admission/build_selected_conch.py | ecfcfa03a123b5b81343a96409ed769a7b85be03530c4ef30e2bd56a3ba95a0e |
| selected-native-view/poses.json | b25e8fb107f73d73f6e51acdbacb1be9b2c932375cf9d1e99d96eb73a8708ea3 |

Independently read and counted source JSON, decompressed the normal payload with Python zlib to 420,480 bytes, and decoded all six attributes of all fifteen parts using the metadata offsets and little-endian f32/u16 types. Every component exactly equals its source value cast to the stored type; all fifteen metadata bones equal source bones. These are fresh checks, not inferred from old test logs. Color metadata/payload hashes identify the separate color transport; this audit does not claim a fresh independent color-channel comparison.

There are 6,570 expanded corners / 2,190 triangles, 15 parts/bones, 1,193 globally unique position triples. Multiple positive weights occur on exactly 94 expanded corners: 45 in legLeft and 49 in legRight. All are in the original continuous leg-hinge meshes; armor retains its original rigid weights. Counts are expanded triangle corners, not 94 necessarily distinct spatial points.

| Part | Expanded corners | Distinct points | Convex extreme points | Blended corners |
| --- | ---: | ---: | ---: | ---: |
| body | 744 | 132 | 51 | 0 |
| shell | 1398 | 235 | 79 | 0 |
| head | 606 | 116 | 35 | 0 |
| eyestalkLeft | 339 | 66 | 30 | 0 |
| eyestalkRight | 339 | 66 | 29 | 0 |
| shieldArm | 342 | 63 | 29 | 0 |
| shieldForearm | 486 | 89 | 27 | 0 |
| rapierArm | 342 | 63 | 30 | 0 |
| rapierForearm | 582 | 107 | 39 | 0 |
| legLeft | 312 | 56 | 33 | 45 |
| legLeftKnee | 132 | 24 | 23 | 0 |
| legLeftAnkle | 252 | 48 | 30 | 0 |
| legRight | 312 | 56 | 31 | 49 |
| legRightKnee | 132 | 24 | 23 | 0 |
| legRightAnkle | 252 | 48 | 32 | 0 |

Counts use installed SciPy 1.17.0 `scipy.spatial.ConvexHull` on original source positions, without joggling, decimation or new coordinates. This is not a Rapier hull-construction receipt.

## Bind transforms and motion identity

`selected-geometry-admission/export_native.py` declares `game_point(p) = [-p.x, p.z, -p.y]`: the selected character faces -Z. Its provenance explicitly says identity bind orientations and derived attachment stations, not an authored production rig. Stored bone positions are global bind pivots; hierarchical local translations are child minus parent. Source points for a bone-local hull must subtract that owner's global bind pivot, not subtract every ancestor pivot. A child vertex subsequently uses world-bone transform times inverse bind; all four retained influences must be accumulated.

Body pivot is (0,1.04,.05). Shell (.38,1.35,.34) and head (0,1.64,-.365) parent to body. Eye pivots (+/-.16,1.51,-.33) parent to head. Shield upper/forearm pivots are (.27,1.36,.015), (.76,1.04,-.3); rapier upper/forearm (-.27,1.36,.015), (-.69,1.1,-.22). Left leg hip/knee/ankle: (.23,.86,.03), (.69,.63,.17), (.86,.14,-.01). Right: (-.23,.86,.03), (-.69,.63,-.13), (-.86,.14,-.31). Forearms parent to upper arms; each leg follows hip, knee, ankle. Left/right labels follow source side signs, not an assumed screen direction.

The selected view imports `poses.json`; selected color reuses that selected view. Fresh inspection confirms every one of its 45 numeric programs has no reads and one constant-zero node. That contract does not contain independent motion to preserve. The old canonical +Z rig and clips are distinct and cannot be silently substituted.

## A bounded mathematical eight-group candidate, not implementation approval

`src/format/rigidCorpse.ts` permits 1–8 uniquely named bone owners, 4–128 points per hull, <=512 total, finite coordinates within +/-20 and nondegenerate volume. The physical primitive keeps those limits. The following source-derived grouping fits them geometrically before native float32/local-frame construction:

| Proposed owner | Complete source parts enclosed | Extreme points |
| --- | --- | ---: |
| body | body, shell | 84 |
| head | head, eyestalkLeft, eyestalkRight | 46 |
| shieldArm | shieldArm | 29 |
| shieldForearm | shieldForearm | 27 |
| rapierArm | rapierArm | 30 |
| rapierForearm | rapierForearm | 39 |
| legLeft | legLeft, legLeftKnee, legLeftAnkle | 55 |
| legRight | legRight, legRightKnee, legRightAnkle | 51 |
| Total | Every retained triangle/corner | 361 |

All groups have volumetric hulls. Maximum source plane residual is 6.67e-16 m. No vertex is removed from the rendered source, reassigned to a dominant weight, lifted, padded or exempted. Hull points are a subset of the group's exact visible source points. Converting those points to their owner's bind frame is a coordinate transformation, not permission to change geometry. Final packed/native construction and numeric tolerances remain to be checked separately.

**Necessary concession for this particular grouping:** throughout every authored phase and every permitted interruption entry, shell retains its bind transform relative to body; both eye branches retain theirs relative to head; knees and ankles retain theirs relative to each hip. This also excludes relative translation or scale changes on those locked branches. Under that constraint, all skin matrices influencing each leg are the same rigid skin transform, and their unchanged weights sum to one. The continuous hinge therefore moves rigidly in the source mathematics without any weight edit. Fresh sums are exactly one in source doubles and in float32 arithmetic; summing packed float32 weights in double precision exposes at most 2.7008354663848877e-8 normalization error. Native numeric tolerance is consequently still a separate check, not exact real-arithmetic runtime parity. Head, hips, upper arms and forearms may still move independently; the physical root may take any common rigid transform.

This is an explicit restriction on future motion, not an authored animation, a quality endorsement or authorization to implement stiff legs/eyes. At rest the grouping is coherent mathematically; meaningful anatomical grouping and the loss of knee/ankle/eye/shell articulation need review against the intended character. It does not prove adequate gait, planted stance, blade clearance, death fold or response to arbitrary lethal entry poses. It must not be called complete motion merely because its invariants can be stated for all time.

For comparison, the exact whole-character rest hull has 90 extreme points. That only disproves a vertex-count obstruction; it is not a permissible one-body anatomical proxy proposal around unrelated appendages. A five-group torso/head/shell/eyes + complete arms + complete legs partition has 259 points, but loses still more motion and is not recommended or implemented.

## Exact counterexample to treating a bent weighted leg as rigid

Use source part `legLeft`, zero-based expanded indices 31 and 196. Mesh-map identifies 31 as node24 `Leg hinge -1`, primitive0; 196 as node25 `Bent armored thigh -1`, primitive0. Their positions are:

- v31 = (0.6866990327835083, 0.6337724924087524, 0.05010474473237991), indices [9,10,0,0], weights [0.06748135836348468,0.9325186416365153,0,0].
- v196 = (0.6911599636077881, 0.8130678534507751, 0.06397668272256851), indices [9,0,0,0], weights [1,0,0,0].

Keep hip/body at bind, rotate knee locally +0.3 radians about X, and keep ankle locally at bind so it inherits knee motion. This is a diagnostic transform allowed by the declared rig, **not a claim that an existing selected animation does it**. With knee pivot c=(.69,.63,.17), v31 becomes `w9*v31 + w10*(c + Rx(.3)*(v31-c))` = (0.6866990327835083,0.6666558766215865,0.05613794523633979). v196 remains unchanged. Pair distance changes from 0.17988651160832467 m to 0.1466895111050135 m, a 33.19700050331117 mm shortening. No rigid transform can do that. Values use original source doubles; runtime weights are their independently verified float32 casts.

Thus that bent hinge and rigid thigh cannot be one exact rigid component. For the eight-group example, retaining its whole-leg coherence requires excluding that relative knee bend, not assigning v31 to its largest weight. Alternatively a different explicit anatomical support/motion contract is required and must be checked, including continuous triangle coverage. This witness alone neither proves every possible eight-part proxy fails nor permits another proxy to be assumed safe.

## Preserve the independent Iguana correction

The correction in `iguana-native-contract-diagnosis/INDEPENDENT-DESIGN-REVIEW.md` applies here: if V is one genuinely rigid component and H=conv(V), every linear directional extremum of the triangulated visible component equals that of H. A common rigid transform preserves this equality. Visible triangles may lie inside the hull and retain all concave anatomy. Triangle-to-convex-boundary equality is not an admission requirement. Therefore no breast/eye/shell/toe anatomy must be flattened merely to make it a convex rendered solid.

This result proves planar support only for the current coherent component. It does not prove collision equivalence against finite rocks/edges, justify bridges between unrelated appendages, cover skin deformation with unequal transforms, or validate a hull around the union of future poses. The diagnostic knee witness is a rigidity failure, not automatically a plane-support or containment failure. No decorative/support exemption is introduced for eyes, blade, toes or blended corners.

## Next bounded decision and remaining gates

Do not spend another physics/capture pass on unchanged selected rest data or substitute canonical lifecycle footage. Specify one selected-source anatomical/motion contract first. The eight-group example demonstrates a point-budget-feasible option and its exact lost articulation; it is not the only conceivable partition and not a unilateral artistic choice.

If those motion restrictions are unacceptable, retain the original and record the exact required relative articulation before evaluating another grouping. No established evidence here justifies cap increases, source destruction, largest-weight skin reassignment, root lifts, solver/CCD searches or a generic engine expansion. Only after a complete selected pose is authored can strict source admission and all-weight fixed/render support/contact checks address idle/locomotion, strikes, hit/death and late interruptions. AI/weapons/damage, loot/rewards, defeat/Retry/reload, persistence, visual readability and physical phone performance are separate unpassed gates. Generic default-off actor-handoff tests remain valuable but cannot discharge these selected-source gates.
