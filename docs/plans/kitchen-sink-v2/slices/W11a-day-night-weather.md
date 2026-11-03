# W11a: day and night, weather and rare storms (forest kinds renamed)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the old **W13** (rename the
`weather.forest` / `world.forest-page` kinds; unify Pine's and Nalati's weather envelopes, CS7's left-out weather
union; the storm-hour trigger is east: E-slices), HOST-AUDIT **HA4b** for the forest family (H073, weather part) and
**HA4d** for `engine/world/steppeWind.ts`, and **M7.1** (Pine), **M7.2** (Nalati), **M7.4** (days rows).

## 1. The showcase piece

- **Day and night like Driftwood** (19j): 20 min day + 4 min night, one cell-wide clock (a `DayClockRow`).
- **Weather:** fair most of the time; **rare natural storms** (19j) a few times a day, cell-wide (decision 8: no
  per-zone weather): rain, wind, darker light, thunder; wind moves flags, the zip cable and the rope bridges' sway.
- West lights at night: lamp posts, gate lanterns, the obelisk's glow, the PB boards lit.

## 2. Engine / game / host work, just in time

Research:

- **Day clock rows already exist:** `src/format/dayCycle.ts` `DayClockRow { schedule [{phase, from, to, minutes}],
  start, units, sun, fixed, presets, dayFraction?, pauseOnPin? }`; law `src/engine/sim/dayClock.ts`. Declared through
  the manifest's `features: ['dayCycle', 'weather']` (`src/shards/driftwood-isle/manifest.json:8`, Pine `:8-9`, Nalati
  `:3-4`, the templates). The `world/days` and `world/weather` sections are empty shells in all six built products
  (21 and 24 bytes). **The day half needs nothing new.**
- **The weather that draws is "forest" weather:** `src/format/forestWeather.ts` (339 lines: drawn parts, textures, a
  channel lane, rain streaks, reaction cues), `src/game/weather/forest.ts` (318), `src/format/weatherProgram.ts`
  (418, the weather world and wind state), `src/game/weather/continuation.ts` (saves weather across a reload with
  `engine/world/weatherContinuation`), client-plan kind `weather.forest` (`src/format/clientPlan.ts:112`, dispatched at
  `src/game/shardfile/clientPlan.ts:108`). Emitted by Pine (`generators/forestPage.ts`) and Nalati
  (`generators/output.ts`). Signal Dunes has its own `weather.fields`.
- **The wind is Nalati-named:** `src/engine/world/steppeWind.ts` ("The one wind of the world (Nalati: grass, arrows,
  clouds, flags, smoke, trees, storms)").

Work:

| Row / host | Shape | Layer |
|---|---|---|
| rename | `weather.forest` → `weather.drawn`, `forestWeather.ts` → `drawnWeather.ts`, `game/weather/forest.ts` → `drawn.ts`; the old kind read as an alias for one release of baked products | format, game, the client-plan dispatch |
| weather rows into `world/weather` | the envelope (states, odds per day, durations, the storm state) lives in the section instead of each shard's JSON | format `sections.ts` + game reader |
| storm schedule | `world/weather.storms: { perDay: [min, max], minutes: [min, max], notDuring: ['night']? }` | data |
| wind | `steppeWind.ts` → `engine/world/wind.ts`, no shard noun in its doc | engine |
| west lights | light emitters on the day clock (`light.emitters` kind exists) | data |

Guards: `engine-words` (the wind doc names Nalati), `shard-names`. Tests: `test/weather-continuation.test.ts`,
`test/weather-file-contracts.test.ts`, `test/weather-reactions.test.ts`, `test/eased-weather-fields.test.ts`,
`test/isolated-shard-pine-weather-quest-values.test.ts`, `test/nalati-day-channels.test.ts`,
`src/format/weather-composition-declarations.test.ts`, `weather-entry-declarations.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Pine Hollow | `weather.forest` + weather JSON + `generators/weatherChannels` (1,250 lines, per the migration map) | the kind renamed; envelope rows into `world/weather` | seeded weather log identical for 24 game hours; one-frame looks at dawn, noon, dusk and storm (Opus, the goldens skill) | **medium**: weather continuation restores the same state from an old save (fixture) |
| Nalati | `weather.forest` + `weather.as` + `generators/dayClock` | same | same log and looks | medium, same |
| Signal Dunes | `weather.fields` | none (M7.3 waits: a different, field-driven weather) | — | — |
| Driftwood, templates | `dayCycle` only | none (M7.4 is a no-op: their day rows stay in the manifest) | — | — |

## 4. Done when, hours, blockers

**Done when:** the showcase runs 20 + 4 min days with lamps at night and a storm now and then (a Developer row to force
a storm, removed when E's storm hour lands, Q2); no "forest" name left in weather kinds or files; Pine's and Nalati's
weather logs and looks unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 10 h (Codex rename; Opus storm look) | 14 h | 6 h | **30 h** |

**Blockers:** W0a. Independent of the toys; can run early in parallel.

## 5. Risks

- Baked products carry the old kind name; the alias must ship before the rename reaches CI's product builds, then be
  removed with the next full rebuild of every product.

## 6. Questions for Jake

1. **How often natural storms come.** (a) 1–2 a real hour, 3–5 min each; (b) once a day cycle (24 min); (c) rare: one
   every ~2 hours. **Recommended (a):** often enough that a west session sees one, short enough not to annoy; storm hour
   stays the big quest storm.
2. **A Developer "storm now" row.** (a) yes, a Debug row (deleted when storm hour lands); (b) wait for a natural one.
   **Recommended (a):** the storm look is checked in its own slice.
3. **Can it storm at night?** (a) yes; (b) day only. **Recommended (a):** night storms read best and storm hour counts
   as night anyway (19k).
