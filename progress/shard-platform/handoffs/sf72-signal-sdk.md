# Handoff: sf72-signal-sdk (SF72, Signal Dunes toward 80/20), 2026-10-09

Status: unfinished (the 90-minute lane ended). Inventory, numbers and the ordered move list:
`progress/shard-platform/m3-status/signal-8020.md`.

Landed: `4dca8153a` platform home keeper (`@wildshard/game/shardfile/homeKeeper`), `58d6abc9e` layout / strings /
brazierFlag into the public folders + platform boss row (`@wildshard/game/shardfile/bossRow`), `23e55d0dd` Signal's boot
proof, and the commit carrying this file: world cracks gated by the whip row's cooldown.

Signal now: public 185 / custom 4139 (4.3 %), runtime + trusted 854 / 965; boot, headless, replay, ledger true;
gridReady false; transitional true.

Next, in order (line budgets in the inventory):
1. gridReady: `test/proof/sunscar-dunes/grid-ready.mjs` on the template's shape, with the cell's `load` creating
   Signal's trusted headless simulation (needs the grid's shardfile sim to take a trusted entry as `HeadlessSimulation`
   does).
2. Declared quest + interaction ports (runtime/quest.ts, runtime/interactions.ts, quest/install.ts).
3. Generic lash item on `ItemRuntime` (contact rule, crack, second lash, pull, stagger) shared by the browser's
   Bullwhip and the headless whip; closes the remaining fidelity gaps (prompt line of sight, second lash / pull /
   stagger).
4. A published SDK species / strike row type with a data-only weight, so runtime/species numbers can move to data/.
5. The decisive move: bake world/, models/, species rigs and the whip model through generators/ (≈ 1,800 lines).

Adoption: Sky Reach's Storm Roc (`far-reach/runtime/roc.ts`) is `installBossRow`'s shape; Driftwood's island keeper and
Sky / Pine keepers can take `installHomeKeeper` (rows, specs, scale ranges, a policy factory, `beforeStep`).
