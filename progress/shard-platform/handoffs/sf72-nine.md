# Handoff (sf72-nine) — 2026-10-09, SF72 Nine Dragon Stack headless, part 3

Coordinator `wildshard-new` pushes. Nine's canonical witness (`test/proof/nine-dragon-stack/`) passes on its trusted
renderer-free entry `runtime/headless.ts`: `compatible: true`, still **transitional** (headless + replay passed, ledger
`not-declared` because Nine declares no fact). Open: the Fei Zhua, gates / fragments, Jian contacts on real targets
(test/proof/nine-dragon-stack/README.md). Identical in two independent native processes, ~14 s CPU for all three stages.

## Landed

- **84c4aedb2** (part 1): the engine swept melee clock (`@wildshard/engine/combat/sweptMeleeCore`).
- **e015703b3** (part 1): the declared floors renderer-free (`world/floorRows.ts`); `shard.config.ts` loads in Node.
- **26eedfb00** (part 2): the native collider bake (`runtime/physics.baked.json`, 23 pieces / 489 colliders),
  `runtime/headless.ts`, the Jian on `SweptMeleeCore` (`runtime/jian.ts`), the witness through
  `createTrustedHeadlessAdapter`.
- **This commit** (part 3): the portal-ride split, landed with the official map rebake.
  - `world/portalRide.ts` is renderer-free (the ride, `playerRider`, plus `snapshot` / `restore` of the ride's state);
    the HUD fade veil (`installPortals`, `engine/ui/ownership`) moved to `world/portalVeil.ts`; `plugin.ts` imports it
    from there (own hunk only).
  - `runtime/portals.ts`: the page's ride in the host's fixed step after the player's move; the hold is the page
    Player's `carried` (feet kept at the touch, velocity / fall / impulse / shove cleared), the transfer is
    `createPortalTraversal` on the host's physics / motor / feet, the settle is `spawn`'s resets facing the admitted yaw.
    Ride state + hold are continuation (`nine-dragon-stack.portals`); the settle clears `playerDash` (a0aa16128).
  - The Jian's heavy: the tick protocol's HEAVY hold (`heavy`, a0aa16128) drives `SweptMeleeCore.step(..., held)`, so
    the charged heavy charges and releases headless (`headless-runtime.test.ts`); not yet in the witness tape.
  - Witness tape: walk `SQUARE_ROUTE` from the spawn into the square's ring → north deck, step out 2.5 m and back in →
    the square (570 ticks, 20 Jian swings); replay checkpoint tick 400 is mid-swing AND held in the ring before the
    transfer. `portals.test.ts` adds a mid-ride snapshot / restore test.
  - Map: `scripts/bake-maps.mjs --shards=nine-dragon-stack` from the clean candidate's DEVSERVER build (stamp
    `61c8dd03…`). The physics bake is unchanged (its inputs already exclude portalRide.ts / portalVeil.ts).
  - Browser on the candidate build (iPhone 16 Pro, muted, Developer on): the G224 ride script rode all four decks
    4/4, 0 errors (north arrival (0, 0.01, 236); headless (0, 0, 236)); boot smoke standalone ×3 + grid PASS;
    facade instancing PASS (desktop / phone / iphone-desktop-quality, 0 batches); physics walk 0 stuck.

## Next, in order

1. **Fei Zhua sim split** (`grapple/FeiZhua.ts` 627 lines, `line.ts`, `course.ts`): a renderer-free rope / anchor sim
   (targeting by physics query, cable, anchor, pull / swing, climb) taking the physics queries and the player body as
   ports, in `grapple/` (not `world/`, so no map rebake); the browser `Tool` keeps input, HUD relabel, filament and FX.
   Headless: the tick protocol's jump / dodge / heavy (a0aa16128) for LOCK/JUMP; the lunge via `host.dashTo` +
   `sweptLunge` if the grapple's pull needs it.
2. **Gates / fragments:** the Well safety cap (`nds-grapple-guard`, baked `active: true`) opens on `NdRuntime.guardOpen`,
   which is the Fei Zhua's; once (1) runs headless, the cap's piece toggles in the host the same way.
3. Grow the witness (a heavy swing in the tape; a grapple across the Well) and shrink `open`; `transitional` drops only when nothing
   renderer-bound decides an outcome.

Plan-State: unchanged.
