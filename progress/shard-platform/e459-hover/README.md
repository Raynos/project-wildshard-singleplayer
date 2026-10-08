# E459 HOVER touch regression

Fix: `8f1918525d2d433b46cfb10161647d2900bef2fb` (rebased exact changes from the
tested clean candidate; unrelated HEAD changes preserved).

On production-source pin `0e6d69988`, the exact `_template` boots with only
`tool.template-lantern`: HOVER is visible and allowed, but a real touch tap cannot
mount a board. Chromium and WebKit both reproduce this. The admitted shardfile
manifest discarded the platform tool loadout.

The fix retains the platform hoverboard alongside authored tools. On clean
candidate `cebc8f4a5d3b8374e1fdd0d2a14b1b9687236804`, actual touch mount and
dismount pass in the template and on the road in both engines: **4/4**. The
mounted check requires player hover state, blend > 0.5, enabled board and visible
board model. Both engines use the iPhone 16 Pro profile, muted audio, separate
contexts, and Developer enabled to expose both catalogue entries. Road staging
uses the existing harness pose; mount/dismount always uses the actual HOVER tap.

The settled road symptom did **not** reproduce on the old pin (2/2 pass). A
separate real native-world test proves the home save fence used to disable the
carried board along with local tools. The fix preserves its current enabled
state while stowing local tools, and global input disabling still prevents it.
This identifies a road availability defect without claiming an iOS-only cause.

Commands (both pins served through `serve-build.sh --rev`, browsers lane-owned):

```sh
node scripts/parity/hover-touch.mjs --url=<built-preview> --out=<evidence>/chromium
scripts/browser-lane.sh --max 8 node scripts/parity/hover-touch.mjs --engine=webkit --url=<built-preview> --out=<evidence>/webkit
pnpm exec vitest run test/grid-hover-tool.test.ts test/shardfile-runtime-format.test.ts test/grid-page-shell.test.ts
pnpm exec tsc --noEmit -p tsconfig.json
pnpm exec tsc --noEmit -p scripts
```

Focused tests **7/7**; root typecheck on the clean built candidate, scripts
typecheck, focused typed lint and private source hooks pass. The same touch
regression is installed in the exact-SHA `boot-smoke` CI workflow. No touch
handler, HUD layout, renderer or physics behavior changed. This browser proof
does not claim a physical iPhone performance reading. Raw results are in
`touch-results.json`; the initial wrongly selected-shard rehearsal is excluded.
