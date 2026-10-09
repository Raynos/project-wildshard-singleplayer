# Nine Dragon Stack: runtime-owned item rows (SF51-p, E435)

The committed fragment has one Neon Jian and one Fei Zhua. Its quests, ledger rules, fauna, encounters and mutable shard state are empty; this conversion does not create new gameplay or migrations for absent state.

`shard.config.ts` declares both items and binds `items` to the trusted runtime. The runtime adopts the existing prebuilt Sword and constructs the grapple at the original play-stage point, then installs it once. The Jian retains its native `sword` compatibility slot; the grapple retains `tool.fei-zhua`, LOCK/JUMP input and its native offhand policy. The runtime-owned tool has `action: null`, so the data installer creates no second toggle binding.

G51 recipes retained: native Sword contacts/viewmodel; Fei Zhua targeting, rope, pull and traversal; checked deck portals; fragment geometry, decorative crowd and light/renderer/FX controllers. No decorative object is represented as an Animal spawn.

Validation: row/UI/cue/metadata equality, native input ownership, direct-installer refusal and C26 byte-preserving reload fixtures; existing plugin, Jian and Fei Zhua contracts. Clean strict, typed lint and ratchet pass. The full clean-export suite passed 955 files / 5,439 tests, with 14 skipped (255.27 s, bounded four-worker run through heavy-lane ticket 463); all 17 focused fragment contracts passed. The real standalone/grid browser proof follows below.

The isolated candidate excludes the uncommitted SDK migration in plugin.ts/world/jian.ts/vm files. Its map is rebaked from the clean candidate, never the shared working tree.

Browser pin: `402b87c9f7ee13cd178349be9132ecc91019f986`, official DEVSERVER build, one wrapped muted Chromium browser with iPhone 16 Pro, phone tier and Developer ON. Standalone entered play with native `sword` / declared `weapon.jian` and `tool.fei-zhua`, native LOCK/JUMP, no page errors or error reports.

Grid proof at this SF51-p pin is explicitly **not green**. Two real held-input attempts stopped at world z≈−298.35 (Nine north cell edge is −305), behind the waiting screen / soft wall, with no error reports. A direct home-to-Nine pose was correctly refused by the neutral-road ownership fence. The corrected road-first pose reached `(555, 0.5, −315)` and exposed the existing refusal: `nine-dragon-stack is not a shardfile shard (it stays a far proxy until M3)`. No Nine runtime or item installer ran. The coordinator accepted this as an SF51-g admission / midpoint-entry gap; the item conversion does not bypass it. Every failed attempt is preserved beside the successful standalone phase.

The later [SF51-g admission proof](grid-admission.md) closes that descriptor/runtime gate and crosses the north readiness wall by real held movement. It preserves these original failures and states the limits of the new claim.

Map: rebuilt after the Nine map-style commit `f9a2e7493`, using the official `scripts/bake-maps.mjs` command from the clean candidate. The stamp is `c9c32e3ef2792cfc2afee6d6bd73a15c25b56d33042115a03bf28c4ff9060d5c`, stylized ground, 1,000 px / 13,488 bytes. The browser proof pin predates this map-only rebake; the native world / layout inputs are unchanged.

## SF72 witness (parts 2–5): what `compatible: true` covers, and what it does not

`run.mjs` runs the trusted renderer-free entry `runtime/headless.ts` through the platform's own trusted adapter
(`createTrustedHeadlessAdapter`). The result is **compatible** (`transitional: false` in `compatibility.json`): no
renderer-bound system decides a gameplay outcome. Decorative crowd, light and view controllers remain trusted
runtime presentation.

**Runs headless (proven):**
- the browser-baked native colliders of the grid cell (`runtime/physics.baked.json`, `scripts/bake-nine-physics.mjs`):
  the fragment at +125 m, the four landing decks open to the road (the standalone end caps removed), the square's slab,
  the Well's crossings and safety cap, every placed model's colliders;
- the player capsule walking them from the declared spawn, by tick commands;
- the Jian as its declared row on the shipping swept melee clock (`runtime/jian.ts`, `SweptMeleeCore` over `JIAN_ROW`):
  combo, one-deep queue, combo gap, cooldown and active windows, with exact continuation (the ride replay restores mid-swing);
- the portal-link entry proof (`provePortalLinks`): 23 capsule lanes per deck and the format's checked transfer to the
  square and back (92 lanes, 8 transfers);
- play-time portal rides (part 3) on the page's own ride, `world/portalRide.ts` (renderer-free since the fade veil moved
  to `world/portalVeil.ts`), driven by `runtime/portals.ts` after the player's move: the tape walks the square's declared
  route from the spawn into the ring out (→ the north deck, `portal.square.north>portal.north`), steps 2.5 m out of the
  deck's ring and back in (→ the square, `portal.north>portal.square.arrival`). The hold is the page Player's `carried`
  (feet kept at the ring's touch through the fade), the transfer is `createPortalTraversal` on the host's own physics,
  motor and feet; the ride's state and hold are continuation, and the committed ride checkpoint (tick 400) falls mid-swing AND
  held in the square's ring before the transfer. Its 60-tick suffix finishes the north transfer. The same build's browser rides all four decks (north arrival
  (0, 0.01, 236), the headless one (0, 0, 236));
- the Jian's charged heavy (part 5) on the tick protocol's HEAVY hold: back at the arrival the tape holds HEAVY for 40
  ticks and lets go, one heavy swing on the same clock (22 swings in all);
- the Fei Zhua (parts 4–5) on the page's own law: `grapple/sim.ts` is renderer-free (targeting by the view's projection,
  reach, sight past the Well's rail, the landing test, fire → bite → lift → zip → vault → settle, or a miss reeled back,
  with snapshot / restore); the page's `grapple/FeiZhua.ts` drives it and draws the rope, markers and FX, and the host's
  `runtime/grapple.ts` drives it from tick commands (a LOCK script press, the aim's pitch as a script value, the player
  command's JUMP), on the 31 dragon hooks the physics bake records (`hooks`, `scripts/bake-nine-physics.mjs`). The aim is
  the player's eye at the command's heading and pitch projected as the phone's portrait camera, so the hook nearest the
  screen's centre is the one the claw takes, as on the page. `headless-runtime.test.ts` also zips onto the east tower's
  ledge from the arrival and restores mid-zip byte-exactly;
- the Well crossing (part 5, gates / fragments): after the heavy the tape walks 6 m south along the square's west
  balustrade (x 0.2, 1.1 m high), jumps it onto the Well's south rim (z 11.2…16) and fires north across the Well at the
  crossing's hook (−8.2, 121.37, −18.49), seen past the rim's rail and the safety cap. The zip lifts over the rim's
  parapet with the cap's baked colliders (`nds-grapple-guard`) switched off exactly while the lifting crossing flies
  (the page's `NdRuntime.guardOpen`; 151 ticks), lands on the crossing's deck at (−8.53, 119.09, −20.67) and the cap
  closes behind it. `headless-runtime.test.ts` restores mid-crossing with the cap open (still open on the fresh host,
  closed on both after the settle). The see-past rule reads the host's collider owners, which are piece ids (strings,
  snapshot-safe) where the page's are the piece objects; before part 5 the host could never see a hook past the rail.

**Not applicable:** Jian contacts on real targets. Nine has no creatures, so each active window fires the declared
zero-damage contact at nothing. The combo, heavy and contact clock are still exercised. This is not an open gameplay
item and does not make the witness transitional.

**Ledger `not-declared`** is the truth, not a skipped stage: Nine declares no quest, fact or ledger rule
(`shard.config.ts`), so there is nothing to emit. The stage loads the real source in strict Node and reports the empty
declaration; no gameplay emission is claimed. `scripts/shard-platform.mjs` computes its own structural transitional
status while trusted runtime code remains; this witness does not change that classification.

## Short replay checkpoints (Nine6)

The uninterrupted headless stage still walks all 1,084 ticks, exercises both portal rides and the charged heavy, crosses
the Well, and proves 92 entry lanes / 8 transfers. Replay no longer repeats that whole tape:

| Checkpoint | State | Suffix | Ticks stepped in both continuations |
| --- | --- | ---: | ---: |
| `ride` (400) | Jian swing 1, held in the square ring before transfer | 60 | 120 |
| `crossing` (940) | Lifting zip across the Well, safety cap open | 144 | 288 |

Each test owns one committed checkpoint, checks exact canonical restoration, then runs two fresh adapters' short
suffixes and compares canonical state hashes in the same process. No native transcendental-dependent terminal digest
is used as a cross-platform oracle. The aggregate replay steps **408 ticks**, down from 1,768 (77% fewer); headless
coverage is unchanged. Separate tests keep the portal / sword and Well continuation assertions, each with a 60 s budget.

`checkpoints/manifest.json` records the SHA256 of every loaded repository module (including the command tape, trusted
entry, engine simulation / snapshot / player / physics closure and imported physics bake) plus Rapier WASM. The native
CLI admits the same closure in each mode; `fresh` and every replay refuse stale inputs before restoring. The checkpoint
wire is strictly parsed and the engine validates the packed snapshot. Regenerate explicitly from a clean candidate:

```sh
node --import ./scripts/sim-node-loader.mjs test/proof/nine-dragon-stack/run.mjs checkpoints
node --import ./scripts/sim-node-loader.mjs test/proof/nine-dragon-stack/run.mjs fresh
node --import ./scripts/sim-node-loader.mjs test/proof/nine-dragon-stack/run.mjs all
```

`compatibility.json` is re-recorded from the real `all` run, with canonical hashes. Engine or Nine closure changes need
a checkpoint regeneration just as Sky's committed checkpoints do. No production source, collider or map input changes
in this slice.

The isolated local coverage check (`vitest run .../headless.test.ts .../replay.test.ts --coverage --maxWorkers=1`,
heavy-lane ticket 989, queue excluded) took 8.002 s for the whole headless route, 1.206 s for the ride replay and
2.349 s for the crossing replay. Each is below one third of its 60 s timeout. A separate independent-process
determinism check passed both slices under coverage (8.108 / 14.019 s while the shared machine was busy).

## Why the hook debug capture remains

`grapple/course.ts` contains interfaces, not hook placement data. The 31 ring centres are emitted by `square.ts`,
`towers.ts`, `stairstreet.ts`, `stairstreet-upper.ts`, `well-rim.ts`, `well-mid.ts` and `well-bridges.ts`. Their render
builders combine wall profiles, geometry placement and seeded detail generation; the timber pavilion's hook depends
on its RNG-selected / clearance-adjusted pavilion centre and LOD. `props.ts::dragonHook` records the final ring centre
while drawing its geometry; the stair-foot dragon records a separate transformed jaw ring.

A faithful Node derivation requires extracting those authored placement recipes and their shared random choices into
pure data used by both the render builders and the bake. Copying the 31 baked coordinates would only duplicate the
bake, and importing the builders would load the renderer. This follow-up therefore retains `nd.grapple`, the real
browser bake, and Nine's `context.debug` cap of 2. The placement extraction remains explicitly open; it changes world
map inputs and needs a browser-equivalence proof and map rebake.
