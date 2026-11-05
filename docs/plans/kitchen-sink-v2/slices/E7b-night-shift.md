# E7b: the night shift (each band swaps to a +1 variant at night; storm counts as night)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the night half of **LV10**
(night-shift variant rows: L+1, XP ×1.25), **EBW4**'s night half (amber lamp eyes, hi-vis chevrons, an unlit additive
headlamp cone), **EB5**'s night rows, **M4.2** (Pine's night director → rows) and the night part of **M4.4** (Nalati's
night rows), plus 19k: "storm hour counts as night for spawns".

## 1. The showcase piece

After dusk (the 4-minute night of the 20 + 4 min clock, W11a) each pack swaps **at its next respawn** to its night-shift
variant: +1 level, XP, Scrip and parts ×1.25 (two parts), amber lamp eyes, hi-vis chevrons, an additive headlamp cone
(no real light). The Arc Sentry's night shift is L19 (the gap 19n keeps). Storm hour (E9) and natural storms count as
night.

## 2. Engine / game / host work, just in time

Research:

- **Night rules exist in three places.** Returns: `RespawnRule.night?: boolean` (`src/format/populationRespawn.ts:19`;
  Driftwood's sailor comes back after dark). Elites: `rule: 'always' | 'dusk' | 'night' | 'storm'`
  (`src/format/eliteFeature.ts:13`) and observations `dusk`, `night` (`:25`). Directors: an input binding `day:a..b`
  (`src/format/directorStages.ts:6`, `directorDayRange`).
- Pine runs its night shift through AS: `src/shards/pine-hollow/behaviour/night.as` and `director.as` /
  `directorV2.as` with `director.json` (the night thralls), on the plugin director (`src/game/server/plugin/director.ts`).
  Nalati has night rows in its spawn page (`spawnPackDemand`, migration map §1).
- Nothing swaps a variant by time; storms are not read by spawns.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| shift variants | species `shifts: [{ when: 'night' \| 'storm' \| 'night-or-storm', variant, levels: +1, rewardMul: 1.25, salvageMul: 2 }]`; applied when a pack respawns (never mid-fight) | format `creatures.ts` + game spawn host |
| one time read | a game "world phase" read `{ night, dusk, storm }` from the day clock (`engine/shared/sim/dayClock.ts`) and W11a's `world/weather`, shared by spawns, elites and directors | game `src/game/world/phase.ts` (new, small) |
| look | the night palette and the headlamp cone part (E1a's slots) | data + an additive cone mesh |
| Pine | its night thrall swap through `night.as` becomes shift rows where it is a swap; the rest stays AS | Pine data / AS |

Host bar: shift variants get two users (Pine's thralls, the showcase). Guards: `shard-names`. Tests: new
`night-shift.test.ts` (swap at the next respawn after dusk, never mid-fight, storm counts when `night-or-storm`),
Pine's night tests and `test/fixtures/pine-headless.ts` replays.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Pine Hollow | night thralls via `night.as` + the plugin director | the swap as shift rows; AS keeps the rest | headless replay over one night (spawn ids, times, thralls); a night look in game | low |
| Nalati | night rows in the spawn page | read through the shared world phase | seeded night replay | low |
| Driftwood | the sailor's `night` return | none (the return rule stays) | replay | none |

## 4. Done when, hours, blockers

**Done when:** after dusk each band's packs come back as night shift on their next respawn with lamp eyes and the
headlamp cone, pay ×1.25 and two parts; a forced storm (W11a's Developer row) does the same; Pine's and Nalati's nights
replay unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex) | 8 h | 8 h (Opus: six night palettes, the cone) | **24 h** |

**Blockers:** E7a (the variant look path), W11a (the day clock and weather in the showcase), E1c.

## 5. Risks

- A 4-minute night and 90 s respawns: most packs swap once or twice per night; the first dusk in a session may show
  few night robots. Acceptable; E16 checks it.

## 6. Questions for Jake

1. **Storm hour brings out the night shift and the night elites?** (a) yes (the enemies plan Q1; 19k says storm counts
   as night); (b) storms change only the sky. **Recommended (a):** already your ruling; listed for the natural storms
   too (W11a): they count as night as well.
