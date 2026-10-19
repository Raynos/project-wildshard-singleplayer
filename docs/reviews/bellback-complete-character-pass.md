# Bellback complete-character pass

2026-10-19. One complete static candidate, pending independent original-reference review. No author likeness score, model promotion, runtime integration or animation acceptance.

## Reference and scope

The approved `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`, retained woody source/model/hero and `docs/reviews/bellback-woody-integration-independent/REPORT.md` were inspected before construction. The retained nine-angle images were also inspected before final capture. The review identified a long reptilian head and horizontal jaw, pendant tusks, a long barrel/fence carrier and a plain rear hull. This pass addresses those together; hidden anatomy remains inferred from a front-oblique concept.

All work lives in `art/driftwood-isle/lowpoly-bellback/complete-character-pass/` and its isolated `tmp/bellback-complete-character-pass/` evidence. The prior best and original reference remain unchanged. No physics, engine, AI, public host, Mac, paid service, Git or Site action occurred. Seven inherited semantic rigid pivots remain; they are not the unapproved five-body/four-joint physics architecture.

## Complete geometry changes

- The whole head assembly is shortened coherently to 78% of the neck-relative source projection, versus the retained version's 96%. Brow, cheek, recessed eye, upper fangs, mouth and jaw move together. Width is restored to a broader 100–104% source taper instead of 86–90%, with a descending tip retained.
- The two long lower ivory tusks become wider, shorter extruded jagged bite halves. They have real closed back and side faces, not floating image decoration. Existing amber squints and wooden crown chips remain.
- Broad chest strakes bridge head roots to front shoulder masses. Foreleg masses spread and crouch; hind feet spread and move forward with the compacted body. The hull and carrier shorten longitudinally, side strakes diverge in slope, rear timbers vary in height/cant, and a pair of substantial rooted stern fragments breaks the plain rear.
- Bell shell and support arch proportions are retained. The clapper weight is lifted 0.20 world units and its stem shortened from the fixed crown attachment to clear actual inherited head/hull penetrations.

The source remains a deterministic ordinary Blender Python builder; the self-contained GLB is 362,648 bytes, 94 meshes and 4,834 triangles, without skins or animation clips. No `.blend` was saved.

## Geometry defects found and repaired

The stricter audit exposed inherited rope-loop seams in both the retained model and the first complete candidate: 236 proper self-crossings and 732 inclusive nonadjacent triangle contacts, all in closed lashings and the crown tie. Those loops had been capped open tubes whose terminal sections overlapped. The new builder uses genuine periodic tube topology with one shared ring at each station and no end caps. The crown tie uses a smaller physical radius. This changes actual geometry; no selective normal inversion or convenient triangulation conceals a fold.

The clapper's retained weight also intersected the head and hull. A preserved second attempt records those assembly defects. The final weight has no triangle-pair intersections with the cranium, hull or bell shell. Only stem/weight and stem/crown attachment contacts remain incident to the clapper.

Final checks:

- Closed manifold edges, consistent winding, positive signed volumes, nonzero native triangle areas, flat shading and valid material slots: pass for all 94 components.
- Actual exported normals agree with geometric triangle normals; finite positions/normals and valid indices are checked directly from the GLB.
- Proper within-component crossings, including shared-vertex pairs: zero.
- Inclusive nonadjacent self-intersections: zero.
- Positive-area coplanar within-component overlaps, including adjacent triangles: zero.
- Both diagonals of every source quad: all 8,276 tested triangles align positively with the actual polygon normal.

The complete cross-object inventory still contains 10,989 intersecting triangle pairs. This layered timber model is not a disjoint assembly: hull/limb, timber/rope and frame/bell contacts remain. The inventory is explicit, not collision or articulation approval, and does not establish penetration depth, animated clearance or a physics-ready rig.

## Capture contract and preservation

The capture script is byte-identical to the retained woody script. Both models were freshly rendered using its original lights, samples, exposure, color settings, camera positions, target, orthographic scale and portrait dimensions: hero plus nine named views each. All ten fresh baseline renders reproduce the exact retained RGB pixels; file hashes differ only because Blender writes timestamps and render timing metadata.

`paired-captures.json` pins twenty actual final raw PNGs and ten exact-camera pair boards. Pair boards concatenate complete unmodified RGB pixels; compact WebP boards are labelled derivatives. Raw files remain untouched. Source hashes, exact camera/light receipts, source/export byte parity and native geometry are checked by `verify.py`. Capture ran in the shared heavy lane; other lightweight diagnostics may have used CPU. No timing or phone-performance claim follows.

The first seam-defective source/export/audit is preserved under `failed-inherited-loop-seams/`. The second assembly-clearance attempt is preserved under `failed-assembly-clearance/`, with all ten of its actual raw captures in the corresponding isolated temporary evidence folder. Neither failure is substituted for the final candidate. `closure.json` records the complete footprint against the 60 MiB budget.

## Review boundary

Independent review must compare the original concept first, then every complete candidate view and the retained baseline. Broader bite, compact plan, connected shoulders and the revised rear are construction changes, not a likeness verdict. All ten final candidate views were inspected individually. Front and hero show the broader broken bite and shoulder span; side views still expose long carrier rails and a horizontal jaw underside. Top shows the compacted body/head footprint; rear views retain a plain hull end inside the added stern fragments. These remaining carrier and rear shapes deserve particular scrutiny. This package does not claim the target is met and does not change the selected model.
