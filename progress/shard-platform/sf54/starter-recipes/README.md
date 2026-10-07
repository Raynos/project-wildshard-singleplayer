# SF54 starter weapon recipes

The game layer defines the original starter moves, melee/bow profiles, equipment metadata, glyphs and Sword/Bow
constructors. Defining SDK runtime modules expose the same bindings. No kit or commons code is reachable from
these new recipe modules; model builders remain supplied by their owning shards.

Before delegating the kit, `starter-weapon-recipes.test.ts` records the independent kit recipe hash **2859552046**
and checks identical serialized bytes for every move, profile, equipment field and glyph; the wind callback has
the same identity. This hash and the earlier family snapshots are fixed oracles, never refreshed after delegation.

`sdk-swept-family.test.ts` compares the new starter constructor, independent kit wrapper and engine family across
14 cases of 600 frames each (**8,400 frames per constructor**), preserving every transform, dynamic geometry buffer,
combo/heavy/contact tick, reaction, hit-stop and debris. `sdk-bow-family.test.ts` compares all three constructors
across 600 frames on each aspect (**1,200 per constructor**), including mounted draw and launch edges, against the
original snapshots and the existing **10,000-tick** draw oracle. No geometry or tuning changes.

Builders land source and manual docs only; the serialized pusher owns generated graph/API output. This is the
starter-recipe step, not completion of the full kit dissolution row. Browser parity and floors are queued with
the coordinator.
