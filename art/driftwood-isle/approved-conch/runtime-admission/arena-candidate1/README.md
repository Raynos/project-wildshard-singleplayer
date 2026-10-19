# Conch native15 canonical arena preparation

This is an isolated candidate input and authored pose preparation, not a playable
arena or acceptance. The approved character-pass geometry and its original
`character-pass-native1` tuple remain unchanged. No further visual polishing,
shared engine change, gameplay catalogue mutation or production promotion occurs.

## Explicit canonical frame

`scripts/conch-native-frame.mjs` admits only the SHA-256-pinned original native
JSON, metadata and payload. It applies the proper rigid transform
`(x,y,z) -> (-x,y,0.05-z)` to packed vertex positions, all absolute bind pivots,
and diagnostic foot samples. This is a 180-degree rotation around Y followed by
+0.05 Z translation: determinant +1, no reflection, scale, winding reversal,
floor fitting or topology changes. Native body `[0,1.04,.05]` becomes canonical
`[0,1.04,0]`; native -Z forward becomes +Z. Names, hierarchy, every non-position
packed byte and original files are preserved. Rest half-length is recomputed
for the new origin. Original left/right naming is preserved; feet now have
negative-X then positive-X order without reordering.

The transform is self-inverse in real arithmetic. Packed floats introduce the
expected Float32 rounding on the translated Z coordinate. The original byte
closure is the authoritative reversible source; do not claim transformed bytes
are a lossless float round trip. The new payload has its own content-addressed
path. Do not disguise it as the original native payload.

## Decision and pose contract audit

The existing `behaviour/conchDuelist.as` and `driftwoodRegularCombat.ts` remain
untouched. Stage 0 stalks; entering range 2.3 starts stage 1 with guard=1 and
thrust. Guard clears at .6 seconds. A hit before .6 clears guard and enters
stage 4, retaining the counter response across stun; the next unstunned tick
starts stage 3 counter. Stage 2 recovers for 1.5 seconds. Strike completion
clears guard and enters stage 2; stop/death clear guard and stop movement;
death enters stage 5. Thrust timing is .6 windup/.1 active/.9 recover; counter
is .45/.1/.9. Both lane hitboxes are length 2.4, width .65, with damages 14/16.

Old clips address absent `guard`, `thrust` and `foot` joints and stretch the
weapon. They are incompatible and are not reused. The new independent
`conchNativeClips.ts` addresses all 15 exact joints, reads `conch-st`,
`conch-guard` and `regular-clock`, uses the actual attack windows, and provides
idle, alternating leg/knee/ankle gait, guard, windup, thrust, flinch and death.
It preserves unit scale and every non-root bind translation. The animation
is authored in the canonical frame, not a silently retargeted old clip.
The future isolated look must declare rootFlinch=`authored-pose` to avoid
applying recoil twice. No look is changed in this preparation.

These are first-pass transforms, not approved choreography. In particular,
the source rapier direction, forward reach and collision lane need actual
rendered measurement; a mathematically forward-facing head does not prove a
correct sword hit. Gait has no newly validated planted-contact solution.
Death has no established corpse/floor clearance. Do not describe either as
accepted just because numerical tests pass.

## Boundaries and next step

Metadata dimensions remain conservative REST diagnostics. The inherited
bodyRadius 2.8477937887815448 encloses the shell/weapon full hull and is not a
validated hurt capsule. Bounds, collider tuning, foot contact, materials,
culling, animation deformation and weapon-hit alignment need a dedicated
isolated arena admission. Keep the original 63 polygon-normal deviations,
layered eye overlays and double-sided-vs-native shading caveats visible.

No new Conch app was built or served; no browser capture, visual review,
combat/retry test, persistence proof or physical-phone measurement occurred.
Future arena integration must retain null storage, persistent:false, empty
save namespaces and bout-local rewards, without quest/flag/boss/world writes.
Do not broaden another creature's admission or introduce an engine exemption.

## Focused checks

- `node --test scripts/conch-native-frame.test.mjs`
- `node_modules/.bin/vitest run test/conch-native-clips.test.ts --maxWorkers=1`
- `node_modules/.bin/oxlint src/shards/driftwood-isle/generators/conchNativeClips.ts test/conch-native-clips.test.ts scripts/conch-native-frame.mjs scripts/conch-native-frame.test.mjs`

The generator refuses an existing candidate directory. Its exported pure
preparation function lets tests reproduce/compare the frozen output without
writing or replacing it. Full typecheck/build, browser and gameplay checks are
not covered by focused tests.
