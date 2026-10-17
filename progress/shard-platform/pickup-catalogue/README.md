# Prepared pickup catalogue (G465–G469)

The complete live `src/game/models/pickups.ts` module is removed. Its
geometry recipes are retained only in `src/game/generators/pickups.ts` for
the offline producer. The page installs JSON through the existing specimen
catalogue host. Pine's shelf baker reads those prepared token bytes too;
it no longer imports the geometry recipes.

## Reachable seeds

The producer runs the real `Interactables.parts`, geometry cache and seed
counter on each complete table. Hidden/taken rows are still constructed;
repeated keys reuse their first geometry without consuming another seed.
Both frozen tables produce the same pickup order and seeds as their
current counterparts.

| Caller | First part keys and seeds (decimal) |
| --- | --- |
| Driftwood, current and frozen | glyph `6787`; sea glass `6804` |
| Pine, current and frozen | sea glass `6786`; flint `6787`; resin `6789`; token `6790`; token rim `6791` |
| All six Explorer specimens | every part at `6782` (`0x1a7e`) |
| Loot `CoinBurst` | coin `3073` (`0xc01`) |
| Pine's prepared and frozen token shelves | token `1000` through `1007` |

These are **23 distinct key/seed variants**. The glyphs in Driftwood's
altar reuse the earlier glyph key. No current runtime caller requires a
seed outside this set. Unknown seeds refuse instead of falling back to a
live generator.

## Parity and memory

All position, colour and normal arrays, array types, bounds, index state
and draw groups are byte-identical to the retained recipes for every
variant. The six specimens retain their heights, ordered lit/glow parts,
material families and shadow flags. The declared bob/pulse rows are exact.
The engine's spawn order, geometry cache and animation laws are unchanged.

The 23 variants contain **370,224 decoded geometry bytes**, compressed to
**78,685 bytes** and stored in **104,948 base64 characters**. The complete
JSON is **119,686 bytes**. Registration retains encoded strings and small
row objects, with **zero decoded template bytes**. One owner gets fresh
arrays; mutating one copy cannot change the next. Geometry bytes uploaded
to the existing interaction batches and loot meshes are unchanged:
**GPU resident delta = 0 bytes**. The added encoded payload is about
**0.10–0.20 MiB** of JS string storage depending on the browser's string
representation, plus metadata; this is an accounting estimate, not a
physical-device RSS reading. Inflated buffers are transient, not a cache.

The source-basis ruler, run in the build mirror, measures Pine custom
lines **10,684 → 10,584 (−100)**; the other nine shards are unchanged on the
same source basis. This includes released sole-user dependencies as well
as the removed module. The frozen shelf change only replaces its removed
import with the installed prepared look; all eight shelf seeds remain.

## Validation

- Root and layer TypeScript projects pass in the immutable build mirror.
- Touched typed lint and 15 pickup/specimen tests pass there.
- `node scripts/generate.mjs --job=shared-pickups --compare` passes a fresh
  isolated generation, matching the complete committed JSON exactly.
- All ten official shardfile products build successfully; all **17
  shard-headless cases** and the 15 focused cases pass (32 tests total).
- The official Pine map refresh passes. Its pixel hash remains
  `f85abc80bcf2febe1e7dc15fb27b47d49d14f5b355a042a6884358743a71606e`;
  the raster is byte-identical and only the source-input stamp changes.
- The actual pre-commit and commit-message hooks pass with the private
  index. No browser or preview is left running by this lane.
