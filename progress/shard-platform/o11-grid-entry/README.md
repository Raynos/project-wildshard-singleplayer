# sp-o11: Sky Reach and Nine Dragon grid entry (SHARD-PLATFORM, 2026-10-12)

**Verdict: class (a), harness staleness, on both shards. No player-facing entry bug.** Both cells admit the player from
the road through their declared entry on HEAD `9693744b2` (DEVSERVER build, Developer on, muted, iPhone 16 Pro phone tier).

## The cause

look48's `capture.mjs` (and its forks sky35 / sky36 / sky40 / sky43 / sky46 / sky47, look25 / look28 / look30) build a
road entry with `gridFloorPlans(state, 'cell', …)`. That plan drives to a **flat waypoint 210 m from the cell centre**.
`frame-floor.mjs` resolves the same plan through `floorGridPortalPlan` with the cell's served `shard.json` entryways first;
the captures never did.

- **Sky Reach** declares a `socketLift` on every edge. The road ends on the landing deck, and a rail stops you at local
  z ≈ 222.8. From there you board the rising islet with USE (roadStop 228, topStop 212.6 at y 25). The flat waypoint at
  z = 210 is past the rail, in the air.
- **Nine Dragon** declares a `portalLink` on every edge. The road deck's portal at 236 m sends you to the square at
  y = 125. The flat waypoint at (0, 0, 210) lies under the square.

So the held-input driver walked into the rail / across the square for 150 s and timed out. In both cases the cell had
**already admitted the player**:

| repro (old route, phone) | stop |
|---|---|
| far-reach-road-entry | waypoint 0/1, local feet (0, 0.1, 222.8) on the landing, `current far-reach` |
| nine-dragon-stack-road-entry | waypoint 0/1, local feet (0.9, 125, 19.6) on the square, `current nine-dragon-stack` |

The same mechanism explains sp-o2's "the Sky road drive stops at its islet's portal edge" (sky47 already noted it). The
milestone frame floor uses the declared plans, and both road entries passed there (`../../frame-floor/milestone-c66b5b324-2026-10-11/`).

**TELEPORT=1** posed the player at the cell centre, 40 m up, from the road. That is not an entry. The cell's world is not
prepared under the feet, and a fall that began on the road recovers to the road (G101, `src/game/grid/roadRecovery.ts`;
`throughEntry` refuses any jump of more than 2 m between steps). So the wait for `current === cell` never ends. This is
harness, not admission: a player can't teleport. (Read from the code; `teleport-probe` was not run, because the quiet window
started.)

**Nine is DEVSERVER-only** in the grid catalogue. That is unchanged and needs no decision; look48 already ran `--devserver`.

## The fix

- `scripts/frame-floor-grid.mjs`: `gridFloorDeclaredPlan(page, state, plan)`, the host half of `floorGridPortalPlan`.
  It reads the served shardfile entryways in the page. `frame-floor.mjs` keeps its own inline fetch (sp-o13 has open
  hunks there); look48's capture now uses the helper.
- A route timeout now names the waypoint, the feet and the current cell. "timed out" alone hid this for two sweeps.
- `test/frame-floor-portals.test.ts`: the helper fetches the cell's shardfile and resolves the portal and the lift. It
  leaves a cell-to-cell leg alone and refuses a missing cell.

## Proof (fixed capture, HEAD `9693744b2`, phone)

`summary.json` has the witnesses: owner and inside equal the cell, the route has 0 witness failures (Sky: lift boarded,
ridden and walked onto the islet; Nine: portal road node seen and the square landed on), and there are 0 page and
console errors.

- `far-reach-grid-o11-phone.jpg`: Sunrest at the look48 pose, local (0, 30.02, −5.5)
- `nine-dragon-stack-grid-o11-phone.jpg`: the square at local (0.95, 125.02, 7.5)

The desktop re-run was blocked by sp-o6's quiet window (21:26Z). The fix is tier-independent: it changes the route, not
the game. look48's desktop failures were the same timeout.
