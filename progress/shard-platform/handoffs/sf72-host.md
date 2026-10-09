# Handoff (sf72-host): SimHost player gravity + knockback done; Rapier restore parent bug open

**Done (2026-10-08):** `1ddf64e42` the SimHost player falls on Player.ts's shared fall law (`player/fall.ts`), `3c7c5c8f8`
creature `feel.blow` hits knock the headless player back on the shared shove law (`player/shove.ts`), `bc968b5c8` the
rail-jump proof reads `PLAYER_GRAVITY`. Gap 3 (a heavy flag on the tick protocol's attack) is not needed by any witness;
Signal's whip runtime already takes `heavy` if a lane wants to add `attack.heavy?: boolean` to `sdk/tickProtocol.ts`.
Follow-up for the Signal lane: its `homeBrains.ts` contacts carry no `feel.blow` tag, so its headless hits don't knock back
(the browser's `PlayerHurt.creature` adds the tag).

**Open: Rapier `World.restoreSnapshot` re-parents every parentless (static) collider to rigid body 0** (found by
sf72-sky3: a coParent miss lands on Coarena index 0). After a native restore a capsule standing on a static piece pins
(`CharacterMotor.pin`) to the first kinematic body, which breaks movers in Sky's played headless host.

- The one native restore is `src/engine/physics/Physics.ts:35` (`R.World.restoreSnapshot`), called only from
  `restoreSimHost` (`src/engine/sim/snapshot.ts:229`). The browser reaches it through grid continuation / live recovery
  (`src/game/grid/liveSession.ts` calls `restoreSimHost`), so the fix must hold there too.
- Next steps: (1) a regression test in `test/engine/`: a world with static colliders and a kinematic body, snapshot,
  restore, assert every collider's `parent()?.handle` matches the original (expect it to fail today); (2) fix in
  `src/engine/physics/`: record each collider's parent handle (or null) beside the native bytes at snapshot time, and
  after restore detect and rebuild any collider whose parent differs (Rapier JS has no re-parent call: recreate it
  from its shape / pose / groups / tag with the same handle order, or patch at the snapshot layer); check the WASM
  version for an upstream fix first; (3) prove `sim-snapshot`, the grid recovery tests and Sky's restore suite stay
  byte-exact or re-record with the reason.
