# Sky Reach top-10 row 6: the windmill set, modelled (E410)

Plan row 6 (project/archive/2026-10-03-sky-reach-top10.md): "Model the windmill on its stone outcrop with its waterfall
and stone base ... from mockups A and C. The bridge stays as built." Codex round 13 finding 5: "weather the tower".

- `refs/gen.py`: codex image_gen references on white. `ref-tower.jpg` / `ref-tower-b.jpg`: mockup A's tower mill body
  and cap with its windshaft stub, no sails (two takes). `ref-foot.jpg`: the rock the mill stands on (mockup C).
- Pipeline: BiRefNet cutout, Hunyuan3D-2 turbo shape + 2048 paint (40k faces), `finish.sh` (tower 12k tris, foot 8k,
  1024 WebP, meshopt): `public/assets/far-reach/models/mill/mill-tower.glb` (262 KB, from tower-b) and `mill-foot.glb`
  (268 KB).
- `turntable-tower-b.jpg` (shipped: the boarded curb and stout windshaft read as a mill), `turntable-tower.jpg` (not
  shipped: a purple onion cap, the ivy over half the back), `turntable-foot.jpg`.
- `board-mill.jpg`: mockup A / C / proposal B beside the round-14 capture (code mill,
  progress/far-reach/20261003-0823-ce11353e) and the new build, same cameras; then h2-windmill before and after.
- `board-close.jpg`: walking up to it: the bridge landing, the north side (the stone foot shows in the meadow's hole),
  the east wall, the foot of the wall.

In code (world/mill.ts `modelledSet`): the tower is scaled so its stub sits at the code hub's height (9.6 m, so the sails
sweep the circle the mockup framing was tuned on) and turned so the stub faces the spawn; its footing pulled to the
code tower's 2.6 m radius. The paint is pulled toward mockup A's pale whitewash (wall saturation 46 % -> 24 %; the code
tower's 25 %, the mockup's 17 %) and the painted stone (`tex/mill-stone.webp`) on a seam-free cylindrical UV gives the
courses as bump and a light multiply. The sails stay the code ones, turning (canvas spread full length on three sails,
one reefed: round 14 seat A, "rigid sail grids"). The foot: squashed to 1.1 m, sunk 0.45 m; up to 0.65 m hugs the wall
inside the meadow's 2.9 m hole, at most 0.3 m proud from 2.9 m out. The collider (world/build.ts, 2.3 m box) is
unchanged; the walk baseline 0 stuck on all six legs. The code tower stays the fallback.

Open: a taller rooted rock spur under the mill (proposal B, mockup C) needs its own collider in world/build.ts (not this
job's file): at the current collider anything over the step height outside 2.9 m would be walked through. Mockup A's
ivy on the tower's spawn-facing left is on the model's back (the reference put it left of the door; the stub decides the
facing).
