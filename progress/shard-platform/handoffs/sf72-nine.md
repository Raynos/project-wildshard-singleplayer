# Handoff (sf72-nine) — 2026-10-09, SF72 Nine Dragon Stack headless, part 2

Coordinator `wildshard-new` pushes. Nine's canonical witness (`test/proof/nine-dragon-stack/`) now **passes** on its
trusted renderer-free entry `runtime/headless.ts`: `compatible: true` but **transitional** (headless + replay passed,
ledger `not-declared` because Nine declares no fact; the Fei Zhua, play-time portal rides and gates are browser-only and
listed under `open`, test/proof/nine-dragon-stack/README.md),
identical in two independent native processes, ~9 s CPU for all three stages (headless / replay ~4.5 s each, inside
DEPLOY.md's headless budget: a third of the 60 s timeout at CI's 2–2.5×).

## Landed

- **84c4aedb2** (part 1): the engine swept melee clock (`@wildshard/engine/combat/sweptMeleeCore`).
- **e015703b3** (part 1): the declared floors renderer-free (`world/floorRows.ts`); `shard.config.ts` loads in Node.
- **This commit** (part 2):
  - **Native bake** `scripts/bake-nine-physics.mjs` + `scripts/nine-physics-inputs.mjs` → `runtime/physics.baked.json`:
    23 collider pieces / 489 colliders (485 boxes, 1 hull, 3 treads) from a clean DEVSERVER build of `1b213b9e2`
    (Developer on, iPhone 16 Pro, phone tier), two same-page captures equal. Inputs: shard.config, layout, terrain,
    places, runtime/state, data/**, world/** (minus jian.ts, portalRide.ts, portalVeil.ts: no collider), models/**,
    public/assets/nine-dragon/**.glb. Freshness + shape test: `test/shards/nine-dragon-stack/physics-bake.test.ts`
    (the five declared portal floors baked equal to `portalFloorRows()`).
  - **`runtime/headless.ts`** (`PrepareHeadlessRuntime`): `ground: false`; the baked pieces (each owner its piece id; the
    engine's practice arena skipped; the standalone deck caps `entryCapColliders(true)` removed by exact match, so the cell
    is the grid's with decks open to the road); the player at the declared spawn on the square's slab (+125 m); the
    entry proof is the format's own `provePortalLinks` (92 lanes, 8 transfers).
  - **`runtime/jian.ts`**: the Jian on `SweptMeleeCore` over `JIAN_ROW`'s shipping moves / profile; a player command's
    attack is a light tap (the protocol has no heavy hold); each active window fires the declared row contact once
    (nothing to strike: no creature); clock + queue + counts are exact continuation (`item.weapon.jian`).
  - **Witness** `test/proof/nine-dragon-stack/{run.mjs,witness.ts}` through `createTrustedHeadlessAdapter`: 300 ticks
    (11 swings) + finish; mid-swing checkpoint at tick 195 restored into a fresh adapter, suffix hash equal; ledger via
    the probe (`not-declared`). `determinism.test.ts` now checks Nine passes identically twice. The in-process
    restore test (`headless-runtime.test.ts`) has one checkpoint, one string round trip, `expectSameSimSnapshot`.

## Next, in order

1. **Portal ride split** (written once, backed out of this landing because `world/` is a map-hash input and needs an
   official map rebake in the same commit): move `installPortals` (the veil, `engine/ui/ownership`) to
   `world/portalVeil.ts`, keep `portalRide` / `playerRider` renderer-free in `portalRide.ts`, repoint `plugin.ts` line 16
   (own hunk only: plugin.ts carries foreign WIP), update `test/proof/compatibility/dependency-chains.json`; rebake the
   map from the clean candidate. The physics bake inputs already exclude both files. Then a headless ride step (ring
   trigger → hold → `createPortalTraversal` with the host's player motor) so a walked tape rides like the browser.
2. **Fei Zhua sim split** (`grapple/FeiZhua.ts`, `line.ts`, `course.ts`): renderer-free rope / anchor sim taking physics
   queries and the player body as ports; the browser `Tool` keeps input, HUD relabel, filament and FX. Then the Well
   safety cap (`nds-grapple-guard`, baked `active: true`) can open in the headless world.

Plan-State: unchanged.
