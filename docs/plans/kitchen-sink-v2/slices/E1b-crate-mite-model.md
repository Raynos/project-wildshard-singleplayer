# E1b: the Crate Mite (the first robot model)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the Mite part of **EB1**
(reference sheet, detail list) and **EB3** (model, clips, LODs, versus board, spin clip). Opus only (G848).

## 1. The showcase piece

**Crate Mite, L1–3** (enemies plan §2–3): a 0.6 m crate on four stubby legs with one cyan eye; 500 / 400 / 150 tris
(LOD0 / phone / LOD1). Clips: idle (a shuffle), move (a skitter), **telegraph** (crouch + eye flash, 0.6 s, 18 frames
at 30 fps), hop-bite lunge (3 m), hit, death (it breaks into blocks and drops its Servo, E1e), and a **sleep** pose (a
plain closed crate) for the packs that wake within 6 m. Palette slots for the night shift (amber eyes, hi-vis) and the
rarity trims (E7a/E7b) are in the GLB from day one.

## 2. Engine / game / host work, just in time

None: E1a's library builds it. Research for the look: the Mite mockups (`art/showcase-template/round-11-remaster/`,
the band-1 frames) and the enemies plan's silhouette table. The species row (`actors/species`: dims, `lockable`,
`aggressive`, the variant `hp`) follows the template's `grey-blob` (`out/_template/sections/actors/species.json`).

## 3. Other shards in this slice

None.

## 4. Done when, hours, blockers

**Done when:** a reference sheet + detail list in `art/showcase-template/robots/round-1-mite/`, a labelled versus board
(mockup · model) and a portrait spin clip go to Jake; the Mite stands in the pen and plays every clip; the GLB passes
the budget.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 0 | 0 | 16 h (Opus) | **16 h** |

**Blockers:** E1a.

## 5. Risks

- At 0.6 m the eye flash is the whole telegraph on a phone; it needs an emissive bloom-free read (checked on a 30 fps
  capture in portrait at 10 m).

## 6. Questions for Jake

1. **Sleeping Mites.** (a) some packs sleep as plain closed crates and wake when you come within 6 m (the enemies
   plan); (b) every Mite is awake. **Recommended (a):** it is the band's one surprise, costs one pose, and teaches
   "crates can be robots" before Sir Nibbles (E8c) uses it.
