# Handoff (sf72-nalati3) — 2026-10-09, SF72 Nalati Grasslands headless, part 3

Coordinator `wildshard-new` pushes. Supersedes the "Not yet" list of `sf72-nalati2.md`. Nalati's canonical witness
(`test/proof/nalati-grasslands/`) is UNCHANGED and still fails closed (`compatibility.json` not flipped).

## Landed (this slice)

- **Tick-0 poses in the bake.** `scripts/bake-nalati-physics.mjs` reads every body's spot and heading the frame it first
  exists (an init-script frame hook, before any frame callback runs after its spawn) into `physics.baked.json` `spawns`
  (`runtime/baked.ts` `NalatiBakedSpawn`, strictly parsed, one per actor in list order). Rebaked on `84c4aedb2`; the
  actors, herds, floor, solids, trees and pieces are byte-identical, so no input hash moved.
- **The roster's positions match the page**: `nalatiBootRoster` reproduces all 35 spots exactly and 34 headings bit for
  bit. The 35th, the shepherd's horse (creature:23), is off by 0.00044 rad: `ride.ts` builds him before the page exposes its
  manager, and his ring (`creatures/sheepRaid.ts`) turns him in that frame. His spot is exact; the test holds his heading
  within one frame's turn. (Wrapping `manager.spawn` from the init script didn't catch him earlier either.)
- **`runtime/headless.ts`** (the `prepareHeadlessRuntime` entry, which loads in plain Node under `scripts/sim-node-loader.mjs`):
  the browser-baked native world (Rapier's heightfield and the 2694 solid WORLD colliders; `ground: false`), the page's
  terrain grid (`public/assets/baked/nalati-grasslands/terrain.bin`, passed by path) as the height query, and
  `installNalatiRoster`: `host.useBodyBands()` before any spawn, then the 35 load-time bodies at their roster spots and
  headings on the manager's creature floor, with the baked spec, herd slot and `scripted` flag, every id, coat, seed and
  scale checked against the bake. The King stays parked. The boot clock is fixed at day with no storm (`NALATI_HEADLESS_CLOCK`).
  Test `test/shards/nalati-grasslands/headless-runtime.test.ts`: the floor y matches the page's within 1 mm on every body,
  a 3k-tick walk stays finite and on the ground, a mid-walk restore continues exactly (one restore point, short tapes: every
  test is under 3 s), and the entry loads in plain Node.

## Not yet (next, in order)

1. **The groups' decisions.** The bodies stand: nothing thinks yet. Make `runtime/groupPorts.ts` `nativePackPorts` /
   `nativeHerdPorts` generic over `A extends AnimalSim` (a type-only change, but `groupPorts.ts` is a bake input, so it
   needs a candidate build and a rebake). Then, in headless, build `PackBrain<AnimalSim>` (pack 0–4, `initialize()` right
   after its placement, on the host's 'ai' stream, as Wildlife does) and `HerdBrain` for the wild herd and Argymaq's herd
   from `NALATI_PACK_BRAIN` / `NALATI_HERD_BRAIN`. Drive them as `thinkWolf` / `thinkHorse` / `actWolf` / `actHorse` do,
   on `host.brainDt` / `host.bodyDt`, with a `PackContext` whose steer, pathYaw and confine come from a `HuntBrain` (Nalati
   steers by its navmesh, `public/assets/baked/nalati-grasslands/navmesh.bin`). Also `bindFallbackGroupHost` and
   `wildEnv` (its grass, wind and light hooks are the page's: grass height is the grass system's, not the 0.55 default).
2. Owned horses (camp 21–22, the shepherd's 23) skip the herd AI: the shepherd's ring and the raid director
   (`creatures/raidDirector.ts`, `raidClock.ts`) need the flock, and the flock is renderer-bound (`creatures/flock.ts`).
3. The elites (Aqbars, Argymaq; `combat/elites.ts` is renderer-bound), the Golden King and the Storm Titan on
   `installBossRow`, the sabre on `@wildshard/engine/combat/sweptMeleeCore` (84c4aedb2), the bow / spear as declared items.
4. Kokbori, Qyran and Qara Batyr (the dusk / night / storm spawns) and the day clock, before any witness crosses those clocks.
5. Witness: headless 10k → replay → ledger (wolf feats) → entry proof. Flip `compatibility.json` only from a real run.

Plan-State: unchanged.
