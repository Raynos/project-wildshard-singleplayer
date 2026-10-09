# Handoff (sf72-opus) — 2026-10-08, SF72 Signal Dunes headless, third 90-min lane (sf72-signal2)

Coordinator `wildshard-new` pushes. Landed locally with private-index commits; no browser, preview or Simulator left
running. Signal's canonical witness (`test/proof/sunscar-dunes/`) is UNCHANGED and still fails closed: the runtime now
owns the terrain, colliders, 13 homes, the whip, the whole signal quest and the Dune Matriarch's encounter, but not yet
an entry proof or the witness itself. Sky Reach belongs to sf72-sky.

## Landed

- Earlier lanes: `17c188c89` / `c6858f253` / `8b4ac8ca9` (interactions, native bake, `runtime/headless.ts` + homes),
  `e1c387f42` (shard-platform flags read the witnesses), `a4042f136` (whip as `ItemRuntime`), `3263244d4` (quest +
  interactions on `host.flags`). See git log.
- Step 3a, headless Matriarch: `combat/matriarchFight.ts` is her view-free `BossScript` (reset per checkpoint with a
  fresh body at 100 / 66 / 33 %, rise, `mem.fight/rise/phase`, storm goal + easing, beat invulnerability, victory),
  her definition and flag record. `runtime/matriarch.ts` runs it under the engine `BossBrain` with
  `silentBossPresentation`: the fire's `lit` port arms her, the intro locks the whip, `damage.modify` honours the beat,
  `death.checkpoint` respawns the player at the basin rim (PlayerHealth refills and asks it, as in the browser),
  victory sets `MATRIARCH_FLAG` + emits fact `sunscar.matriarch`, the quest then emits `sunscar.signal` + 5 coins, and
  the first fall pays 20 coins. Her body is the homes keeper's 14th slot (`ports.boss`): six draws from the shared
  stream per reset, shared tokens, `MatriarchBrain` via `homeBrain`; restore reinstalls each live body at its point in
  the saved adapter order (`settle()` after the other steps) so restores stay byte-exact. Graph sunscar→engine +5
  approved.
- Step 3b, one fight in two hosts: the browser's `DuneMatriarch` (combat/matriarch.ts) now runs `matriarchFight` and
  keeps only its views (fog, sand shells, boss bar, coin burst). Bake rerun on a clean build of the candidate
  (`3d090ae82`): actors / pieces / spots / bosses byte-identical, only the `combat/matriarch.ts` input hash moved.

## Exact next steps (in order)

1. **Entry proof**: `proveEntries` walking the shardfile's declared entryways on the native terrain (lanes ≥ 1,
   steps ≥ 1); `test/shards/sunscar-dunes/headless-runtime.test.ts` asserts it is still undefined, flip that.
2. **Witness**: point `test/proof/sunscar-dunes/run.mjs` at `runtime/headless.ts` through `HeadlessSimulation` +
   `trustedRuntime`; headless 10k, replay (a Matriarch mid-fight checkpoint + suffix, exact hash: the storm-phase
   checkpoint in `headless-matriarch.test.ts` already restores byte-exact over 1200 ticks), ledger (both facts from
   gameplay, durable, deduped). Update compatibility.json / README only from the real run.
   **The hard part is a gameplay victory.** A naive whip driver (circle 10 m round the basin floor, crack when she is
   within 8 m) reaches phase II and dies repeatedly there: headless whip contact is the item row's body-centre test
   (aim point within 7 m of the eye, 0.9 m lane), so she is only in reach for one or two cracks per dive while each dive
   hits for 18. The witness needs a better tape (dodge the dive's 4 m sphere, crack on her climb, walk in on her when
   grounded: her centre stands 9 m off), never a direct hp write. The test's victory case uses one combat-pipeline
   blow and is not gameplay evidence.
3. Known gaps (not modelled, documented in source): prompt line of sight, crack commands not spending the whip's
   cooldown, the browser whip's unroll / second lash / pull / stagger, and no heavy attack in the tick protocol (the
   crank's double crack is a `script` command).

## Proof receipts (this lane)

- Clean-export full Vitest on slice A: 998/999 files, 5556/5557 tests; the one failure is AG7's graph count
  (sunscar→engine 119 → 124, the approved +5). Strict tsc (root + layers, and the candidate build's tsc), oxlint,
  ratchet, shard-coupling green. Candidate B: Signal tests 24 files / 68 tests and the 17 other Signal-touching files
  green with the new bake.
- Browser (clean `3d090ae82` build, muted Chromium iPhone 16 Pro): boot smoke standalone ×2 + grid PASS, 0 faults;
  `physics-baseline --mode=walk --shard=sunscar-dunes` 7 legs, 0 stuck; a Signal run lit the fire, walked into the
  basin, reached her fight, then the phase II checkpoint (hp 396/600, storm 1.0, `mem.phase` 1), 0 page errors.
- `shard-platform --json` Signal: public 42 / custom 4141 → 4270, runtime 796 → 876, share 0.0100 → 0.0097.

Plan-State: unchanged.
