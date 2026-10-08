# Agent playtest 1, part B (E435)

iPhone 16 Pro portrait (402 × 874 @3×, touch, phone tier, muted), one shard alone through `scripts/browser-lane.sh`.

- **Sky Reach quest pin over HOVER** (`252d46815`): `sky-reach-pin-before.jpg` (HEAD `0f07e0b10` build, spawn, yaw 0:
  the "KEEPER 8 M" pin's rect overlaps `.ws-touch-hover`) and `sky-reach-pin-after.jpg` (`9b3f4b05b` build, same view:
  the pin stands just right of HOVER, no control overlapped).
- **Nine Dragon grey void** (diagnosis, not fixed here): `nine-dragon-void-before.jpg` is the walk's end at
  (11.8, Y0, −119) looking east, the full-frame grey; `nine-dragon-void-shopfronts-hidden.jpg` is the same frame with the
  `street-shops` kit hidden. The grey is a shopfront pillar's face: the street-front colliders sit on the wall line, the
  shopfront pillars and counters stand 0.6 m proud of it, so the camera presses into them.
- **Template copies** (`9b3f4b05b`): per-copy accent and number panels; covered by `test/grid-copy-identity.test.ts`. No
  grid capture yet (the grid needs Settings ▸ Developer through the menu).
