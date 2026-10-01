# E357 C3 — damage pipeline and player health

Source commits: `fb0c2e93`, `27529327`, `fd737dc6`.
Shared C2/C3 integration: `2cba0f9be5a03f642cd1d4b607fe16e7361d164a`.

CombatPipeline owns the ordered damage rules, occlusion query and queued damage/death events.
PlayerHealth owns damage, cause, max-health arithmetic, regeneration and death/checkpoint sequencing.
The five main hurt paths use PlayerHurt; Animal's compatibility entry applies modifiers once through the pipeline.
Resident player/rule/checkpoint ports are level-scoped. Queued contacts snapshot reused raycast vectors.

## Fast verification

- Whole `pnpm run typecheck` (generation, app, API and scripts): exit 0 on the integrated tree, 2026-10-01 04:21 local.
- Oxlint on every C3 source/test path: exit 0.
- Focused public damage, hurt, real-Rapier occlusion, events/probe and level lifecycle suite: 6 files / 92 tests pass.
- C1 reports whole Vitest: 200 files / 1722 tests pass at 04:15:54; 540 frozen damage outcomes unchanged through Animal.applyDamage.
- Public rules cover boss-tag god isolation, R1 cap/R2 guard, environmental fall isolation, variant-before-species rounding,
  resident target identity, disposal and queued event ordering. Six real-Rapier cases cover static-world veto,
  clear paths, checked cover, intentional through-wall damage and actor collider groups.

## Browser evidence

First authorized phone walk+combat+leak run: `fb0c2e938a426a97b199fc8d28c31602ad29c1c9`.
Raw evidence: `/private/tmp/e357-c3/1/report.md`; compact measurements: `c3-first-summary.json`.

| Shard | Walk stuck / escaped | Hits to kill | Red fields |
| --- | --- | --- | --- |
| Driftwood Isle | 0 / 0 | swing 3 | events answerers 0 → 3 |
| Nalati Grasslands | 0 / 0 | swing 3, shot 2 | events + weather answerers 0 → 3 |
| Nine Dragon Stack | 0 / 0 | swing 1 | events answerers 0 → 3 |
| Pine Hollow | 0 / 0 | shot 3, shot2 3 | events + weather answerers 0 → 3 |

No boot errors. Walking, combat and pause/resume gates passed on every shard.
The sole failure was the probe's hardcoded zero baseline: the pipeline retains three engine rule answerers.
Commit `27529327` measures the actual engine census excluding the live level subtree. Post-unload still counts all
registrations, so leaked level listeners remain detectable. Nested scopes and two unload cycles are tested.
No parity tolerance, pose or baseline was changed. The first runner closed its browser and preview.

Final authorized integration run launched 04:20:36 local:

```sh
scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=2cba0f9be5a03f642cd1d4b607fe16e7361d164a --lane=m5 --shards=all --tiers=phone --only=walk+combat+leak --out=/private/tmp/e357-c3/2
```

Log: `/private/tmp/e357-c3/parity-2.log`. At the four-minute handoff, Driftwood and Nalati are GREEN (including weather unload); Nine Dragon and Pine remain pending.
Captured completed measurements: `c3-integration-summary.json`.
The lead owns completion if the run exceeds the builder's four-minute wait cap.
Exact m5 golden baselines were absent in the first run: that run proves thresholds and lifecycle restoration,
not full exact-baseline parity. The lead owns the full two-tier batch, clean-export gate, push and milestone pin.

## Decisions and remaining migrations

- Lead approved `legacy.player-rules-bypass` for Storm Titan until S3.4/B3; boss-tag R1/R2 pipeline behavior is tested.
- R0 also vetoes environmental damage during death fade. The old invisible transient health dip is removed;
  no extra feedback or next-tick health change remains (lead approved).
- StringKey currently preserves existing text; content string tables are a later migration.
- Existing weapon base formulas and species callbacks remain adapters until their family/AI rows migrate.
- Existing seeded bolt/recovery/javelin rolls from `9f89ab86` remain unchanged. No new random source or tuning guess.
- No push, deploy or production pin change by C3.
