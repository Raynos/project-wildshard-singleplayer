# W10b: the riding course (the oval, eight rings, four jumps, the lap timer)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the old **W8** (riding course:
"docs and a template example"), done on W6d's world course host.

## 1. The showcase piece

Zone 04, riding course 208 × 88 (`layout.js` `RIDING`): Nalati's oval (479 m lap, ~37 s at gallop), **8 rings** to ride
through, **4 jumps**, the **start/finish gantry** with the lap timer, a PB board ("Riding lap", lower is better).

## 2. Engine / game / host work, just in time

Research: Nalati's riding practice layout is an oval only: `src/format/practiceCourseRows.ts:66` `RidingPracticeSchema
{ road, fieldAt, horseStart, riderStart, oval {halfLen, radius, width}, lineX, … words }`, no rings or jumps. The
shared law (`src/commons/scripts/course.as`) has an `oval` kind (laps, half-lap) and a `checkpoints` kind (≤ 11 pads).
Horse jumping exists (`src/game/riding/physics.ts:128` `jump`).

Work: a `world/courses` row (W6d) with `law: 'checkpoints'`, the 8 rings as pads at height (start + 8 rings = 9 of 11),
`mount: 'horse'`, `record: 'riding-lap'`. A missed ring adds a time penalty or voids the lap (Q1; a `miss: { penalty: s } | 'void'` field on the course row). The jumps are geometry. No new host.
Docs: the SHARDS.md riding-course section and a template example row (the old W8's docs half).

## 3. Other shards in this slice

Nalati's Explore riding room keeps the `oval` law (W6d moved it onto the shared controller); no change here. Proof:
`test/nalati-course-binary.test.ts`.

## 4. Done when, hours, blockers

**Done when:** on the loaner horse you ride a lap through all 8 rings and over the 4 jumps, the gantry times it, the
board keeps the best.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 2 h (docs, template row) | 1 h | 12 h (Opus: rings, jumps, gantry) | **15 h** |

**Blockers:** W10a (the horse), W6d (the course host).

## 5. Risks

- Rings at gallop speed (13 m/s): pad boxes must be generous (≥ 4 m) or laps fail on the phone's 30 fps.

## 6. Questions for Jake

1. **A missed ring.** (a) the lap doesn't count (the board says "missed ring 5"); (b) +5 s per missed ring. **Recommended
   (b):** a penalty keeps the run alive, and a gallop through a 4 m ring is hard on a phone.
