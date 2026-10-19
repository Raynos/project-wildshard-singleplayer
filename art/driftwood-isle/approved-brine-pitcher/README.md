# Brine Pitcher Matriarch — source admission WIP

DI-N16, canonical runtime identity `brine-pitcher-matriarch`. The approved hero is authoritative; corrected Explorer and World-v2 AI sheets supply approximate hidden-surface context, not rigid turnarounds.

## Stable generations

- `build_pitcher_failed_first.py`, SHA256 `977fff7a86adb0f0c81dbf1ddeeaa29252a8d86125bd62b32ff19e3edd54db2b`, exactly matches the first actual capture's construction receipt. Complete native/GLB/ten PNG captures remain in `tmp/brine-pitcher-v1`. It has thin ivory lips and edge-on leaves. Those failures motivated the substantial complete candidate.
- `build_pitcher.py` and `v1/`: complete reviewed pre-fix geometry. Ten actual captures and paired approved-hero/Explorer/World boards are retained. Ivory rounded rim winding is inward; do not admit this candidate.
- `build_pitcher_v2.py` and `v2/`: intermediate ivory rim correction. It retained inward leaf/fang winding and double-sided materials, so the final audit refuses it. Actual ten captures come from `tmp/brine-pitcher-v3`.
- `build_pitcher_v3.py` and `v3/`: final correctness candidate. Reverses only triangle winding for three torus rims, 48 fangs and ten leaf blades, preserving the pre-fix diagonals and exact per-corner paint. GLB materials explicitly single-sided. Ten complete actual captures retained. All source/native/GLB and compressed review captures are packaged in v3; full raw PNGs remain in tmp/brine-pitcher-v4. Coordinator expanded the binary cap to 5 MiB; total preserved binaries are 4,906,246 bytes.

Both complete candidates are 3,518 triangles, 7 rigid skin joints, ~771 KB GLB, ~1.37 MB native source JSON, ~35 KB packed payload. All generation uses installed Blender and the existing packedCreatureBodies codec. Native +Y up, +Z forward, right-handed axes; Blender maps `(x,y,z)` native to `(x,-z,y)`, without reflection. Native joint bind pivots are identity-oriented, absolute. Do not transfer Blender bone-local Euler axes to numeric native channels.

## Tests and honest limits

`audit_source_v3.py <directory>` independently verifies exact float32 positions, colors, weights and oriented-triangle parity between GLB and native; actual glTF inverse-bind closure (maximum 5.96e-8); all 576 torus faces point outward; 100 closed components have coherent outward winding and positive signed volume; all three combined hollow vessels are watertight with positive volume; no zero-area triangles; seven bones; storage caps. Nine mathematical single-sided culling projections match between native and GLB, and GLB materials declare single-sided. This is source geometry verification, not a native runtime render. Dimensions are conservative provisional diagnostics, not accepted colliders.

Four Python regressions pass: final source succeeds, first candidate fails rim winding, intermediate candidate fails single-sided admission, and a changed native vertex fails parity. Exact pre-fix versus final per-corner positions, colors, weights and binds compare equal.

Three pose tests pass: fixed root/bind positions, finite all-phase motion, independent heads/lids, settled death. Three actual compiled AssemblyScript scenario tests pass: range-limited quiet idle, refused-strike recovery, stun exit, death/late-callback suppression. Strict source admission mutation tests pass. Focused oxlint passes. No full typecheck or app/runtime build has run.

## Combat source

Reserved new shard-local combat, numeric clips, AS guest and isolated product author files use existing strike/decision systems. Three timed directional snaps have distinct lids and long readable telegraphs/recoveries, interrupted by accumulated poise damage. No movement or invented projectiles. No persistent quest, world or inventory writes; practice-only 150 HP and ten-coin reward. Numeric poses keep the root fixed, with dormant idle between attacks.

## Next required admission work

Root must review corrected geometry/source, then authorize the product-only native SDK build. Compile and seal the exact AS guest/catalogue, verify body/look contracts and packed source identity. Before any shared Arena enablement, independently test single-sided native rendering, full attack-phase contacts/height, lid/body intersection envelopes, collider scale, strike timing/ranges, interruption/cancel/Retry, death/pickup/reset, empty persistent stores and the normal host source contract. No new engine callbacks, exemptions, shared selector changes, publication or app build is included here.

Likeness remains below target: roots/trunk too straight and planar; lids too regular/umbrella-like; vessel/rim rhythm too regular. This is a complete editable WIP, not accepted art or tested gameplay.
