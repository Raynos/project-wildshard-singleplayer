# E357 J15 production title deck hotfix — sol-deck

Runtime candidate: `f15d3c61be3dc66a38c2b7bacda718c306a52871` (base `597c3b7b`).

The manifest status was used only to paint an Experimental badge; every deck card unconditionally ran Enter/Explore. The title deck now derives entry availability from that badge/status and current Developer mode, paints Coming soon in player mode, disables both buttons and guards both callbacks (including keyboard activation and stale card objects). Hidden status and underscore-prefixed slugs are excluded from the player deck; Developer mode reveals them last with DEVELOPER ONLY.

The reported template visibility did not reproduce on a fresh production load or with Settings toggles/reloads. Both StartTitle and HUD already subscribe to Developer changes. The device boolean, document mirror, and switch agreed in all captured checks. No devMode, devSwitch, HUD, shard content, or baseline edit was necessary.

## Captures

Nine visually inspected JPEGs at 390×844, Chromium with an iPhone-size viewport (not a physical iPhone/Safari capture). `developer-off-{driftwood,nine-dragon,signal-dunes,sky-reach}.jpg`; `developer-on-{driftwood,nine-dragon,signal-dunes,sky-reach,template}.jpg`. The Settings switch was used to change modes; no URL toggle. Each mode also survived a page reload. JSON files record deck membership, selected card, saved state, and disabled buttons.

## Validation

Clean export: `pnpm gen`, `pnpm exec tsc --noEmit -p .`, whole-tree `pnpm exec oxlint`, `pnpm exec vitest run`: 359 files / 2,460 tests passed. Focused tests cover all cards in both modes, loaded experimental cards, both click paths, keyboard activation, stale developer card rejection, hidden order/ribbon, and Developer switch behavior.

`node scripts/parity.mjs --export=f15d3c61be3dc66a38c2b7bacda718c306a52871 --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses`: all seven boot.errors empty; original-four results GREEN. Overall exit 1 comes from template and Signal Dunes baseline mismatches; Far Reach is lane-pending. No baselines were changed. Full temporary report: `progress/parity/f15d3c6/report.md`; compact results retained in verification.json.

Browser closed and foreground preview stopped after capture. The detached serve-build previews disappeared between tool calls; the capture used the already-built parity cache in a foreground Vite preview instead.

Lead lands the private runtime candidate plus the evidence candidate, gates and ships the hotfix. No production deployment was performed by sol-deck.
