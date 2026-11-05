# W7a: the grapple course (five hooks, the tower, the grapple time)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the grapple half of the old
**W10** ("approvals, showcase as second user") and the Grapple Reel upgrade effect (**LE6**'s grapple row).

## 1. The showcase piece

Zone 06, grapple course (`layout.js` `GRAPPLE`), outside the West Gate:

| Item | Rows |
|---|---|
| Start pad + PB board | a `world/courses` row (W6d), record "Grapple time" |
| Hook 1 pole 12 m, hook 2 pole 16 m | grapple hook rows (rings) |
| Hook 3 water-tank roof 18 m | hook + a ladder up the tank (W8a) |
| Hook 4 mast 28 m | hook |
| Hook 5 the 45 m tower | hook; decks every 9 m with a ladder (W8a); vista ★3 on top |
| Hops | 23, 31, 35, 21, 36 m (all inside the 38 m default range) |
| The grapple | given on arrival (Q1); the Grapple Reel (L10, W2b) adds reel speed and +8 m reach |

The 99 m zipline from the tower to the zip house is W7b.

## 2. Engine / game / host work, just in time

Research:

- **Grapple is an approved platform feature:** `src/game/grapple/` (`sim.ts`, `course.ts`, `tool.ts`, `ribbon.ts`,
  `fontPreparation.ts`; 1,124 lines with `format/grapple.ts`), every module listed in `lint/platform-pending-users.json`
  (lines ~2192–2230) under **G478** ("grapple-traversal", approved feature). One user: Nine Dragon (`tool.fei-zhua`,
  `held.claims.enter … grapple: { item: 'tool.fei-zhua', … }` in its `generators/productOutput.ts:112`). So the old
  W10 "approvals" are done for the grapple; the showcase is its second real user.
- **Mode rows exist:** `state/modes` `grapple: [{ id, minRange 2.5, maxRange 38, zipSpeed 22, fireTime, biteTime,
  reelTime, windowX, windowY }]` (`src/format/modes.ts:45`). Hooks are a roster of ring centres
  (`src/game/shared/grapple/sim.ts:11` `GrappleCourse { mode?, name, hooks: Vector3[], clearance? }`).
- **A gate a data-only shard must pass:** `src/format/shardSchema.ts:285` refuses `ride`, `grapple`, `zipline` and
  `updraft` rows unless the product has a runtime binding `modes` **or a declared client page**, which
  `src/format/runtimeBinds.ts:43` defines as a quest-host `page` with a version. The showcase declares one (W1b), so it
  passes, but the player phase is coupled to the quest page for no reason (Q2).

Work:

| Row | Shape | Layer |
|---|---|---|
| world hooks | `state/modes` grapple profile + `world/hooks: [{ id, at, ring: 'pole'|'roof'|'mast' }]` (today the hook list lives in Nine's `sim/headless-constants.json` source) | format + game `grapple/course.ts` reads world rows |
| start-on-arrival item | `items` grant on first entry (`tool.grapple`) | data |
| Grapple Reel effect | `grapple: { reelMul, rangeAdd }` effect row on the owned id | game `loadout/effects.ts` |
| the course | a `world/courses` row with `tool: 'tool.grapple'` (W6d) | data |
| (Q2) decouple | the traverse-mode gate reads "runtime null" alone | format `shardSchema.ts:285` |

Guards: none new. Tests: `test/grapple-platform.test.ts`, `test/grapple-guard.test.ts`,
`test/grapple-font-preparation.test.ts`, `test/nine-practice-*.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof |
|---|---|---|---|
| Nine Dragon | Fei Zhua grapple, hooks from its headless constants, its Explore grapple room | hooks as `world/hooks` rows; same positions | `test/grapple-platform.test.ts`, `test/nine-practice-law.test.ts`; grapple across the stack in game |

No save risk (grapple state is transient).

## 4. Done when, hours, blockers

**Done when:** you arrive holding the grapple, run the five hooks to the tower top on the clock, the board keeps the
best; the Grapple Reel (Developer Scrip) changes reel speed and reach; Nine's grapple unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 6 h | 4 h | 12 h (Opus: poles, tank, mast, tower) | **22 h** |

**Blockers:** W6d (the course), W8a for the tank and tower ladders (or plain stairs until then).

## 5. Risks

- The 45 m tower is the tallest west silhouette; its LOD and shadow cost are measured in W12.

## 6. Questions for Jake

1. **How you get the grapple.** (a) everyone has it from arrival in this shard; (b) the weapons shop sells it at L1;
   (c) it is lent at the course start like the range. **Recommended (a):** it is a traversal tool the whole west uses
   (tower, vistas, caches), not a weapon.
2. **The quest-page gate on traversal rows.** (a) let any data-only product declare zipline / updraft / ride / grapple
   rows without a quest page; (b) keep the coupling. **Recommended (a):** a one-line rule change; the coupling is an
   accident of how Sky and Signal were first migrated.
