# Conch Duelist — full-character anatomy pass

Date: 2026-10-19 UTC. This is one substantial character pass from V10 repair, not another shell-architecture rebuild and not a new accepted enemy. Static independent likeness review is pending. No runtime, animation, rigging, combat or phone-performance claim is made.

## Intended change

The approved original remains `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp` (SHA-256 `90073e7f4eae70b1e135c87740325d6a7a7da94c67cf761b03c5184c507a65cb`). The prior actual V10 repair full-nine evidence and independent critique informed which neglected character forms to address.

- Replace plaque-like eyes with asymmetric pointed housings, sloping thick brows, deeper recessed convex amber lenses and pointed pupils. Retain separate angled stalks.
- Give the coral face cheek volume, brow roots and a forward keel that curls back into the descending beak tip.
- Shorten and broaden the thorax. Add raised breast armor, three overlapping dark burgundy abdominal segments and pointed pelvic guards.
- Make the shield claw a substantially broader, asymmetric pointed outline with a convex coral carapace and ivory cutting face. Author both sides and the entire closed perimeter.
- Give shoulders and upper arms articulated joint transitions, a substantial shield-supporting forearm and a coral rapier knuckle. Preserve the planted crouch and existing feet.

The unified V10 repair shell geometry is unchanged. Its shell-construction source section is byte-identical, SHA-256 `66e3230129bcb79fef19692c951b436f97e0e6c07ef461ddf180e0be4aa6715b`. This deliberately retains both the useful closed cavity and the prior shell's known rotational/shelf-like visual weaknesses. There is no claim that changing other anatomy resolves those weaknesses.

## Sources and frozen build

- `art/driftwood-isle/approved-conch/build_conch_character_pass.py`: 17,107 bytes; SHA-256 `3c5771598f49b41d5bd3dde55977d693fc42b4ca921cc7eafa93a13542c00d5b`.
- `art/driftwood-isle/approved-conch/render_conch_character_pass_nine.py`: 3,134 bytes; SHA-256 `9d7c0349b854f3ae27c4d4921fb99aa5e95ee1911503abc468bc83501d074e29`.
- `art/driftwood-isle/approved-conch/review_conch_character_pass.py`: 1,887 bytes; SHA-256 `0cc51f39a599419c3b08bdaeb474d5b1671e7865e6a1259e6f4d71aa36ef2434`.

All earlier versions and failed studies are preserved. V11 preflight aliases are not used or relabeled as additional work. These new source files are self-contained except for standard Blender/Python/Pillow dependencies; the nine-view renderer calls the named character-pass build source.

Preflight exited 0. Actual exported geometry contains 2,446 triangles across 56 named meshes. The unified shell remains 466 triangles, with zero welded boundary edges, zero nonmanifold edges, zero degenerate triangles and zero proper nonadjacent crossings. The new closed shield and body meshes also have zero boundary/nonmanifold/degenerate edges. Eye housings, their matching back/lens surfaces, pupils/glints and nostril decals are separate components, so their individual component boundaries are intentional. Structural checks are not visual acceptance.

## Evidence protocol

Actual hero and nine-view Blender renders use the same inherited studio settings and canonical half-dome camera method as the preceding repair: front, left, right, back, top, diagonal-front, diagonal-left, diagonal-right, diagonal-back. All nine share a fitted orthographic scale. There are no concept pixels in actual-model panels, no viewport-dependent geometry, and no relabeled old renders.

Evidence is staged in `tmp/conch-character-pass/`, including the frozen source manifest, preflight log, topology/crossing audits, actual GLB, hero, full-resolution nine frames, camera manifest and clearly labeled comparison boards. Final capture receipt records hashes and terminal status. Independent review must inspect the approved original and every actual full frame; boards are supplementary, and the builder does not self-score or self-accept.
