# E1i: Pine's custom questRuntime II: chapters, the lead and the quest spawns; the section deleted

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the rest of **M2.1** (Pine
`questRuntime` + `forest-story` → rows + AS), the Pine half of **W20** (the breadcrumb guide: Pine's `lead` is a guide
that walks a path) and closes **CS5**'s last Pine exit. A migration slice: no showcase piece.

## 1. The showcase piece

None directly; the showcase's E1g quests and W1b's guide already use the paths Pine moves onto.

## 2. Engine / game / host work, just in time

Research (what is left after E1h):

| Key | Bytes | What it is | Target |
|---|---|---|---|
| `content.chapters` | 2,690 | Pine's chapter list | the declared quest rows (W1b, E1g) |
| `lead` + `leadPage` | 2,663 | a guide that walks ahead on a path (`first`, `near`, `past`, `gone`, `nightAbove`, `trot`, an AS `program`) | the merged breadcrumb guide (W20, `engine/client/quest/view.ts`, `game/server/quest/chapterDirector.ts`) |
| `spawns`, `deaths`, `pageDeaths`, `events` | ~2,000 | quest-driven spawns (a channel, cues, a limit, a script) and death hooks | director stage rows (E11a's host) or quest step effects (`QuestEffectSchema`, `src/format/questSteps.ts`) |
| `steps`, `policy` | ~450 | the step guard list and the reading delay | quest rows |

Work: move each to its platform row; where Pine needs logic (the lead's night rule, the spawn limit), it is an AS script
on the WASM host (the module cap is raised in W0e); delete `custom/questRuntime`, its entry in
`lint/custom-sections.json`, its schema in Pine's `generators/sectionSchemas.ts` and its reader in
`src/game/server/plugin/simulation.ts`.

Host bar: no new host; the breadcrumb guide gains its second user. Guards: the custom-section freeze (Pine's last custom
quest section gone), `shard-game-plugins`, ratchet. Tests: as E1h, plus `test/chapter-director-product.test.ts`,
`test/native-quest-composition.test.ts`.

## 3. Other shards in this slice

| Shard | Migration | Parity proof | Save risk |
|---|---|---|---|
| Pine Hollow | the section deleted | headless chapter replay end to end (every step, flag and spawn); the guide walks the same path at day and night (a capture pair); the King's wake still fires | **high**: mid-quest old saves (fixtures at three chapters) |
| Driftwood | the merged guide (W20) is its other user | `test/driftwood-quest-policy.test.ts` | none |

## 4. Done when, hours, blockers

**Done when:** `custom/questRuntime` no longer exists in Pine's product; the custom-section freeze count drops; Pine's
replays and save fixtures pass; one look through Pine's opening chapter in game.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 2 h | 18 h (Codex) | 0 | **20 h** |

**Blockers:** E1h, E11a (if the quest spawns land as director stages; otherwise quest step effects, no blocker).

## 5. Risks

- The lead's AS program has its own channels (`accept`, `arrival`); the merged guide must keep its timing or the
  tutorial guide runs ahead at night.

## 6. Questions for Jake

None: approved cleanup.
