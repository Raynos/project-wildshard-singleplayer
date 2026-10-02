# E357 L6 — game-owned Bag tabs and embedded UI layers

Before: `97453d22`. After: `b0edb0abb3335766faaf912d85e0be74be9981f3` (tabs `92afb677`, layers `b0edb0ab`, parent `7501007f`).

The 32 JPEGs cover every visible Bag tab at 390×844 on all four original shards. Each `contact.<shard>.jpg` has before above and after below, in tab order. All four final contact sheets were inspected. Tabs, labels, hints, paper dolls, cosmetics, pack/trade text and feats retain their presentation. The map canvas is blank in both automated captures; this capture does not prove map cartography. FullMap navigation/layer lifetime is covered by the embedded-layer regression tests.

`capture.json` contains every panel's markup, tabs and hint. `dom-comparison.json` confirms all 16 tab lists and hints agree. Every panel's markup agrees after removing the registry-owned map z-index, except Driftwood FINDS: its normal spawn-place discovery tick advanced Places from 0/9 to 1/9 between captures. No markup other than that counter differs.

`final-parity-comparison.json` compares the final candidate to its exact parent. All four boots have empty errors and zero changed deterministic fingerprint/pose values. The baseline comparison exits 1 on identical existing differences: HUD/scene inventory after J14, the expanded shard save registry, and Pine's ready NPC geometry/memory/draw budgets. No SSIM row is red. No baseline was edited. Earlier isolated L6 comparison against `97453d22` is in `parity-comparison.json`.

Final clean export: generator, strict TypeScript, whole-tree oxlint, **322 files / 2308 Vitest tests**, CSS check and Vite build pass. Bag tests cover equipment/cosmetics actions, explicit tab selection, arbitrary registered content, multi-owner finds and authored fragment-only finds. Layer tests prove embedded views never inert their ancestor, take back navigation or block gameplay, and dispose with scope ownership.

## Reproduce

Hold a retained exec lease while serving: in one PTY call run `SERVE_BUILD_DIR=/private/tmp/sol-x2b/serve scripts/serve-build.sh --rev <sha> --port 4954 --hours 1 --name sol-x2b-l6`, followed by `read -r sol_x2b_preview_lease`. A detached server launched by an exec call can die when that call returns.

From a second call: `scripts/browser-lane.sh wait && agent-browser --session sol-x2b-l6 open http://127.0.0.1:4954/ && agent-browser --session sol-x2b-l6 set viewport 390 844`, then `python3 progress/normalization/l6/capture.py <output-dir> <before|after> 4954`. The script closes its browser in `finally`. Stop the preview with `scripts/serve-build.sh stop 4954`, then release the retained lease.

Smoke: `node scripts/parity.mjs --export=<sha> --lane=m5 --shards=driftwood-isle,pine-hollow,nalati-grasslands,nine-dragon-stack --tiers=phone --only=fingerprint+poses --retry=0 --out=<output-dir>`.
