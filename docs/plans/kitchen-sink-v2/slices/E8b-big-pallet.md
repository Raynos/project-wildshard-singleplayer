# E8b: Big Pallet, the L6 elite (and the Big Pallet quest)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the Big Pallet part of **EB6**,
**LS3** for Big Pallet, the Big Pallet rows of **LW7 / LW4** (first kill: 60 Scrip, the Hydraulic Heart core, the
trophy *Big Pallet's Tines*, 5 Tines; the contract *Forklift Certified*) and the tier-1 quest **Big Pallet** (L6). Opus
for the model and the fight's feel (G848).

## 1. The showcase piece

**Big Pallet, L6** in the band-2 pit (r 14 m, crate stacks, two pillars), ~3.2 m (E7 mockup), `rule: always`, respawn
5 min, ×7 a Jack's HP. P1: the charge (1.1 s lane); the **crate throw** (a red ring at your feet 1.2 s; it lands as
breakable cover); a charge into a pillar stuns it 3 s with the back hydraulics ×1.5 (E2's wall stun + rear zone). P2
(50 %): two Pallet Jacks once; double charges; a 180° tine sweep (0.8 s). Its theme `elite-pallet` arrives in E15b.

## 2. Engine / game / host work, just in time

None beyond E8a and E2: the crate throw is an `arc` strike with `motion.delay` whose impact spawns a breakable prop
(W4a's crate body, a `leaves` row like E4's hazards). If `leaves: { prop }` doesn't exist after E4, it is added here as a
second `leaves` kind (2 h).

## 3. Other shards in this slice

None.

## 4. Done when, hours, blockers

**Done when:** a level-6 player beats Big Pallet in ~60 s at equal level (§15) and an under-levelled one finds it
brutal; the pillar stun and the thrown cover read on a 30 fps portrait capture; the first kill pays its fixed reward
and the quest completes; the contract row appears.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 2 h | 0 | 18 h (Opus: model 10 h, pit 4 h, fight rows and tuning 4 h) | **20 h** |

**Blockers:** E8a, E2, E1f (the contract row).

## 5. Risks

- Thrown crates as dynamic bodies count against the phone's 40 awake bodies (`engine/physics/bodies.ts:84`); they must
  sleep fast and despawn after the fight.

## 6. Questions for Jake

1. **The thrown crate stays as cover.** (a) yes, it lands as breakable cover you can use (the enemies plan); (b) it
   breaks on landing. **Recommended (a):** it makes the pit change during the fight, and it sets up P2's double
   charges into your own cover.
