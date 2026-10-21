# Keelmaw native-owner grounded variant

Separate complete editable source derived from `complete-character-refined`. Original refined source, preferred-art evidence and failed v1 physical study are unchanged. This is a source-level gameplay repair, not a new likeness score or Arena admission.

The refined source's two front carpus meshes extend to y=-0.081614 while the palms and feet stop at y=0.005. Their distal tube ring uses radius 0.52 × 0.62 around an unchanged y=0.18 endpoint. This variant tapers that ring to 0.52 × 0.36, joining the broad planted palm without intersecting the floor. The middle ring, shoulder, back limbs, root, bind hierarchy, feet, toe geometry, head and tail are unchanged. Forearm silhouette changes locally and must be reviewed as such. No whole-model lift, clipping, collider padding or solver modification is used.

`build_keelmaw.py` is the complete source producer, not a post-export mesh patch. `prepare_corpse.py --model <output>` derives exact source convex support for seven ownership groups: body plus static limbs, neck, head, jaw, and three tail joints. The existing 128-vertex-per-hull and 512-total limits are enforced, and every source point must lie inside its exact convex hull. Convex containment alone does not establish faithful contact or runtime admission.

The separate native owner source defines one stationary grounded bite, real decision/strike ownership and published hit/death pose transitions. It does not claim locomotion or tail attacks. The jaw and head use the real strike phase clock rather than the slower decision-memory clock. No shared Arena selection or production model is changed here.

Generation, contact results and isolated owner test evidence must be reported separately. Until physical tests pass, this variant remains unadmitted.

## Measured milestone

Full source export: 20,490 vertices, 6,830 triangles, 19 bones/parts. The unchanged native exporter emits a normal 64,266-byte zlib payload; metadata records 1,065,480 decoded bytes. Full GLB export is retained locally (911,544 bytes), not used by the native runtime loader. Complete source JSON and packed fixtures are retained without splitting or encoding workarounds.

The isolated native-owner suite passed 9/9; the grounded source suite passed 6/6. These counts include diagnostic measurement, not a passing corpse gate. The actual grounded rig clears the floor throughout its living bite, with unchanged root/binds/feet. The real native owner preserves lethal poses, relinquishes the living motor, freezes, and rejects changed-motion restore.

The actual rigid corpse still fails all four flat-contact trials: worst penetration 40.8354 mm at idle, 48.2767 mm at windup, 55.8631 mm at active, and 5.5556 mm at recovery. Skin and exact hull minima coincide. These numbers are provisional because a shared physics source changed during the run. Worst crossings occur at ticks 123–129, after all local death channels finish at one second. First-second and final frozen minima are within the unchanged 5 mm threshold. This supports a dynamic-root failure, not a reason to alter already-complete local motion or pad colliders. No physical admission, new source score, shared Arena unlock or browser claim is made.
