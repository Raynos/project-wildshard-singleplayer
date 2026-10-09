# Handoff (sf72-nine) — 2026-10-09, SF72 Nine Dragon Stack headless, part 1

Coordinator `wildshard-new` pushes. Nine's canonical witness (`test/proof/nine-dragon-stack/`) still fails closed: the
headless and replay stages import `runtime/index.ts` (the whole browser plugin). There is no `runtime/headless.ts` yet.

## Landed

- **84c4aedb2, engine: the swept melee clock** (`src/engine/combat/sweptMeleeCore.ts`, `@wildshard/engine/combat/sweptMeleeCore`).
  `SweptMeleeCore<M>` owns the combo (gap, one-deep chain after `chainLag`), the held heavy's charge and release, the
  active window, the cooldown and `snapshot()` / `restore()`; `sweptMoveDamage` is a move's damage. `SweptMelee` (every
  sword, sabre and jian) drives one and keeps only presentation. Proof: the pre-delegation view snapshot
  (`test/combat/sdk-swept-family.test.ts`) is unchanged; `test/combat/swept-melee-core.test.ts` runs the old inline clock
  as an oracle on recorded 6000-tick tapes (both starter profiles, exact mid-tape restore); browser runs swinging
  Driftwood's sword, Nalati's sabre and Nine's jian give the same move sequence as HEAD.
- **This commit, shard: the declared floors load renderer-free** (`world/floorRows.ts`): the deck frames, deck / balustrade collision,
  the square's slab and `portalFloorRows` moved out of `world/entries.ts` (which keeps only the drawing) and
  `world/colliders.ts` (which imports `span`, `SLAB`, `squareFloor`). `shard.config.ts` now loads in plain Node: the
  ledger stage reports `not-declared` (0 rules, no emission claimed) instead of `blocked` on `render/tiers.ts`. Map-hash inputs changed, so Nine's map is rebaked
  officially from the clean candidate (stamp `8378f51e…`; the image differs from the last bake only by WebP noise).

## Inventory: what Nine's witness needs (no quest, ledger rule, fauna or encounter exists; none is invented)

Gameplay owners in the fragment, all still browser classes:
1. **The Jian** (`world/jian.ts`, `vm/`): the native `Sword` (`game/weapons/Sword.ts` → `SweptMelee`). Its declared row
   (`data/items.ts weapon.jian`) has zero-damage placeholder contacts; there is nothing to hit (no creature). Headless
   needs: the clock (landed) as a real item over the row (Signal's `runtime/whip.ts` on `ItemRuntime` is the shape),
   with the combo / heavy timing from the shipping move set + profile; contacts stay the row's.
2. **Fei Zhua** (`grapple/FeiZhua.ts`, `line.ts`, `course.ts`): targeting (`castRay` / `lineOfSight`), rope pull,
   swing and climb in `fixed.post` and `player.traversal`. Blocked in Node by `app`, `ui/hudSlots`, the FX, `ndRuntime()`
   and `world/well-plan.ts → well-galleries.ts → look/paint.ts`. Split: a renderer-free rope / anchor sim taking the
   physics queries and the player body as ports, the browser `Tool` keeping input, HUD relabel, filament and FX.
3. **Portal rides** (`world/portalRide.ts`, `portalPlan.ts`): `portalPlan.ts` is already renderer-free;
   `portalRide.ts` imports `ui/ownership` (the veil) and `shard.config.ts`. Split the ride (the checked transfer
   over `portalFloorRows`) from the veil.
4. **Gates / fragments**: the Well safety cap (`nds-grapple-guard`, open while `NdRuntime.guardOpen`), the decks' standalone
   caps (`entryCapColliders(caps)`), and `well-mid.ts crossingColliders` (dynamic pieces).

World / colliders at load (`world/install.ts`): `nds-floors` (fragment floors minus the square + standalone caps,
floor function `withDecks`), the five declared floor pieces (`deck.<edge>` ×4, `square`), `nds-fronts`, the grapple
guard, the crossing pieces, and every placed model's own colliders (`engine/models/place.ts`: balustrade, gates' posts,
banyan planter, stalls, market). `fragmentColliders()` still reaches `models/wellBalustrade.ts` (GUARD_Z0, PARAPET) and
`look/paint.ts` via `stairstreet.ts` / `well.ts`; the model colliders need the browser. So the native world comes from a
**bake** (Signal / Pine pattern), not from importing the world modules.

## Next, in order

1. **Native bake** `scripts/bake-nine-physics.mjs` (+ inputs hash): from a trusted DEVSERVER candidate preview
   (Developer on), capture every registered piece's colliders at load (ids, boxes / trimeshes, surfaces, `active`
   state of the guard), the spawn, the four entryways and the portal nodes; two same-page captures must match. Output
   `runtime/physics.baked.json` + parser + freshness test (pattern `scripts/bake-signal-physics.mjs`).
2. **`runtime/headless.ts`** (`PrepareHeadlessRuntime`): `ground:false`, the baked pieces, the entry proof walking in on
   the four decks, the Jian as an item on `SweptMeleeCore` (snapshot in the step's continuation).
3. Fei Zhua sim split (2. above) and the portal ride split, then repoint `test/proof/nine-dragon-stack/run.mjs` to
   `runtime/headless.ts` and replace the fail-closed tests with the real witness (headless → replay → ledger
   `not-declared`).

Plan-State: unchanged.
