# Handoff: sf72-signal-rows (SF72, Signal Dunes' behaviour as declared rows), 2026-10-09

Status: unfinished. **Next lane: Codex** (Claude's budget is spent). Inventory and move list:
`progress/shard-platform/m3-status/signal-8020.md`.

## Landed

- `a755bf10e` declared interaction rows (brief item 1): `@wildshard/game/quest/interactionRows` +
  `@wildshard/sdk/interactions`; Signal's interactions are public rows. Share 18.8 % → 19.6 %, runtime 855 → 777 / 965.

## Item 2 (generic lash item): built and partly proven, NOT landed — `sf72-signal-rows2.patch` beside this file

The coordinator approved the new export `@wildshard/game/systems/items/lash` (plus `@wildshard/sdk/species` and an
engine evaluator beside `ai/strikes` for item 3). Apply against HEAD `9f2d88e75` or later:
`git apply progress/shard-platform/handoffs/sf72-signal-rows2.patch` (checked: it applies cleanly). The patch
does not carry the one package line; add it by hand to `src/game/package.json` `exports`, after `./systems/items/declared`:
`"./systems/items/lash": "./systems/items/lash.ts",`.

What the patch does:
- **New `src/game/systems/items/lash.ts`**: the contact geometry moved from `weapons/lash.ts` (`lashVolumeHit`,
  `lashLane`, `lashContact`, `LASH_CHEST`, `LASH_BODY`), plus `lashSpec(row, timing, moves)` (reads a declared weapon
  row) and `LashRuntime`: `swing` / `cool` / `advance` / `cancel`, the unroll, the heavy's second lash, pull, stagger,
  `crackWorld`, `strike`, and `snapshot` / `restore`. Ports: `aim`, `body`, `targets`, `world`, `hit`, `source`, `fired`, `struck`, `caught`.
- **`weapons/Bullwhip.ts`** keeps only the view (cord, wrap, charge input) and drives `LashRuntime` with `source: 'env'`.
  `weapons/lash.ts` is deleted. `WHIP_TIMING` and `WHIP_MOVES` move into `data/items.ts`, which is public.
- **`runtime/whip.ts`** runs on `LashRuntime` instead of `ItemRuntime`, with `source: host.player.health`, the same as
  before (Boss intro invulnerability keys on it, in `ai/phases.ts`). It aims each lash at the target the command named,
  where that target stands when the lash lands (the row's `lockOn`). A crack row is reached as follows:
  - a `light` row by the first lash of any crack;
  - a `heavy` row by the second lash of a double crack (the first lash wraps it).
  The browser's levers and braziers answer the same way. The snapshot is version 2: the lash state plus the aim.
- **`runtime/headless.ts`** builds the world targets from the crack rows (`row.crack`, `row.at` → `spots.crack`).
  This was old next-step 3, and it removes the `BRAZIERS` / `SIGNAL_ACT` indexing.
- **`src/game/quest/interactionRows.ts`**: a command now runs only prompt rows. A crack row runs on the tick that
  `crack.cracked()` names its act, which is when the lash lands, after the command. The whip's step must be installed
  before the interaction step.
- **Test changes:**
  - New `test/shards/sunscar-dunes/whip-parity.test.ts` + `whip-parity.json`: 13 browser cases, the coordinator's 9
    plus second lash, pull, kill-no-pull and crank wrap. Each case records swings, the full damage requests, impulses,
    staggers, world cracks, callbacks, and the lash view on every frame. The trace was pinned from the pre-refactor
    Bullwhip.
  - `lash-contact.test.ts` and `witness.ts` now import from the new module.

Proven so far, on a clean export of HEAD + the patch:
- **Typecheck:** clean.
- **Browser whip:** byte-identical; whip-parity is 13/13 green against the pinned base trace.
- **Witness:** passes from a real run, `compatible: true`. Two native runs gave identical output. The replay is exact
  and `workerExact` holds.
- **Witness numbers that changed, and why.** Headless lashes now land 0.12 s after the swing, like the browser's.
  The crank's row runs on the double crack's second lash (0.32 s). Creatures therefore take hits later and the fight
  plays out differently:

  | Number | Before | After |
  |---|---:|---:|
  | ticks | 12,636 | 12,459 |
  | victory tick | 12,516 | 12,339 |
  | blows | 15 | 14 |
  | shoved ticks | 165 | 154 |
  | replay checkpoint tick (storm 0.687) | 10,710 | 10,680 |
  | suffix ticks | 1,926 | 1,779 |

  Unchanged: 25 coins, both facts, entries 92 / 46,095, 1 attempt.
  New hash `378b731986cf2d609e65071945937b78f76d4ab056f92b55fb541547efda6a81`.
  The tape issues only light creature cracks, so the second lash, pull and stagger never fire against creatures in
  the witness. Only the crank uses the second lash.

## Next steps for the Codex lane (in order)

1. Apply the patch and add the package line. Rebuild the clean export:
   `git archive HEAD` → `scripts/link-node-modules.mjs` → `pnpm gen`.
2. **Update the 10 Signal tests that encode the old crack-on-command timing.** `pnpm exec vitest run test/shards/sunscar-dunes` lists them:
   - `headless-quest`: 3 tests. A crack act now lands about 8 ticks later, and the crank about 20 ticks later; step
     the host until then.
   - `headless-runtime`: "cracks the declared whip row through the platform ItemRuntime". Rename it. It now reads
     `lash` instead of `item`, the move ids are `sunscar.whip.crack` / `.double.1` / `.double.2`, and the hit lands at
     `unroll`.
   - `headless-matriarch`: 4 tests.
   - `grid-discovery`: the measured runtime cost changed.
   - `physics-bake` "refuses stale source": `world/build.ts` is unchanged, so check which hashed input moved. Probably
     `runtime/headless.ts`; rebake if the bake hashes it (`scripts/bake-signal-physics.mjs`, from a served build).
3. Re-record `test/proof/sunscar-dunes/compatibility.json` from two native runs
   (`node --import ./scripts/sim-node-loader.mjs test/proof/sunscar-dunes/run.mjs all`). Put the numbers above in the
   audit `candidate` line.
4. **Gates:**
   - the guards (`scripts/shard-coupling.mjs --check`, `lint/ratchet.mjs`, `scripts/check-graph.mjs --paths`);
   - oxlint on every touched file;
   - the clean-export full suite;
   - boot smoke, including the developer Signal case;
   - the Signal walk baseline at 0 stuck;
   - a Signal browser run that cracks the crank and a brazier.
   Then land it with a private index. Report the share and runtime numbers (`runtime/whip.ts` shrinks;
   `weapons/lash.ts` −66 lines; `data/items.ts` gains the public timing).
5. **Item 3: the SDK species / strike row with a data-only weight.** Approved, not started. `StrikeSpec.weight` is a
   function today (`src/engine/ai/strikes.ts:29`). Add a data weight (e.g. `{ base, near?: { within, gain }, phase?: … }`)
   with an engine evaluator beside `ai/strikes`, and publish `@wildshard/sdk/species` (row type + parser). Coordinator
   condition: every existing strike decision stays bit-identical, proven by an oracle test over the existing strike
   tables of Signal, Pine and Sky that compares the old function weights with the evaluated data weights. Then
   `runtime/species/*` numbers move to `data/`.
6. Leftovers: headless prompt line of sight (`interactionRows` "not modelled"). The browser's source is `env` and the
   headless one is the player actor: one rule would need the boss-intro guard to read `actor.player` tags instead.
