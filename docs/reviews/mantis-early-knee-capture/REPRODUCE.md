# Candidate6 isolated actual-engine diagnostic

This run is evidence collection only. Candidate4 stays public; candidate5 failure and all frozen source studies remain unchanged. No visual, collider, physical-phone or fun acceptance is implied.

The source checkpoint is 1c2d1c02ceb02a1d170117945b0dc1ea251b2a0a. The source-study closure SHA256 is 3c61ef62e165f6651256f792b5a8d5d0b80d884b8f7637d2f8c3c57157d31c1d. input-freeze.json pins actual current engine/game/SDK source and tooling; built-freeze.json pins every product and served file plus native geometry. This current host is not assumed equal to the historical public candidate4 host.

## Commands

Run from repository root with the already-installed Node/dependencies. Environment: PATH prefixed by repo/tmp/dot-audit/bin; HOME=repo/tmp/home; NODE_OPTIONS=--max-old-space-size=4096; pnpm_config_verify_deps_before_run=false. No installs.

1. node --check scripts/qa-mantis-early-knee-motion.mjs
2. node_modules/.bin/oxlint --type-aware scripts/qa-mantis-early-knee-motion.mjs
3. python3 scripts/heavy-lane.py build -- node --experimental-strip-types scripts/build-mantis-early-knee-preview.mjs tmp/mantis-early-knee-product-capture1
4. Set MANTIS_EARLY_KNEE_PREVIEW_DIR=repo/tmp/mantis-early-knee-product-capture1. Then python3 scripts/heavy-lane.py build -- node --experimental-strip-types scripts/build-mantis-early-knee-preview.mjs --app tmp/mantis-early-knee-dist-capture1
5. Set PLAYWRIGHT_BROWSERS_PATH=repo/tmp/dot-audit/playwright, CHROME_PATH=repo/tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell, MANTIS_QA_DIST=repo/tmp/mantis-early-knee-dist-capture1, MANTIS_QA_OUT=repo/tmp/mantis-early-knee-capture-run1, and CAPTURE_SOURCE to the source checkpoint. Then scripts/browser-lane.sh --max 15 node scripts/qa-mantis-early-knee-motion.mjs

Use fresh output paths for a reproduction. Both build and capture reject nonempty/existing outputs. The static server serves only the isolated frozen build on loopback port4476. The browser is muted and portrait iPhone16Pro emulation. A single continuous video covers the entire run, including Retry and reload. Viewmodel hiding and temporary per-render observer-camera offset are explicitly diagnostic. The overlay has pointer-events:none.

## Observation boundaries

No enemy state, health, damage, clock, simulation delta or RNG is injected. Ordinary touch attack/Retry controls are used. Player position and aim are diagnostic and individually logged. The original animation function and hit callback are wrapped with transparent return-preserving observers. poseInputs records the actual animation-call inputs; top-level state records post-update/render values. These are intentionally separate at the lethal hit boundary. Full22-bone local positions/quaternions and full meshWorld are retained on every observed render. Hit points, directions, actor heading, strike snapshot and pose-owned inputs are retained at actual damage callbacks.

The three death-variant labels describe attempted placement strategies; actual movement, heading, impact and fall diversity must be established from measured events/poses. Neither labels nor source formulas establish quality. Early/late hit coverage is reported from events actually reached, never inferred from repeated attack taps. Damage assertions use observed history rather than terminal health after natural regeneration; the prior candidate5 false-negative remains untouched. Every encoded frame and every death neighborhood require independent review.
