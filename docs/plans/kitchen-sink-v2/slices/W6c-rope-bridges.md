# W6c: the swaying rope bridge as a shared row

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the rope-bridge half of the
old **W18** ("generalise the rope-deck site", H026), the bridge half of **W3** (promote `bridgeSway.as`), and decides
**M6.2/M6.3** (§3: Sky's bridges are not rope bridges).

## 1. The showcase piece

Five swaying rope bridges (all west): movers station 6 (top deck → the tank roof, ~20 m) and the climb yard's
A → B → C → the Rock top (W8a uses them). Each is one row: two anchors, sag, width, plank look; the deck sways and
bounces under you, with the camera sway.

## 2. Engine / game / host work, just in time

Research:

- **Driftwood's bridge is three pieces:** the physics chain (`src/engine/shared/physics/ropeChain.ts`, 230 lines, `RopeChain`,
  driven as the `chain` mover kind inside `game/server/plugin/mover.ts`), the rope-deck site (`src/format/ropeDeckSite.ts` 148,
  `src/game/client/models/ropeDeckSite.ts` 114: spans `{a, b, sag, width}` and a baked rest plan per span; HOST-AUDIT H026,
  one user), and the camera sway (`behaviour/bridgeSway.as`, a SCRIPT-ABI v2 view module, `views/bridge-sway.json`
  rows). Generators: `src/shards/driftwood-isle/generators/ropeBridge.ts`, `ropeDeckSite.ts`.
- `src/commons/scripts/bridge.as` is a different thing: a winched deck that raises after two locks
  (Driftwood's `generators/moverBake.ts` is its only user).

Work:

| Row / host | Shape | Layer |
|---|---|---|
| `world/bridges` (or the rope-deck site section made generic) | `[{ id, a: xyz, b: xyz, sag, width, planks: { look, gap }, sway: 'camera'|'none' }]`; the rest plan is baked by the SDK, not by a Driftwood generator | format + sdk bake + game host (`game/client/models/ropeDeckSite.ts` loses its Driftwood names) |
| sway | `bridgeSway.as` moves to `src/commons/scripts/` with its rows as params | commons AS |
| chain driver | the `chain` mover kind stays in the mover host (W6a moved it out of the plugin) | game |

Host bar: the rope deck becomes 6/6 with two users (Driftwood, the showcase). Guards: `shard-names` (the site loses
Driftwood ids), physics ownership. Tests: `test/driftwood-bridge-facts.test.ts`, `test/driftwood-bridge-inputs.test.ts`,
`test/driftwood-bridge-sway.test.ts`; new `rope-bridge-rows.test.ts` (any span bakes; sag and width bounds).

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Driftwood | the jungle rope bridge (chain + site + sway) | onto the shared row and commons sway | the bridge tests above; cross it in game with the camera sway (before/after capture, Opus) | low (chain pose is transient) |
| Sky Reach | "bridges" are **winch lifts and interact platforms** in `world/movers` (`out/far-reach/sections/world/movers.json`), not rope | none: the old M6.2 ("SR bridges → rope deck") is a different feature; dropped | — | — |
| Nalati | the kunes bridge: a static scene piece | none unless Jake wants it to sway (M6.3, Q2) | — | — |

## 4. Done when, hours, blockers

**Done when:** five showcase bridges sway and carry you; Driftwood's bridge behaves and looks the same; no Driftwood
name in the site host.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 10 h (Codex; Opus sway feel) | 8 h | 4 h | **22 h** |

**Blockers:** W6a (the chain kind out of the plugin).

## 5. Risks

- Five chains at once is more rope physics than Driftwood ever ran; each chain sleeps when nobody is on it (check the
  body cap in W12).

## 6. Questions for Jake

1. **Sky Reach's bridges.** The old plan moved them onto the rope deck, but they are winch lifts and platforms, not
   rope. (a) leave them as movers; (b) rebuild them as rope bridges. **Recommended (a):** they work and look right as
   they are.
2. **Nalati's kunes bridge.** (a) stays static; (b) becomes a swaying rope-deck row. **Recommended (a):** a look change
   on a shipped shard needs its own board, not a ride-along.
