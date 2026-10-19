# Conch native15 isolated motion1 route (unaccepted)

Frozen arena-candidate1 geometry and motion channels remain unchanged. The only
metadata edit is the measured root-centered Y capsule from 1,512 body vertices:
radius 0.5091165774643404, half-length 0.472732982635498. Shell, shield, weapon,
eyestalks and limbs are not central hurt volume. Original head radius remains
0.5859726700629535. No range or player-clearance constants were changed.

Exact packed vertex sweep at 61 samples per state records known floor failures:
idle/walk -0.00953m, guard -0.02208m, thrust -0.04707m, counter -0.04764m,
death -0.91963m. These are measurements, not floor or animation approval.
Native +Y up/+Z forward and original rest floor are retained. No vertex edits.

The new generator filters to one Conch decision and the unchanged .6/.45 windups,
.1 active windows and .9 recoveries with 2.4m lanes. Player sword stays 2.2m.
Unchanged practice.html/src/practice.ts host retains null storage, persistent:false,
empty save namespaces, bout-only rewards, no quests/flags/bosses/world ledger.
Source isolation snapshots are distinct from browser before/after proof, still pending.

Run Node admission tests and focused preview/envelope Vitest. Build requires heavy
lane: scripts/build-conch-native-preview.mjs then --app, using a fresh destination
and CONCH_PREVIEW_DIR. These paths were prepared but have not been built or served.
No visual, collider, gameplay, persistence-runtime or phone-performance acceptance.
Targeted oxlint was killed (137) under concurrent load, without a diagnostic.

Correction: motion-envelope.json used a rigid-part approximation. Upper leg
vertices have blended knee/ankle weights, so those numerical minima are provisional.
The separately identified motion2 sweep applies exact four-weight skinning.
Single-thread targeted oxlint subsequently passed after blank-line/await fixes.
