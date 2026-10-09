# Handoff (sf72-sky) — 2026-10-08, SF72 Sky Reach headless, 90-min cap

Coordinator `wildshard-new` pushes. Landed locally with private indices + old-value CAS; no browser, preview or
Simulator left running. Sky's canonical witness (`test/proof/far-reach/`) is UNCHANGED and still fails closed: the
runtime does not yet own the War Fan, the movers, the quest, the ledger's quest fact or an entry proof. sp-x4's steps
1–3 are done, step 4 is done for the Roc encounter only, step 5 is open.

## Landed

- `defff10d1` engine: `src/engine/player/impulse.ts` (addImpulse / decayImpulse: e^(-3.5 dt), zero under
  0.05 m²/s²) shared by `Player.ts` (bit-identical; `test/engine/player-impulse.test.ts` passes unchanged) and
  `SimHost.impulsePlayer(v)` / `host.playerImpulse`, carried through the motor with the command move, then decayed.
  Snapshot `player.impulse` is optional (omitted at rest, so unshoved hosts keep their bytes).
- `66330c07b` runtime: `runtime/headless.ts` (structures-only: `ground:false`, analytic floor -1000, baked boxes /
  quaternions / hulls, inactive pieces out, `setFloorQuery(floorBelow)`), `runtime/flock.ts` (8 flyers at install in
  shipping order, 5 goats on the first fixed step on the first WORLD floor under deck + 2; the manager stream
  `Rng(6417 + 31)`, six draws per spawn, goats' wander draws from it; `groundHeight` / `levelGround` per body;
  `killBelowWorld` at manifest killY, new engine export `./entities/killHeight`), `runtime/flockBrains.ts` (orbit-diver,
  burst-flyer with the host impulse, ram-grazer, StormRocBrain with its gale-wall shove injected; contacts as
  PlayerHurt.creature files them, 70° arc + canReach; no attack cap on Sky). Strikes / variants moved renderer-free
  (`runtime/strikes.ts`, `runtime/variants.ts`, values unchanged). Rebake: actors + pieces byte-identical.
- `3361c50c3` Roc encounter: `runtime/rocEncounter.ts` (the view-free BossScript + definition + ROC_ID / BOSS_REWARD),
  used by `combat/stormRoc.ts` (browser, same behaviour) and `runtime/roc.ts` (BossBrain armed at install,
  silentBossPresentation, damage.modify shield, death.checkpoint, first fall → `far.roc.down` + fact `far-reach.roc` +
  25 coins via `context.emit`; `locked()` through the intro). Restore reinstalls landed goats last (`flock.land()`).

## Exact next steps (in order)

1. **War Fan** (`weapons/WarFan.ts`, the G51 cone / heavy / impulse recipe; `FAN_ROW`, `data/items.ts`): extract its
   swing / heavy / GUST math into a renderer-free module both the browser fan and a headless adapter use (as
   rocEncounter does), driven by `player` command attacks; respect `roc.locked()`; GUST turns vanes (`gustVanes`,
   `VANE_REACH`) once the notes are read. Replace the zero-damage `host.probe` only through the item; never invent a strike.
2. **Movers**: `installDeclaredMovers` headless for `MOVERS` (the four islet lifts are the shardfile's compiled
   behaviour/islet.as rows + road gates; `commandSocketLift` for RIDE / CALL) and the winch bridge (`far.winch.bridge`,
   command 1 when `far.roost` + `far.vanes`; `far.bridge` flag on raise). Their colliders replace the baked inactive
   `far.bridge.crown` only through the mover poses.
3. **Quest**: `quest/install.ts` steps on host flags (notes interact → `far.notes`; roost clear = the three roost rays
   dead → `far.roost`; vanes → `far.vanes`; raise → `far.bridge`; completion → fact `far-reach.quest` + REWARD 10 coins
   through the declared quest path, as Signal's `runtime/quest.ts` now does).
4. **Entry proof**: `proveEntries` riding the four socketLift entries (lanes ≥ 1, steps ≥ 1, liftRides / liftCalls).
5. **Witness**: point `test/proof/far-reach/run.mjs` at `runtime/headless.ts` through the trusted runtime; headless
   10k, replay (Roc mid-fight checkpoint + suffix, exact hash), ledger (both facts from gameplay); update
   compatibility.json / README only from the real run.

## Host gaps (not built, by the coordinator's call)

- The SimHost player has **no gravity**: a shove's lift is carried and never pulled back; walking off an edge floats.
  A traversal / entry proof over Sky's gaps will need it (or a host fall model) to be honest.
- No creature-blow knockback: the browser's PlayerHurt also calls `Player.shove` on every creature hit.

## Proof receipts

- Clean-export full Vitest per slice: 994/5539, 999/5561, 1000/5568; strict typecheck, oxlint, ratchet, coupling,
  graph and hooks green. Graph far-reach→engine +18 then +6, →sdk +3 (approved).
- Browser (muted Chromium, iPhone 16 Pro, candidates ee87347c4 / efa4013fc): boot smoke 3/3 PASS ×2, 0 faults;
  `physics-baseline --mode=walk --shard=far-reach` 10 legs, 0 stuck ×2; both bakes matched the landed recipes exactly;
  a Sky run set down on the crown went intro → fight with the Roc off its perch and stooping, 0 page errors.
- `shard-platform --json` Sky: public 93 / custom 6041 → 6276, share 0.0152 → 0.0146 after slice 1 (trusted headless
  code is custom).

Plan-State: unchanged.
