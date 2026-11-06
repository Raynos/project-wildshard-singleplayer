# Pine Hollow round 32 · E350 F-X2 · the Antler King's fight on his own body

A retune, not a pick. The fight was tuned on the elk-rig King. His own upright rig (E322 F-M1, 0399ff1e / face152d) is
bigger: 9.4 m tall, 10 m long, the shoulder at 4.8 m, the rack 7.3 m across. After this change every blow lands where
his body visibly is. Timings and damage are unchanged.

## Files

- `strip.jpg`: the real build 106055f8, iPhone 16 Pro portrait, phone tier. His hit volumes are cyan wireframes; where
  a blow hurts is outlined in amber on the ground. Four panels: I the sweep (he dives, the rack scythes low), I the
  rearing strike's slam (the root ring leaves from his hooves), II the hit volumes from his right, III a lane charge
  with its catch band.
- `fight-after.json` / `fight-before.json`: the scripted fight (`scripts/e350-king-fight.mjs`), phases I–III, on this
  build and on HEAD 9118e71.
- `measure-{phone,desktop}.json`: his body measured by `scripts/e350-king-measure.mjs`. It poses `kingRig.ts`'s own
  clips on the hull GLBs and skins them on the CPU.
- `gate-{phone,desktop}.json`: the rig gate (`scripts/king-rig-gate.mjs`) with the new sweep: 12 / 12, pass, worst
  stretch 1.99.

## What changed

**Sweep**
- Before: his rack stayed 6 m up and the sweep's head never came lower than 4.9 m. The blow still hurt anyone within
  10 m and ±80°: a hit from the air.
- Now he dives. The body tips, and the chest, neck and head drive down (`kingRig.ts` clipSweep). The look is held off
  while he dives.
- The rack scythes 0.8–1.7 m off the ground.
- The blow is the two regions his mesh actually touches (`--sweepmap`):
  - within 4 m and ±75° (his forelegs, chest and face come down on you);
  - out to 7.1 m, from 45° to his right to 15° to his left (the rack).
- The ring shows the scythe's reach. He stops walking in at 6.4 m (0.9 of the reach, as the old 9 of 10 m).

**Stomp**
- The forehooves land 4.35–4.37 m out. The root ring now starts there (it started at 3.5 m, under his belly).

**Lane charge**
- Galloping past, his mesh touches a standing player up to 3.0 m off his line (`--lanemap`).
- The lane is 5.2 m wide and catches within 3.0 m; it caught within 2.5 m before.
- The contact reach is 5.2 m, his front plus the player.

**Hit volumes**
- Before: one elk-sized capsule round his middle.
- Now:
  - a barrel capsule on the body bone, tilted 22° and set back;
  - a second capsule across the chest bone for the shoulders, chest and hump (new: `AnimalDims.fore`);
  - the head ball moved onto the face.
- They were fitted by rays from a standing eye over his silhouette in idle, rear, slam, gallop and sweep. Rays that
  hit his torso or face and landed on a hit volume: 61 % → 77 %. Rays through his body: 22 → 14 %. Hits from the
  air: 17 → 9 %. The ribcage now registers for 78–81 % of the bolts that visibly hit it (71 % before).

## The scripted fight (phone tier, phases I–III, before → after)

| | Before (9118e71) | After |
|---|---|---|
| Sweep: hurt ⇔ his mesh within 0.15 m of you | 4 / 28 agree (hurt at 10 m with a 5.4 m gap) | 28 / 28 |
| Stomp: ring start vs forehooves (4.35 m) | 3.5 m | 4.4 m |
| Lane 2.5 m off (his leg passes through you) | not hurt | hurt |
| Lane 3.0 / 3.5 / 4.0 m off, phase III | not hurt / not hurt / not hurt | hurt / not hurt / not hurt |
| Bolt rays from 15 m, front: landed / through / air | 92 / 76 / 11 | 131 / 35 / 17 |
| Bolt rays from 13 m, his side: air | 42 | 15 |
| Real bolts at the ribcage (front, 30°) | 9 / 9 rib hits | 9 / 9 rib hits |
| Real bolts at the face (front, −30°) | 9 / 9 headshots | 9 / 9 headshots |

Still open, measured and not hidden:
- **Lane, phase III, 3.5 m off:** his mesh grazed the player (−0.2 m) without a hurt. The same spot passed 0.25–0.53 m
  clear in phases I–II. The gallop's phase decides it.
- **Ribcage from the side:** from 40° it registers 15–16 of 22 visible hits; from 90° it registers 0 of 5. Side on, his
  shoulder mass is in front of the basket.
- **Under his belly:** a player right under him (3 m in front) is not caught by the stomp's ring. The ring starts at his
  hooves.
