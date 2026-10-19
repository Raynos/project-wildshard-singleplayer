# Motion5 actual capture preparation

Prepared 2026-10-19. Source/light-test preparation only. No build pin, product,
host, browser, capture, deployment, visual acceptance or quality score was created.
The root owns the build and browser lanes and must pin only after these sources
are final. Existing motion4 scripts, candidate, host, results and Site are retained.

## What is ready

- `scripts/qa-conch-motion5-identity.mjs`: admits the new motion5 source/build pin,
  checks the exact validated product, source hash, native metadata/payload and
  frozen pose, then compares the host preview byte-for-byte with that product's
  receipt. Verifies every emitted host file against `motion5-host-files.json`,
  records that inventory's own hash and rejects additions/deletions/symlinks.
  Read-only checks do not call the build config or need a build lease.
- `scripts/qa-conch-motion5-capture.mjs`: new actual arena driver. Uses only the
  isolated motion5 dist; arbitrary URL/dist overrides are refused. New output
  directories are required. Muted approved Chromium, iPhone 16 Pro portrait,
  402×874 recorded video, deviceScaleFactor 1 diagnostic observer capture.
  This is not normal phone-render-policy or physical-device performance proof.
- `scripts/qa-conch-motion5-observation.mjs`: separate observer with the correct
  burned-in MOTION5 UNACCEPTED label. Read-through callbacks preserve original
  call/return behavior. Records authoritative pose inputs and memory, attack,
  flinch, stage/behavior clocks, `tg-state` (null if absent), StrikeRunner state,
  frame/bout/wall/game times, root/joint/mesh world transforms, local rotations,
  canonical skin geometry and queried actual arena floor per render.
- `scripts/qa-conch-motion5-coverage.mjs`: collision-time qualification, full
  ordered sampled strike cycles, hit/death local-axis transitions, clock-zero
  stun, repeated hits while flinching, and observed render intervals. Missing
  evidence remains `not-observed`, not an assertion of unreachability.
- `scripts/qa-conch-motion5-mounted.mjs`: local mounted Site entry/desktop start,
  native phone policy, real combat, guard/counter, deaths, reward, Retry, reload
  and empty persistence. Routes only `/conch-engine/` to motion5 without changing
  Site files. Verifies exact motion5 identity before/after, Site HTML and all four
  existing app inventories unchanged. Functional evidence only; no publication.
- `scripts/qa-conch-motion5-contact.mjs`: fresh all-four-weight world skinning,
  canonical geometry equality, per-render actual floor (no root subtraction).
  Requires matching before/after capture identity and evidence hashes.
- `scripts/qa-conch-motion5-frames.mjs`: every encoded full portrait frame streamed into 8×6 JPEG sheets,
  exact ffprobe PTS, explicit frame ranges and sheet-count equality, sheet hashes. Refuses overwrites.
  Producing this inventory does not perform human inspection.

## Reuse audited and limitations retained

The old capture directly admits motion4; changing its dist was insufficient.
The old observer burned MOTION4 into the image and hid the first-person viewmodel
while restoring its diagnostic camera after rendering. The new observer keeps
that explicitly disclosed camera policy, never an alternate pose or combat model.
The older world-contact helper expected different stream filenames and assumed
floor Y=900. The new driver emits its exact expected names; the new contact copy
uses each observed arena ground-height query. The old frame-sheet helper inferred
frame time from FPS and cropped the creature. The new decoder preserves complete
portrait frames and actual PTS instead. No historical result is reused as evidence.

Only diagnostic PLAYER placement/aim is injected and logged. Actual native touch
attack inputs drive sword collision, health, guard and counter. No enemy, damage,
health, time, random, pose, or loadout injection. Spear is not supplied and is not
injected. Observer matrix refreshes read existing transforms, never animate on
observation. `tg-state` absence is explicit, not synthesized.

The scripted trial sweep requests early guarded .10/.20, late windup, active,
recovery and counter preparation .215 with three button lead offsets, preserving
all unsuccessful attempts. It also attempts repeated hits/clock-zero stun, waits
seven seconds after attempts for later cycles, approach/stop/resume, active-phase
lethal onset at low actual health, corpse, enemy-caused player defeat, Retry,
reload and empty stores. Collision clocks and last evaluated pose clocks both
remain in evidence. Input delivery/weapon windup may miss requested clocks;
`requiredMotionCoverage` stays false if any required target lacks actual evidence.
A finite failed sweep cannot prove a state unreachable. Further actual attempts
need a separately preserved run; never rewrite a failed report or edit the pin.

Known source risks remain explicit: guarded .20 jump .36631255398 rad versus
motion4 .16759259259, guarded .10 regression, counter .215 discontinuity, and
living-to-death yaw up to .8 rad. Actual hit/death matrix/axis differences are
recorded, not assumed equal to source samples. Whole sampled strike cycles and
encoded frames are separate evidence; no render-to-codec correspondence is assumed.
Human review of every encoded frame, fresh world-contact interpretation, actual
coverage completeness and independent acceptance are still required. No four-star,
continuity, foot-planting, death-improvement, fun or physical-phone claim follows.

## Root commands after final pin and successful exact build

Run from the repository root. These commands have NOT been executed here.

```sh
node --test tests/conch-motion5-capture-identity.test.mjs
node_modules/.bin/oxlint scripts/qa-conch-motion5-*.mjs tests/conch-motion5-capture-*.test.mjs

# Root owns the lane. New attempt directories only; preserve failures.
CHROME_PATH="$PWD/tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell" \
  CONCH_QA_OUT=tmp/conch-motion5-qa/actual-run1 \
  scripts/browser-lane.sh --max 30 node scripts/qa-conch-motion5-capture.mjs
CHROME_PATH="$PWD/tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell" \
  CONCH_QA_OUT=tmp/conch-motion5-qa/mounted-run1 \
  scripts/browser-lane.sh --max 20 node scripts/qa-conch-motion5-mounted.mjs
node scripts/qa-conch-motion5-contact.mjs \
  tmp/conch-motion5-qa/actual-run1 tmp/conch-motion5-qa/actual-run1/weighted-contact.json
node scripts/qa-conch-motion5-frames.mjs tmp/conch-motion5-qa/actual-run1
```

Disk headroom is under 1 GiB. The decoder streams 100×218 full-portrait thumbnails
into JPEG sheets without retaining a full-frame PNG/JPEG cache. Keep the original
movie for full-detail on-demand inspection. Sheets and metadata stay under `tmp`,
not repository evidence or production assets; preserve all existing caches/originals. Do not publish raw files.
Mounted QA expects the existing `../wildshard-review-site/dist` and its four apps;
missing Site prerequisites are blockers, not permission to create/alter them.
The capture server is loopback port 4468; mounted server is loopback port 4478.
No Site or remote write is part of these commands.

## Preparation checks

Five focused Node tests pass: exact host mutation rejection, symlink rejection and
complete inventory, collision-vs-press qualification, nonvacuous ordered cycles,
and observer identity/required input fields. Syntax checks and scoped direct oxlint pass. Source identity currently refuses
with the missing new reviewed-build pin, as expected. Browser and heavy work not run.
