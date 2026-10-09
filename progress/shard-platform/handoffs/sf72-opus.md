# Handoff (sf72-opus) — 2026-10-08, SF72 Signal Dunes headless, 90-min cap

Coordinator `wildshard-new` pushes. Landed locally with private indices + old-value CAS; no browser, preview or Simulator
left running. Signal's canonical witness (`test/proof/sunscar-dunes/`) is UNCHANGED and still fails closed: the runtime
does not yet own the quest, the whip, the Matriarch, the ledger or an entry proof. Sky Reach was not started.

## Landed

- `17c188c89` interactions: sp-x1's `runtime/interactions.ts` (logbook / well / oil / waymarks / signal fire, strict
  transient snapshot) behind `world/build.ts`, unchanged order; tests `test/shards/sunscar-dunes/interactions.test.ts`;
  official map rebake from the candidate's clean build. Graph sunscar→engine +1 approved.
- `c6858f253` native bake: `scripts/bake-signal-physics.mjs` (+ `signal-physics-inputs.mjs` freshness hash) →
  `runtime/physics.baked.json`: 13 homes' model-derived specs / seeds / scales (strider bodyY 1.966 from the fitted GLB),
  the Matriarch's spec (captured after play's own steps light the signal and the player enters her basin), 10 collider
  pieces. `physics-bake.test.ts` reproduces every baked seed/scale from the creature manager stream `Rng(5363 + 31)`,
  six draws per spawn (scale, rig seed, actor seed, timer, fleeUntil, callT). NB: the manager is seeded with the LEVEL
  seed (`layout.ts SEED` = shardfile seed 5363), not engine `SEED`'s default.
- `8b4ac8ca9` headless runtime: `runtime/headless.ts` (SDK `PrepareHeadlessRuntime`: admitted terrain collider +
  heights, baked colliders, `ground:false`), `runtime/homes.ts` (13 homes via `host.spawn/retire`, respawn clocks, the
  stream, 2 attack tokens = manifest `fight.attackers`, ray held until `SCOUT_FLAG`, 10 Hz decide / per-tick move),
  `runtime/homeBrains.ts` (shipping patrol-diver / skitterer / challenge-grazer, ports allocated once per body, contacts
  inside the 70° arc with canReach). Restore reinstalls the saved roster from `runtime.actor.<id>` recipes before the host
  restore, no stream draw; a changed spec refuses. Graph sunscar→engine +15, →sdk +3 approved.

## Exact next steps (in order)

1. **Whip**: install `data/items.ts` `weapon.sunscar-whip` as an engine `ItemRuntime` (template fixture pattern in
   `test/proof/_template/fixture.ts`), driven by `player` commands' attack; light 18 / heavy 16 contacts. Replace the
   zero-damage `host.probe` level weapon only if the item lane needs it; never invent a strike.
2. **Quest + interactions**: `SignalInteractions` on `host.flags` (it already takes `Pick<Flags,'has'|'set'>`), driven
   by `script` commands (`actorId: 'sunscar.interact'`, value = interactable index) with the browser radii (logbook 2.4,
   well 2.6, braziers 3 / crack 1.2, tower 2.6) and the well's heavy double crack; Sefa's talk sets `SCOUT_FLAG`. Quest
   state from `quests/signal.ts SIGNAL_QUESTS` through the game's declared quest path (browser: `bindRuntimeQuest`; likely headless counterpart:
   `DeclaredQuests` / `createQuestScriptPorts` headless); its snapshot = `SignalInteractions.snapshot()` adapter.
   Completion emits fact `sunscar.signal` + 5 coins via `context.emit` (`installLedgerEmitter` in the proof).
3. **Matriarch**: split `combat/matriarch.ts`'s `BossScript` (hp/phase/storm goal/invulnerable/checkpoint/reward) from
   its views (BossBar, fog, shells, CoinBurst, toasts); spawn `sunscar.matriarch` with the baked spec via `host.spawn`
   (her six draws come from the same stream, after the homes' draws), `MatriarchBrain` (`runtime/species/matriarch.ts`)
   at the same cadence, `BossBrain` continuation in an adapter; victory → `MATRIARCH_FLAG` + fact `sunscar.matriarch`.
4. **Entry proof**: `proveEntries` walking the shardfile's declared entryways on the native terrain (lanes ≥ 1, steps ≥ 1).
5. **Witness**: point `test/proof/sunscar-dunes/run.mjs` at the trusted `runtime/headless.ts` through
   `HeadlessSimulation` + `trustedRuntime`; headless 10k, replay (Matriarch mid-fight checkpoint + suffix, exact hash),
   ledger (both facts from gameplay, durable, deduped); update compatibility.json/README only from the real run.
6. Then Sky Reach from `sp-x4.md` (same shape: baked specs exist in `far-reach/runtime/physics.baked.json`).

## Proof receipts

- Clean-export full Vitest per slice: 992/5534, 993/5537, 994/5542 passed; root strict + layers + ratchet + hooks green.
- Browser (muted Chromium, iPhone 16 Pro / phone, HEAD `8b4ac8ca9`): boot smoke standalone ×2 + grid PASS, 0 faults;
  `physics-baseline --mode=walk --shard=sunscar-dunes` 7 legs, 0 stuck; the bake rerun on HEAD (which stages logbook →
  well → oil → 3 waymarks → fire → Matriarch through the extracted interactions) matched the landed bake exactly.
- `shard-platform --json` Signal: public 42 / custom 3797 → 4031, runtime 451 → 686, share 0.0109 → 0.0103 (new
  trusted headless code is custom); Sky unchanged 0.0152.

Plan-State: unchanged.
