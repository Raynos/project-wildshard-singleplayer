# Conch native15 motion2: isolated floor-clearance trial

The canonical arena-candidate1 native payload, source-native15 geometry, frozen
conchNativeClips and failed arena-motion1 are preserved. No engine, host, world,
Puffer, decision or strike changes. No Mac, remote writes or production promotion.

## Explicit motion difference

conchGroundedClips is separately identified. Every joint rotation, non-root
translation and unit scale matches frozen motion1 across the focused sweep.
Only root height changes: +0.06m baseline and +0.36m smooth death lift in place
of -0.65m smooth death drop. Smoothstep timing remains unchanged. This keeps
the sideways collapse visible while clearing the floor; it is not planted IK.
The rest/idle soles hover approximately 5cm. That visual/contact defect remains
for real review, and this correction is not animation acceptance.

The .05m baseline trial passed a correlated-clock sweep but failed the expanded
independent-idle/recoil sweep by 7.28mm. trial-envelope.json preserves that failure.
The final weighted sweep independently tests idle extrema and recoil 0/1 for every sampled
attack, guard, gait, flinch and death frame, 366 samples per state. Exact four-weight
packed skinning is applied to every vertex using the bind/world transforms;
upper legs contain blended knee/ankle weights. Weight sums are checked.
The earlier rigid-part receipts are provisional and superseded by this sweep.

## Collider and attack frame

+Y up, +Z forward, original root XZ origin, original packed geometry. Central
body capsule uses only 1,512 torso vertices, radius .5091165775 and Y half-length
.4727329826. Original head radius .5859726701 is retained and dominates bodyClear,
which adds unchanged .68m player clearance. This excludes the shell/shield/rapier/
legs from central body volume; it is an anatomical candidate, not contact proof.
Conch attack lane length/range remains 2.4m, decision trigger 2.3m; .6/.45 windups,
.1 active and .9 recovery. Player sword reach remains 2.2m; practice uses real
Rapier surface casts. No arbitrary radius shrink or hit-range enlargement.
Weapon-tip alignment and visual wound/contact location still require real capture.

## Product route and boundaries

Heavy-lane product command: node scripts/build-conch-grounded-preview.mjs
Optional fresh output directory is the first argument. App command:
CONCH_GROUNDED_PREVIEW_DIR=<product-root> node scripts/build-conch-grounded-preview.mjs --app <new-app-directory>
Both commands must run through scripts/heavy-lane.py build. No build has run yet.
The original practice.html host is unchanged. Candidate catalogue contains only
Conch, one real decision and its two strikes. Source snapshots record empty
quests, flags, bosses, homes and world ledger; null storage, persistent:false,
empty save namespaces and bout-local rewards remain in the unchanged host.
Browser storage before/after, enemy/player damage, guard/counter, death, defeat,
rewards, retry and repeated entry/exit are still untested for this candidate.

No appearance, animation, collider, gameplay or phone-performance acceptance.
The unchanged 63 native normal deviations, layered eyes and double-sided native
shading caveats from canonical preparation remain applicable.
