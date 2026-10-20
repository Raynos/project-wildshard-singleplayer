# Exact frozen-source check receipt

2026-10-20 20:48 UTC. Supplements the earlier frozen REPORT without changing it.
All 12 files inventoried in freeze.json remain byte-identical after final checks.

- Exact final candidate: 6/6 focused tests passed, 14.85 seconds Vitest.
- Focused strict TypeScript: passed, exit 0, including the required prefetch
  declaration. Concurrent owner narrowing repair was made by its owner, not here.
- Tests and strict check ran serially under the shared build lease after the
  native actor writer explicitly released it. The lease ran 26.73 seconds total.
  The command executed no app build, no physics world step and no contact sweep.
- Existing selected normal/authored-color source identity admission passed.
- Recipe passes strict schema and real Rapier convex hull construction: eight
  parts, 361 source-extreme points, maximum 84 per part, all limits unchanged.
- The 25-pose all-weight check includes all 94 blended corners. Its maximum
  skin-versus-owner residual is 2.5421520283296383e-8 m. Bind float32 hull plane
  residual remains at most 5.687476001270397e-8 m over all 6,570 corners.
- Lint is NOT claimed green: both default and explicit --no-ignore commands
  select zero files. The repository configuration explicitly excludes art/.
  No lint rule/configuration/ignore gate was changed to obtain a passing claim.

This completes the bounded source-authoring/check milestone, not the project or
candidate acceptance. The complete source is ready for independent review of the
rigid-leg concession and exact source gates. All actual actor fixed/render,
physics contact, visual quality, AI/weapons/damage, reward/loot, defeat/Retry/reload,
persistence and physical-phone gates remain unpassed for this selected candidate.
No public selection, deployment or application build is authorized by this receipt.
