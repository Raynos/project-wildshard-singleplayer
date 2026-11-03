# E12f: the Crate Titan model (15 m, rigid crates, the assemble clip)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the model part of **EB8**
(~12k tris LOD0, ~7k phone; each crate a rigid part; an **assemble** clip for the intro) and **EB1**'s Titan sheet.
Ruling 19ab: "a cover-worthy Crate Titan" (Jake: *"push it a bit harder. Especially the crate titan"*). Opus (G848).
Redoes mockups E13 / E14 / S06 on round 5 (STATE.md).

## 1. The showcase piece

**The Crate Titan, 15 m** (round 5 `titanScales`: 8× you; its head leaves the portrait frame inside 13 m): crates and
cargo containers stacked round a glowing core; shoulder crates that come off as four Mite adds (P2); a chest core plate
(the crown to break); glowing knees after a slam. Clips: assemble (a still 6 m crate pile stacks upward), idle, slam,
sweep, rain throw, leap, ground-pound, block roll, stagger, phase shed, death crumble.

## 2. Engine / game / host work, just in time

None new: E1a's robot library. Research: rigid skinning with one bone per crate is ~40 bones; three's skinned mesh
limit on the phone is bounded by uniforms (bone textures are used when supported). The model may be two skinned meshes
(body, shoulder crates) to stay under the phone limit (E1a's risk).

## 3. Other shards in this slice

None.

## 4. Done when, hours, blockers

**Done when:** a reference sheet, detail list, a labelled versus board (round-5 mockup · model) and a portrait spin
clip go to Jake; every clip plays in the Model Explorer; LOD0 ≤ 12k tris, phone ≤ 7k; the budget check passes.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 0 | 0 | 24 h (Opus) | **24 h** |

**Blockers:** E1a. Independent of the boss path: it can run in phase 2.

## 5. Risks

- A cover-worthy look at 7k phone tris: the silhouette carries it; details are baked AO and emissive seams, not
  geometry.

## 6. Questions for Jake

1. **The Titan's look.** (a) crates and cargo containers round a cyan core, orange and grey like the robots (the
   remaster's direction); (b) a darker, rusted "foreman's monster" variant. **Recommended (a)**, with the core and seams
   pushed brighter: it matches 19ab's palette, and a versus board of both goes to you before the clips are cut.
