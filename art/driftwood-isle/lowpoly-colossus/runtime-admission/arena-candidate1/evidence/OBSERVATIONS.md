# Colossus native22 motion1: actual arena evidence

SourceHash: `7a4c5bc237574a93d7b5b6f3325a53cf0141054aafc86082f497baff24d905a5`.
Cloud Chromium headless shell, muted iPhone16Pro portrait402×874. This is diagnostic
player placement and render-only observer footage, not ordinary player skill or
physical-phone performance. Enemy health, AI, clocks and damage were never injected.

## Functional coverage

Run2 passed19 scoped assertions; observer run1 passed20, adding actual exposed
sword damage18 versus baseline12 (1.5×). Actual Start, both sweeps, slam, exact
slam-recover exposed field, both damage directions, enemy death,35 bout-local coins,
no postdeath strike, player defeat, blocked attack after defeat, Retry, reload
reentry, and unchanged empty browser/global/shard stores were observed.
First launch failed before gameplay because the default Playwright ffmpeg cache
was missing; failed-launch1.json is retained. Run2 used installed system ffmpeg;
observer used the established shared Playwright cache. Zero page errors in both
completed runs. These passing assertions do NOT mean complete runtime acceptance.

## Weighted world floor fails

1,212 actual rendered frames retain all22 joint transforms including scale.
Offline analysis uses all four skin influences per vertex, original native22
inverse binds and captured actor-world transforms. Living minimum+0.027m;
dead minimum−0.201035405m;112 frames below−0.005m.155 corpse frames include105
frozen corpse frames at−0.201035223m. Direct THREE getVertexPosition sampling
independently reads settled−0.201035223m (roundoff difference below0.000001m).
Before settling, the corpse temporarily floats around+0.8m above the floor.
The final corpse remains largely upright. No contact or collider acceptance.

## Event lifecycle diagnostics, with corrected correlation

Every dead frame retained tg-state1 despite deathT reaching1.40 living tg-state6
frames occur during PLAYER DEFEAT, frames1168–1207/game101.250–104.282s, NOT Retry.
The playerDefeat snapshot has enemy alive=true/HP480/tg-state6/awake0. Both Retry
snapshots already restore tg-state0, so no delayed Retry pose claim is supported.

Source inspection suggests two separate issues:
- PracticeCreature.ts:update flushes the applied combat events but runs the guest
  fixed callbacks only while animal.alive. A lethal enemy event can be enqueued
  without a subsequent guest step; corpse stage then remains its previous attack.
- decisions.ts:publish filters hit/death subjects for spawnGroup bindings only.
  Single borrowed bindings can receive player actor.died. decisionScriptBindings.ts
  dispatches onDeath without a subject guard; tide-root-colossus.as:onDeath
  unconditionally calls pose6. This matches the living enemy's player-defeat stage6.

Actor instance/world IDs were not recorded, so identity reuse is not directly
proven either way. Source retry disposes its bout and creates a new Animal with
fresh mem; observations do not show retained Retry memory. No shared code changed.

Suggested bounded regressions for the owning host lane:
1. Lethal target damage drains that target's guest death once and sets corpse stage6
   without allowing another strike or duplicated reward.
2. Player death must not invoke the surviving enemy's own onHit/onDeath subject
   handlers; verify HP480 remains alive and no enemy death pose/awake0 transition.
3. Retry captures actor identity plus guest event queue, fields and strike snapshot;
   fresh actor, no old event replay, HP480/player100/coins0, stage0 and clean stores.
These tests need to preserve deliberate multi-actor binding semantics.

## Visual limitations

Observer full body is about140 pixels tall. The clips document genuine phase and
settle cycles, not close-up anatomical attachment acceptance. Existing material
semantic loss, folded shin/attachment weaknesses, and ~3.93m mesh reach versus
4.7m sweep/6.2m slam damage extents remain. Static nine-view likeness was not rerun.
Visual/runtime/contact acceptance remains false.

Documentary video excerpts retain real-time source timing:0–30s attacks/exposed;
78–106s death/settle/Retry. Raw full recordings and hashes retained in the closure.
