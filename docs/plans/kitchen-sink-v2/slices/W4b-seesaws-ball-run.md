# W4b: see-saws, the rolling-ball run and the skittles

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the see-saw part of the old
**W14** ("a hinged-body row"; see-saw was M).

## 1. The showcase piece

Zone 03, second half:

| Item | Rows |
|---|---|
| 2 see-saws | a plank body on a hinge: stand on one end, drop a crate on the other to launch it (or you) |
| Rolling-ball run | a 24 m ramp, 4 balls (W4a bodies), a release lever |
| 10 skittles | cylinder bodies in a triangle; a counter board ("8 down") and a best (W3a records: "Skittles", higher is better) |

## 2. Engine / game / host work, just in time

Research: Rapier joints are used only by the ragdoll (`src/engine/client/physics/ragdoll.ts:106` `joint: spherical |
revolute`, `ImpulseJoint` import line 28). Declared bodies (`sim/bodies`, W4a) have no joint row. No "knocked over"
reading exists; scripts can read body poses (`test/decision-body-ops.test.ts`).

| Row / mechanic | Shape | Layer |
|---|---|---|
| hinge | `sim/bodies` `joints: [{ id, kind: 'hinge', body, anchor, axis, limits: [lo, hi], motor?: { speed, force } }]` | engine physics (a revolute impulse joint to a fixed anchor), format row |
| tilt reading | `bodyTilt(body)` in the script queries (degrees from up) | engine script queries (`engine/script/queries`), ABI v1 command table |
| skittles rule | commons `skittles.as`: count bodies tilted > 60°, reset lever, record the run | commons AS |
| ball release | a lever interactable (W4a) whose flag a script reads to wake the balls | data + AS |

Do not run WASM-HOST H13 (ABI v2) for this: the tilt query is one more v1 query id. Host bar: the hinge row has one
user (the showcase); a revolute joint is engine physics in general (no game nouns), so it is an engine feature with a
G595 approval row. Guards: `engine-words`, physics ownership (only `src/engine/physics/` imports Rapier). Tests: new
`declared-hinge.test.ts` (limits hold, snapshot/restore keeps the angle, phone cap counts the plank),
`script-tilt-query.test.ts`; `test/declared-body-ops.test.ts`.

## 3. Other shards in this slice

None use joints or the new query. Proof that nothing moved: `test/declared-body-ops.test.ts`,
`node scripts/physics-baseline.mjs --no-build --mode=walk` (0 stuck) on Driftwood (its barrel is the other declared
body user).

## 4. Done when, hours, blockers

**Done when:** both see-saws tip under a crate and launch a crate dropped on the high end; the ball run's lever drops
four balls into the skittles; the board counts what fell and keeps a best; physics walk 0 stuck.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 12 h (Codex; Opus for the feel) | 1 h | 8 h | **21 h** |

**Blockers:** W4a (bodies, plates, levers in the section).

## 5. Risks

- A see-saw that launches the player is a physics edge (the capsule on a moving plank): if the motor jitters, the
  plank launches crates only and the player rides it as a ramp (Q1).

## 6. Questions for Jake

1. **Can the see-saw launch you?** (a) yes: stand on the low end, drop a crate stack on the high end; (b) crates only.
   **Recommended (a)** if the capsule rides the plank cleanly in a test, else (b) and say so.
2. **Skittles score.** (a) pins down per run, best kept (a records row); (b) just for fun, no record. **Recommended (a):**
   one more personal best and a feat ("Strike!") for W9b, at no extra cost.
