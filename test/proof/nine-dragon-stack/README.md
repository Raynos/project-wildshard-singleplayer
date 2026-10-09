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

## SF72 witness (part 2): what `compatible: true` covers, and what it does not

`run.mjs` runs the trusted renderer-free entry `runtime/headless.ts` through the platform's own trusted adapter
(`createTrustedHeadlessAdapter`). The result is **compatible but transitional** (`transitional: true` in
`compatibility.json`): it passes for the systems the headless world runs, and the systems still browser-only are listed
as open, not proven.

**Runs headless (proven):**
- the browser-baked native colliders of the grid cell (`runtime/physics.baked.json`, `scripts/bake-nine-physics.mjs`):
  the fragment at +125 m, the four landing decks open to the road (the standalone end caps removed), the square's slab,
  the Well's crossings and safety cap, every placed model's colliders;
- the player capsule walking them from the declared spawn, by tick commands;
- the Jian as its declared row on the shipping swept melee clock (`runtime/jian.ts`, `SweptMeleeCore` over `JIAN_ROW`):
  combo, one-deep queue, combo gap, cooldown and active windows, with exact continuation (the replay restores mid-swing);
- the portal-link entry proof (`provePortalLinks`): 23 capsule lanes per deck and the format's checked transfer to the
  square and back (92 lanes, 8 transfers).

**Still not headless (open):**
- the Fei Zhua (targeting, rope pull, swing, climb): browser only; the headless world has no grapple;
- portal rides during play (ring trigger, hold, checked transfer): browser only; only the entry proof transfers;
- gates / fragments: the Well safety cap never opens (`NdRuntime.guardOpen` is the Fei Zhua's), the crossings stand
  as baked;
- Jian contacts on real targets: Nine has no creature, so each active window fires the row's zero-damage contact at
  nothing; the charged heavy needs a hold the tick protocol does not carry.

**Ledger `not-declared`** is the truth, not a skipped stage: Nine declares no quest, fact or ledger rule
(`shard.config.ts`), so there is nothing to emit. The stage loads the real source in strict Node and reports the empty
declaration; no gameplay emission is claimed. (The platform gate, `scripts/shard-platform.mjs`, still reads Nine as not
compatible, since its ledger flag needs a proven emission, and transitional, since `runtime/` has trusted code.)
