# Convex1 real-touch regression driver

Status: prepared, not browser-executed. No admission or new quality score.

## Frozen identity

- Driver: `test/proof/rooted-pitcher-app/convex-app1-touch.mjs`.
- Historical source commit: `82bf5559ff71324f6a0a0fe1327367932912130e`.
- Pin: `ROOTED-PITCHER-CONVEX-PIN1.json`, SHA256 `19686876ac71d5150da5afda950336f57e9cf1f6b6275b8192d7f577c2ba549f`.
- Actual built receipt SHA256: `c7e712fecf4742f138d4a216c6e1b66af7eb68af081a89aada4c67200911e856`.
- Exact retained host: `tmp/rooted-pitcher-convex1/dist`. Complete file inventory and embedded pin are checked before execution and after capture.
- Evidence destination: new-only `tmp/rooted-pitcher-convex1/touch-contact-persistence`. Existing evidence causes refusal.

## Scope and method

The retained supplement-app4 source stays unchanged. This driver repeats its bounded real joystick, LOOK and sword sequence, including the same 60-attack ceiling and two-miss real backstep. The first goal is to reproduce or resolve the prior near-6-HP failure with the convex ownership fix, not to change combat parameters. Failure to navigate, align, kill, collect loot or finish a wait is a recorded failure, never a pass. No enemy/player placement, force damage, direct attack invocation, simulation stepping, pose writes or clock overrides are used.

Read-only observations verify production player radius 0.38 and half-height 0.52, collision-owned living root versus actual collider translation, and rendered root versus actual published interpolation history. A passive RAF observer records real wall timestamps, native clock snapshots, pose inputs, existing world matrices and draw counts. It does not update matrices or invoke the simulation. These are rendered-frame samples, not every fixed tick. Full video is retained, hashed and ffprobe-counted; nominal video rate alone is not simulation cadence or physical-phone performance.

Only after an actual sword kill, the driver queries all seven uniquely named native corpse hulls against the actual floor and production player collider, with retained local/world vertices, contact distances and rendered mesh minima. Shape distances are not solver contact impulses. Floor separation is reported distinctly from touching or penetration; proximity is not labeled contact. Loot, Retry, Back/start and reload/start are exercised. Retry/Back old-owner disposal and fresh HP/health/coin state are checked. Local/session storage, IndexedDB databases, CacheStorage, service workers and game SaveStore are queried explicitly; API exceptions fail rather than implying emptiness.

An attack failure preserves its video, traces, inputs and failure screenshot but leaves post-kill/contact/lifecycle checks untested. Player defeat and complete quality review remain separate open work. No public integration, quality completion or admission follows from this engineering driver.

## Execution boundary

Root must inspect and checkpoint before granting browser GO. Use the canonical browser lane, installed Chrome shell, and these exact environment bindings:

- `ROOTED_PITCHER_RECEIPT_SHA256=c7e712fecf4742f138d4a216c6e1b66af7eb68af081a89aada4c67200911e856`
- `ROOTED_PITCHER_CONVEX_GO=reviewed-convex1-touch-contact-persistence`
- `CHROME_PATH=$PWD/tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell`

The execution guard does not itself authorize a browser run. `--verify-only` checks pin, receipt, host inventory and historical source without creating a browser or output directory. Syntax and verify-only passed during preparation; selected lint is recorded by the coordinator before checkpoint. No build or runtime source was changed by this preparation.
