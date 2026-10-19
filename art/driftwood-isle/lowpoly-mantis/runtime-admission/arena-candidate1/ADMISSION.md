# Mantis V7 native22 motion1: isolated arena candidate

This is an unaccepted developer candidate, not a new playable promotion. V7's
static likeness result remains 3.6025. Existing Puffer and production are untouched.

## Boundary

The admission script pins the exact V7 packed payload and original metadata.
Candidate metadata differs only by the explicit foot permutation `[0,2,1,3]`,
converting source left-front/left-rear/right-front/right-rear to the terrain
sampler's front-left/front-right/rear-left/rear-right order. No vertex, material,
normal, bind pivot, scale, source polygon or packed byte changes. Diagnostic
rest-hull collider numbers remain unaccepted. The 437 source-normal deviations,
flat-normal recomputation and absent per-part double-sided contract remain visible
caveats, not a reason to alter shared renderer policy.

`mantisNativeClips.ts` authors the exact 22 joints, including independent neck,
abdomen, four leaf wings and four two-joint walking legs. The standard pose binder
normalizes source underscores to dots; the author explicitly does the same. No
old Mantis clips or bone aliases are used. The unchanged first strike is .75s
windup/.50s active/.12s recovery; second .45/.50/1.10. Left then right shoulders,
elbows and hooks follow the actual actor-local stage and clock. Gait is a bounded
diagonal four-leg cycle, with swing-knee flex. Root recoil has one owner through
`rootFlinch: authored-pose`. Smooth death settles into a fixed pose; idle, gait,
attack and flinch vanish as death completes. These are authored candidates;
continuity, foot clearance, planted contact and corpse intersection need measurement
and visible review. There is no ankle joint or deformation claim.

## Actual isolated systems

The new shard product selects only the existing Mantis species, decision guest,
move and two strikes. It uses the existing PracticeCreature, actual sword,
PracticePlayer, combat pipeline and bout-local PracticeLoot. It imports no world
placements or old generated bodies. Source quests, flags, encounters, ledger,
bosses and homes remain empty; loot has no marks/finds/grants/effects. The standalone
host retains null storage, persistent=false and empty save namespaces. Existing
flag-authority refusal is untouched. Retry constructs a fresh bout.

The app validates its exact native tuple, product receipt and payload hash. It
cannot silently substitute a later native rig or old Puffer product. It builds to
a fresh explicit directory; nothing writes the tested Puffer output.

## Verification and reproduction

Focused source/pose and existing isolation tests:

```
node_modules/.bin/vitest run test/mantis-native-preview.test.ts test/practice-combat-route.test.ts test/practice-demo-entry.test.ts --maxWorkers=1
node --test scripts/mantis-native-admission.test.mjs
```

Build only with the authorized heavy lane, then retain source/native visual and
real combat evidence before any promotion:

```
python3 scripts/heavy-lane.py build -- node scripts/build-mantis-native-preview.mjs
MANTIS_PREVIEW_DIR=tmp/mantis-native-preview/motion1 python3 scripts/heavy-lane.py build -- node scripts/build-mantis-native-preview.mjs --app tmp/mantis-native-preview-dist
```

Required remaining evidence: visible source/native front/back/side correspondence,
walk-around, gait/ground contact, both actual strikes and recovery, real sword hit
and flinch/interruption, enemy defeat without post-death damage, player defeat,
Retry reset, reward collection remaining bout-local, and before/after empty
persistent storage across combat/reward/Retry. No physical-phone performance or
fun claim follows from focused tests or cloud browser captures.
