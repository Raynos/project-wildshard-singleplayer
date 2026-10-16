# C7 movers: close review (G466 (8), G454 host bar)

sp-R7, short Opus review lane of SHARD-PLATFORM, 2026-10-16, at `180f56494`
(C7's last commit `9c47cee6b`; nothing touched the C7 files after it).
Read-only: no code changed. Owner sp-x1 reported **DW 0, Pine 14** C7 lines.

**Verdict: C7 NOT CLOSED.** Two of the six new or changed hosts fail the
rule of two, and both failing hosts exist only so Pine's shard code can run
its own movers outside the declared mover host. The Pine canoe's sim
(`CanoeRide`) and the Pine door's sim (open/progress state, collider gate)
are still shard TS. The ruler shows 14 C7 lines because its file roles give
that code to C5 (`/quest/` path), C3 and C1, not because it moved. The fix
list is at the end.

## Ruler at HEAD

Command (build mirror, slot `check3`, exact HEAD):
`node scripts/build-mirror.mjs run 180f56494 --slot check3 -- node scripts/shard-platform.mjs --json`
ran and built every product. The output ruler gives Pine and DW no component
columns, because both are unclosed. The source-basis component inventory
(the G458 `countOutput(…, includeSources, sourceProgress)` that the replan
used) was read in the same mirror slot:

| Shard | C1 | C2 | C3 | C4 | C5 | C6 | **C7** | C8 | C9 | unknown owners |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pine | 3,525 | 1,345 | 155 | 2,715 | 1,770 | 1,293 | **14** | 168 | 2,121 | 71 |
| Driftwood | 3,028 | 1,285 | 0 | 1,197 | 1,181 | 805 | **0** | 85 | 1,727 | 66 |

This matches sp-x1's **DW 0 / Pine 14**. The 14 spans are `quest/index.ts:1`,
`quest/rides.ts:4,7,23` and
`runtime/props/buildingLife.ts:2,77,79,106,108-110,112,118,122`.
`componentWave` (`scripts/shard-components.mjs`) refuses "closed" for every
component while a shard has unknown owners (71 and 66 today). So the ruler
can't show C7 closed, even at 0, until those owners are attributed.

## 1. Hosts against the G454 bar

Tests: (a) two real users, (b) no shard nouns, (c) shards differ only in
data, with no shard TS callbacks, (d) headless / server-safe, (e) deletion
test (drop one shard's rows and the host still means something).

| Host | a | b | c | d | e | Verdict |
|---|---|---|---|---|---|---|
| H-cable: engine `CableTraversal` + `installCableModes` | yes | yes | yes | yes | yes | **PASS** |
| H5 fixed drivers: `MoverMechanic` on native mover rows | yes | yes | yes | yes | yes | **PASS** |
| H5 transit track: `MoverTransitSchema` + transit step | **no** | yes | partial | partial | **no** | **FAIL** |
| H5 hinge helper: `MoverMechanic.hinge` / `approach` | **no** | yes | partial | yes | **no** | **FAIL** |
| Movers `output: 'json'` bake option | yes | yes | yes | yes (build-time) | yes | **PASS** |
| Root-mapped sidecar sections (`mergeProjectSections`) | **no** (DW only) | yes | yes | yes (build-time) | n/a | **PASS once Pine uses it** (fix 1 gives the 2nd user) |

### H-cable: engine cable traversal, PASS

- Users: Pine `data/zipline.ts:9` (rows), `runtime/quest.ts:231,299`
  (native `updateNative`), `quest/index.ts:338,428` (page `bindView` /
  `update`); DW `data/modes.ts:5`, `world/Zipline.ts:34`, `runtime/quest.ts`.
- Nouns: zipline, cable, trolley, landing; no shard names
  (`src/engine/sim/cableTraversal.ts` whole file).
- Data: rows enter as `ModeRows['traverse']` through `parseModes`
  (`cableTraversal.ts:180-185`, `engine/player/modes.ts:200-211`); per-shard
  differences are `profile` / `lifecycle` / `presentation` fields. One
  leftover callback surface: `ZiplineDriver`'s optional `onRide` constructor
  argument (`cableTraversal.ts:74`); no caller passes it any more. Not
  blocking; delete it in a later commit.
- Server-safe: `src/engine/sim/` is under `wildshard/sim-no-render`; it imports
  only three math (`Vector3`, `MathUtils`) and `Object3D` as a type
  (`cableTraversal.ts:4`). Native path `updateNative` (`:265-277`) is driven
  by both shards' headless runtimes.
- Deletion: either shard alone still uses every branch except the
  view/native split, which both shards use. PASS.

### H5 fixed drivers: native mover mechanic, PASS

- `src/engine/sim/moverMotion.ts:82-147`, installed from rows in
  `src/game/plugin/mover.ts:208-211` (`execution: 'native'`) and
  `src/engine/script/composition.ts:100,129-137`.
- Users: DW `driftwood.boat` (waves) and `driftwood.bridge` (static); Sky's
  12 rows (static ropes, winch hinge bridge, 8 winch rides). Per-kind:
  `static` has both; `waves` is DW-only and `winch` Sky-only, but they are
  data variants of one mechanic with bounded numeric fields, and both kinds
  predate C7 as guest drivers.
- No shard nouns, no callbacks (rows → `nativeMotion(row)`), renderer-free
  (three `Euler` / `Quaternion` math only, `moverMotion.ts:2`). Deleting DW
  or Sky leaves the other's rows running. PASS.

### H5 transit track (canoe), FAIL

- Schema `src/format/moverMotion.ts:51-58`, step branch
  `src/engine/sim/moverMotion.ts:64-81`.
- (a) One user: Pine's canoe (`generators/canoe.ts:9`,
  `quest/rides.ts:23`). DW's boat is a `waves` row; Sky has no transit.
  G454 (10): a new host lands with its second user or counts as custom.
- (c) The mechanic takes data, but it is not reached from rows: Pine
  constructs it in shard TS and keeps the entity state, command latch,
  clock, carry application and an `onRide` TS callback
  (`quest/rides.ts:17-20,32-55`; `quest/index.ts:341-351`). The row ships as a
  private blob (`movers/canoe.json`, `quest/index.ts:131`), not the
  `world/movers` section that DW's and Sky's rows use.
- (d) The step is renderer-free, but the canoe only runs on the page: Pine's
  headless runtime has no canoe, though it moves the player.
- (e) Drop Pine and the whole transit branch and schema are dead code.

### H5 hinge helper (doors), FAIL

- `MoverMechanic.approach` / `hinge`, `src/engine/sim/moverMotion.ts:43-54`.
- (a) One user: Pine `runtime/props/buildingLife.ts:92`. Sky's hinge bridge
  uses the different winch law (`moverMotion.ts:87-93`), not this helper.
- (c) It is a pure easing function called from shard code; the door's sim
  stays in Pine: open/progress state (`buildingLife.ts:19,88-94`), the
  toggle and collider drop (`bakedBuilding.ts:267-272`), and the kinematic
  piece's activation rule (`runtime/index.ts:133-140`,
  `quest/index.ts:227-230`).
- (e) Drop Pine and the helper has no caller.

## 2. The 14 retained Pine lines

The close bar admits view code that draws, with a written reason. A line
that exists only because shard TS drives a mover itself is rejected: it goes
when the mover moves onto rows.

| # | Lines | Where | Reported as | Verdict | Why |
|---|---|---|---|---|---|
| 1 | 1 | `quest/index.ts:1` `MoverTransitSchema` import | binding | **reject** | It parses the canoe's private blob (`:131`) because the canoe is not in `world/movers`; it goes with fix 1. |
| 2-3 | 2 | `quest/rides.ts:4,7` `MoverTransit` / `MoverMechanic` imports | binding | **reject** | Shard code constructs and steps the mechanic. |
| 4 | 1 | `quest/rides.ts:23` `new MoverMechanic(row)` | data-backed construction | **reject** | Sim construction in a shard; the declared mover host should own it. |
| 5 | 1 | `buildingLife.ts:2` `MoverMechanic` import | binding | **reject** | It exists for the shard-side door step (`:92`). |
| 6-7 | 2 | `buildingLife.ts:77,79` `doorPieces` | view | **reject** | It gives the physics registry each door's collider and its `swinging` sim state; collision is sim, not drawing. |
| 8 | 1 | `buildingLife.ts:106` `onDoor` | view | **accept** | A presentation subscription (door sounds, `runtime/audio/wiring.ts:56`). |
| 9-11 | 3 | `buildingLife.ts:107-110` `_doorMoved` | listener-only | **accept** | Fan-out to the sound listeners only; nothing reads it for state. |
| 12 | 1 | `buildingLife.ts:112` `_door` registration | view registration | **reject** | It registers the door into the shard's own sim loop and the interactables. |
| 13 | 1 | `buildingLife.ts:118` `_swing` | view registration | **accept** | Hung-lantern sway: pure drawing. Belongs in C3 (ambient life), not C7. |
| 14 | 1 | `buildingLife.ts:122` `_wheel` | view registration | **accept** | Mill-wheel spin: pure drawing (speed set by a quest flag). C3 or view. |

Accepted: 6 lines (`onDoor`, `_doorMoved`, `_swing`, `_wheel`). Rejected: 8.

Not counted in the 14 but C7 sim by function, attributed elsewhere by the
ruler's file roles (`scripts/shard-components.mjs:132-134,276-281`):

- `quest/rides.ts` `CanoeRide` body (the start latch, step call and carry)
  is C5 because of its `/quest/` path.
- The `buildingLife.ts:88-94` door step is C3 (file owner); the door toggle
  in `bakedBuilding.ts:264-273` is C1; the door piece activation in
  `runtime/index.ts:133-140` is C9; the mill door bar in
  `quest/index.ts:227-230` is C5.

- The cable mode rows are hand-written `data/*.ts`: Pine `data/zipline.ts`
  (9 lines) and DW `data/modes.ts` (6 lines), both C9 by file owner. The
  close bar allows no `data/*.ts`, and by function these are C7 rows.

These are counted somewhere, so the shard total is honest, but C7 can't be
called closed while the canoe and the doors run their movers in shard TS.

## Fix list for sp-x1 (C7 closes when these land and the ruler re-checks)

1. **Canoe onto rows.** Emit the canoe as a `world/movers` row with
   `execution: 'native'` and a transit motion (the root-mapped `sections`
   sidecar Pine's `generators/output.ts` already has room for), driven by
   `installDeclaredMovers` / `MoverRuntime` with its carry/landing as host
   output, and with headless parity. Delete `CanoeRide`'s state, step and
   carry code and the private `movers/canoe.json` blob. Pine keeps only the
   mesh/visibility view binding and the `setCanoeAway` presentation. The
   live bank/landing terrain sampling (`quest/index.ts:341-342`) moves to
   the generator. This also gives the sidecar host its second user.
2. **Doors onto rows, with a second user.** Give the reversible hinge a row
   form (an interact-toggled `hinge` track the host owns: open/progress
   state, collider follow and activation, the open/close prompt), installed
   by the mover host. Pine's cabin doors and the mill door use it. For the
   rule of two, either a second shard's door uses it in the same commit, or
   it is expressed through the existing hinge winch law that Sky's bridge
   uses. Otherwise `MoverMechanic.hinge` goes back into Pine and counts as
   custom (G454 (3)). `doorPieces`, `_door` and the `buildingLife.ts:88-94`
   loop leave the shard.
3. **Re-attribute honestly.** Once 1 and 2 land, remove the
   `buildingLife.ts#_swing` / `#_wheel` C7 owners (they are C3 view), and
   re-run the ruler. The accepted remainder should be the door-sound
   listener (`onDoor`, `_doorMoved`), with that reason written in the plan.
4. **Mode rows out of `data/*.ts`** (both shards): emit `PINE_MODES` and
   `DRIFTWOOD_MODES` from a generator as the `state/modes` section (the same
   TS-to-JSON move `69115bfe3` made for movers), so neither shard keeps a
   hand-written `data/` row file. This is DW's only C7 item.
5. Non-blocking: drop `ZiplineDriver`'s unused `onRide` constructor
   callback (`cableTraversal.ts:74`).

DW: fix 4 is its only C7 item. Its zipline is declared rows plus static
geometry and a view binding (`world/Zipline.ts`, C1), and its boat and bridge
are native rows.
