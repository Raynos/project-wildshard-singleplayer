# W3a: the weapon range's melee yard, the range loan, targets and personal-best records

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the sword and spear part of the
old **W6** (spear 1U → second user), **M3.3**'s view of Driftwood's arms (no change needed, see §3), and a new
**personal-best records** host every west course uses (19l: "west toys save personal bests and have feats").

## 1. The showcase piece

Zone 02, weapon range 78 × 102 (`round-4-blockout/layout.js` `RANGE`):

| Item | Rows |
|---|---|
| Melee yard 20 × 48 | 3 sword dummies, 3 spear dummies with ring targets |
| Range loan | stepping through the range gate lends every range weapon you don't own; leaving returns them (Q1) |
| Berm, lanes, firing line | geometry for W3b/W3c's lanes (targets land there) |
| Range-score board | a personal-best board at the firing line: best score per drill |
| Drills | "Six dummies" (melee: hit all six), later "Lanes" (W3b) and "Rifle" (W3c); each a scored run with a PB |

The showcase's sword and spear are declared as data: the sword on `held/arms` (as Driftwood and Nine do), the spear on
the polearm host's rows.

## 2. Engine / game / host work, just in time

Research:

- **Dummies and a loan already exist, in a separate room.** The engine's practice room (`src/engine/client/practice/TrainingArena.ts`,
  463 lines: "a 100 × 100 m enclosed grid room and three hit-reactive humanoid dummies") uses `TrainingDummy.ts`,
  `DummyMotion.ts`, `physics/trainingTargets.ts` and **`practiceLoan.ts`** (`enterPracticeLoan`: "lend every weapon …
  leaving ends the loan", E298 A) over `EquipmentService.lendAll`. None of it can be placed in a shard: the room is its
  own space. Users: the practice room and the Weapon Explorer (`src/game/client/session/play.ts`, `loadout.ts`).
- **World strike targets exist:** `src/format/worldTargets.ts` (`world/targets`, KA6): `{ id, weapon, at, radius, scan:
  cone|ray, effects: flag|interaction|hint }`. No score, no rings.
- **Personal bests are not saved anywhere.** The course host keeps `best` in memory only
  (`src/game/client/practice/numericCourse.ts:11,15` `ProjectedState { best: -1 }`); no board exists in the world.
- **Spear:** `src/game/client/weapons/heldPolearm.ts`, one user (Nalati), a pending-user row in `lint/platform-pending-users.json`.

Work:

| Row / host | Shape | Layer, why |
|---|---|---|
| `world/practice` dummies | `dummies: [{ id, at, yaw, variant, rings? }]` reusing `TrainingDummy` model, motion and `trainingTargets` bodies | game (placement + loan rules) over engine (dummy, motion, bodies): the engine pieces stay engine words only |
| loan zone | `loan: { region: box, weapons: [ids], returnOn: 'exit' }` over `practiceLoan`'s `lendAll` / `exit` | game; refuses to lend outside its region |
| scored drill | `drills: [{ id, targets: [ids], score: 'hits'|'rings'|'time', board }]`; scoring in a commons AS (`src/commons/scripts/drill.as`) | AS for the scoring rule, rows for everything else |
| **records** (new host) | `ui/records: [{ id, label, unit: 'time'|'score', better: 'lower'|'higher', board?: { at, yaw } }]`; saved per shard (`ws.records.v1`), read by boards, feats (W9b) and the Bag | game; one host for five courses, first user here |
| PB board | a world sign row drawing a record's best and last | game client-only view |

Host bar: records has one shard user (the showcase's five boards) until another shard keeps a best; Nalati's and Nine's
Explore playgrounds (dev tools, W0e) may write to it in W6d (Q3), else it lands with a G595 pending row. The dummy placement host has one user (the showcase) and the practice room
underneath it; it needs your G595 approval (Q4). Guards: `engine-words` (no "sword"/"spear" in engine: the
dummy is a "target figure"), `no-url-switch`. Tests: extend `test/practice-loan.test.ts`, `test/held-polearm-preparation.test.ts`,
`test/held-arms-platform.test.ts`; new `practice-dummies.test.ts`, `records.test.ts` (save, compare, board text).

## 3. Other shards in this slice

| Shard | Touched? | Step | Proof |
|---|---|---|---|
| Nalati (spear) | the polearm host gains a second user; no code change if the rows suffice | none, or a row field if the showcase spear needs one | `test/held-polearm-preparation.test.ts`, `test/nalati-mounted-lance-verbs.test.ts`; a spear thrust in game |
| Practice room / Weapon Explorer | `practiceLoan` gains a region form; the room keeps its call | room keeps `enterPracticeLoan` | `test/practice-loan.test.ts`; the room in Developer |
| Driftwood, Nine (sword on `held/arms`) | not changed: the showcase declares its sword on the same rows | none | `test/held-arms-platform.test.ts` |

No save risk except the new `ws.records.v1` key (new, empty for everyone).

## 4. Done when, hours, blockers

**Done when:** walking into the range lends the sword and spear (and later every range weapon), leaving returns them;
the six dummies react and the "Six dummies" drill scores a time and writes a PB that the board shows and survives a
reload; the practice room still lends its kit.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 22 h (Codex rows/records; Opus dummy placement and board look) | 4 h | 10 h (range ground, yard, board) | **36 h** |

**Blockers:** W0b (the Range Gate). W2b for bought weapons is not a blocker: the loan covers the range.

## 5. Risks

- `TrainingDummy` was built for one room and three dummies; six in the open world plus W3b's targets need the body
  cap (`BODY_CAP` phone 40, `engine/shared/physics/bodies.ts:84`) checked: dummies are kinematic, not dynamic.

## 6. Questions for Jake

1. **The range loan.** Weapons are bought and level-locked (19j), but the range is practice only. (a) the range lends
   every weapon inside its fence (try before you buy); (b) only weapons you own work at the range. **Recommended (a):**
   a level-1 player can try every weapon in the first minute, and the shop sells what they liked.
2. **Personal bests: per shard or global?** (a) saved per shard (like levels, 19a); (b) one global table. **Recommended (a):**
   each shard's courses are its own.
3. **Nalati's and Nine's playground bests** (Explore dev rooms; today they reset on reload). (a) they write to records
   too (a best that survives a reload, and the host gets two users); (b) leave them in memory. **Recommended (a):** one
   line each in W6d, and it gives the records host its second real user.
4. **Approve the placeable dummy host (G595, one user).** (a) approve it as platform (the practice room's dummies are
   its engine half, and every future shard with a training yard can place them); (b) keep the dummies as showcase rows
   over the engine pieces with no game host. **Recommended (a):** it passes tests 2–6 and a training yard is a common
   shard feature.
