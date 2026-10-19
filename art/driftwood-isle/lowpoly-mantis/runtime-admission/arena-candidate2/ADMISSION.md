# Mantis V7 native22 motion2 candidate

Unaccepted isolated arena revision. Motion1 is preserved independently. Product sourceHash: `8e4ce9548975175ff813e556976def02c8a15505ce155177a0892a53459303f6`.

Exact V7 payload is unchanged; original native/metadata/payload and changed candidate sources are pinned by admission.json. Metadata only changes explicit foot order [0,2,1,3] and measured central abdomen/face dimensions. measure_dimensions.py and dimension-measurement.json document included and excluded source parts. Body radius .4, half-length 1.27; head radius .5. Long neck is not separately represented; crown, limbs, wings and lateral tail splinters are excluded from these combat primitives. Collider acceptance remains false. Existing two strikes and .9 range unchanged.

Separate authored motion2 adds gait/attack lift and a low curled-leg death. 41-sample exact rigid-vertex sweeps of walk/first strike/second strike/death contain no below-floor vertices; this is not proof of planted feet, terrain following or all hit-flinch combinations. Mesh, bind and rest geometry unchanged. No original 12-joint clips are reused. 437 source-normal deviations and source/native side-policy difference remain unresolved visual caveats.

Real practice engine/AI/sword/damage/rewards/Retry are used. Source flags/quests/bosses/world placements and save namespaces remain empty, persistent false, null storage. StateStore snapshots before combat and after defense/reward/Retry/player-defeat Retry are recorded in QA, alongside browser storage; neither alone is a blanket world-persistence proof. No shared engine or existing Puffer edits. No performance/fun/promotion claim.

Sources are frozen before final visual evidence. Capture runner includes explicit diagnostic player placement and camera aim; it never edits enemy state, health, damage, time or random state. Rest comparison is separately labeled, freezes rendering, and is not gameplay evidence.

## Captured result and remaining acceptance gaps

Full-body observer: 47.08s, 1177 encoded frames at25fps, 247 render-transform samples. Real damage in both directions, enemy death,3local coins, Retry, independent real player defeat and defeated-attack suppression all observed. SaveStore snapshots are unchanged empty global.keys/shard and generation0. Original combined capture crashed in browser; separate recovery passed. Cause of crash is unknown.

Nine matched rest views preserve source/native geometry with visible normal/facet and shading differences. Actual stage regular-clock duration exceeds the authored nominal strike timing; authoritative clock alignment is under independent review. Generic death mesh sinking lies outside the local envelope test and can affect world contact. A complete isolated idle cycle was not demonstrated. No frame-independent motion acceptance or promotion.
