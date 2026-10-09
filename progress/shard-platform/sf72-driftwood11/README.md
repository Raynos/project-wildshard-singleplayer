# SF72 Driftwood part 11: the page's barrel push (2026-10-09)

The page check that the barrel behaves as before after `14d05c70a` (PLAYER_BODY spread into the page's Player, the
barrel's law moved to `engine/world/interact/barrel.ts`). `barrel-page.mjs` boots Driftwood standalone on a served
build of `3d20b4446` (muted, iPhone 16 Pro, phone tier). It holds the creatures still (the headless test clears the
crabs) and pushes the tide barrel onto plate b with the touch stick (`player.touchMove`, the yaw set to the push), frame by frame. It runs the same
closed-loop push as `test/shards/driftwood-isle/headless-quest.test.ts`.

| run | moves | barrel end (x, y, z) | from plate b | `plate:tide-plate-b` | frames / s | page errors |
|-----|-------|----------------------|--------------|----------------------|------------|-------------|
| 1   | 1     | 145.09, 0.92, 10.06  | 0.24 m       | down                 | 466 / 16.5 | 0           |
| 2   | 1     | 145.46, 0.90, 10.31  | 0.69 m       | down                 | 465 / 16.5 | 0           |
| 3   | 2     | 144.91, 0.93, 10.06  | 0.16 m       | down                 | 745 / 25.8 | 0           |

The barrel tips from upright at its home (147.5, 3.5), is shoved along its length, and rests on the plate, as in the
headless runs. Run: `scripts/serve-build.sh --head`, then
`scripts/browser-lane.sh node progress/shard-platform/sf72-driftwood11/barrel-page.mjs <url> [shot.jpg]`.
