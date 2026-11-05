# E0h: the enemy cap (at most 12 awake, at most 16 animated in view)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **EC1** (Jake 11-02, 19n: "full
AI within 60 m, at most 16 animated on screen; it helps every shard") and the enemies plan's phone cap ("≤ 12 robots
awake, in combat or within 40 m; the rest hold a frozen pose or are culled past 150 m").

## 1. The showcase piece

No new place: the cap is what keeps band 1 (7 packs × 3–5 Mites, ~28 live) and a gauntlet court (peak 9) inside the
phone. The calibration pen gets a Developer "spawn 30 Mites" Debug row to prove it (deleted in E17).

## 2. Engine / game / host work, just in time

Research (the old row over-counted: half of EC1 exists):

- **Distance AI bands already exist.** The scheduler's `ai` rate decides at 20 Hz and moves the body every frame
  within **60 m**, 10 Hz with a half-rate body to 160 m, and pauses both beyond (`src/engine/shared/sim/bands.ts:22-26`,
  `AI_TICK_RATE`); a level's tier `ticks` can override it (`src/engine/client/core/Game.ts:1308`). Creature physics bodies
  exist only within 45–55 m (`bands.ts` doc). Legacy self-thinking species run on a flat 10 Hz `legacy` rate
  (`AnimalManager.ts:395`).
- **Pose cadence by distance exists** (`src/engine/server/entities/poseCadence.ts`, FC11/G896: bones every frame within 30 m,
  every 2nd to 70 m, every 4th to `ANIM_LOD = 140` m, `AnimalManager.ts:142`); desktop batches far animals in a
  `FarHerd` (`farHerd.ts`).
- **Attack tokens exist** (`fight.attackers`, E297, `src/engine/server/entities/fightRules.ts`): at most N attack at once.
- **Missing: any count.** Nothing caps how many creatures are awake or animated; 30 Mites inside 60 m all think at
  20 Hz and all pose every frame.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| awake cap | `fight.awake: { max: 12, radius: 40 }`: the nearest N hostile creatures (engaged first, then by distance) keep the `ai` rate; the rest drop to a `held` band (brain paused, body frozen on its current pose, still hittable) | engine scheduler (`TickScheduler` pins / a ranked band), `fightRules.ts` |
| animated cap | `view.animatedMax: 16`: of the creatures inside the frustum, the nearest 16 pose; others hold their last pose (cadence 0) | engine `poseCadence.ts` + `AnimalManager` |
| far cull | past 150 m a creature's mesh is hidden (bodies already paused past 160 m) | engine, a tier row |
| who it applies to | hostile creatures only (`aggressive: true` species rows, `creature.*` combat tags); herds, ambient flocks and wildlife keep today's bands | engine filter on tags, data only |

Host bar: engine feature, every shard a user (the rule is a tier row with defaults). Guards: `engine-words`,
`no-raw-*`. Tests: new `test/enemy-cap.test.ts` (30 hostiles: 12 awake, the 13th wakes when one dies, an engaged one is
never frozen), extend `test/pose-cadence.test.ts`, `test/hunt-cadence.test.ts`, `test/fight-rules.test.ts`.

## 3. Other shards in this slice

The cap is on for every shard (19n), so this slice proves no shipped fight hits it:

| Shard | Hostiles near you at peak (to measure) | Proof | Save risk |
|---|---|---|---|
| Driftwood | crabs, monkeys, boars, the sailor (attack tokens already) | seeded population replay: identical brain ticks and poses when ≤ 12 awake | none |
| Pine | wolves, the bear, the night thralls | same, at the night pack | none (scheduler clocks are saved: `scheduler.ts` `isolatedState`; a frozen subject saves as paused) |
| Nalati | wolves; herds (excluded by tag) | same; herds byte-identical | none |
| Sky, Signal, Nine, templates | few hostiles | replay | none |

If a shipped scene exceeds 12 awake, the replay differs: that shard's numbers go to Jake (Q1) before landing.

## 4. Done when, hours, blockers

**Done when:** the 30-Mite Debug row shows ≤ 12 thinking and ≤ 16 posing on a served build (a Chromium "iPhone 16 Pro"
sample with the counts in the commit), every shard's replay is identical, an engaged robot never freezes.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 12 h (Codex) | 6 h (replays on every product) | 0 | **18 h** |

**Blockers:** none (it doesn't need levels). Lands before E1c fills band 1.

## 5. Risks

- A frozen robot in view reads as a bug. The cap ranks by engagement then distance, and E11c's courts stay at 9, so in
  play the frozen ones are the far packs.

## 6. Questions for Jake

1. **The cap on every shard or only the showcase.** (a) on everywhere for hostiles only, with today's shards proved
   unchanged (your 19n "it helps every shard"); (b) opt-in per shard. **Recommended (a):** the replays show whether
   any shard changes; herds and wildlife are excluded, so Nalati's steppe looks as it does.
