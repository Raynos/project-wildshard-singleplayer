# Complete-cycle recorder and check plan

Status: NOT RUN. `capture.mjs`, `camera-observation.mjs`, `observe.mjs`,
`checks.mjs` and `verify-capture.mjs` implement this bounded protocol and must all be
reviewed before the fresh root pin. Source changes after pinning invalidate it.
The old frozen-rest observer is excluded. Root explicitly permits the tested Conch4
diagnostic follow camera and logged player placement/aim; these are disclosed below.

## Execution envelope

One root-reviewed current-runtime build with fixed control.html and tent.html
entries, no product bake. The short PCF control recording uses the same current
runtime, compiler and exact product as tent; only first-use filter selection
differs. Retained original4 is byte-verified fallback/reference only and is not
used as whole-runtime parity proof. Existing heavy-lane build lease. One
muted iPhone 16 Pro browser through scripts/browser-lane.sh, installed Chrome path
and binary closure fixed by manifest.mjs. Static server over the exact verified
DIST only; no Vite development server or arbitrary URL/output overrides. New
capture directory only. 600 seconds browser wall time, at most 600 seconds total continuous
portrait movies, 24 raw portrait full-canvas frames, 192 MiB aggregate new pin/build/
evidence. Set a wall-clock watchdog before launch; stop and preserve partial
report/movie on any error, cap, missing phase or failed identity. No automatic
retry, replacement attempt, source refresh or old-file overwrite. Close only this
browser/context/server in finally, by retained handles. Capture is cloud diagnostic,
not phone performance.

## Exact identity and absence of persistent writes

Before launching and after closing, call verifyHost(), which recomputes full source,
tool, original-host, native preview and output closure. Retain both exact identities
in report. Intercept requests read-only and record URLs plus response-byte hashes for
all native payload, product index/validation/sections/pose/WASM files actually loaded.
Assert every expected loaded product matches public-product.json; any unexpected
product/native asset refuses. Match built entry/bundles to host inventory. Do not
replace fetch responses or route bytes to a fixture.

Fresh browser context; record localStorage, sessionStorage and IndexedDB database
names before Start, after combat, Retry, pause/resume and reload. Record existing
practice saves.exportAll().docs and inspectShard / inspectShardGeneration using the
same read-only calls as the established practice checks. Require these to remain
empty; do not call clear/delete to manufacture emptiness. No service worker should
register. Record actual save observations, not just an empty initial state.

## Passive records

Sample actual existing __practiceDemo at rendered-frame cadence with bounded arrays
and serialization caps. Do not set engine wall/frame/elapsed/fixed-step clocks,
captureFps, frameGate, RNG, pose, enemy position/state/HP, player HP, damage, strike,
loot or save data. Do not call animate or advance a fixed step for observation. The existing tested follow camera and hidden viewmodel are reused solely to retain
full-character diagnostic motion visibility. Every player placement and aim change
is logged. Actual touch inputs still execute attacks; the real UI executes pause
and Retry. This is explicitly not ordinary first-person play or natural locomotion.

Retain wall timestamp and origin, engine frame/time, app state, current actor identity,
bout elapsed/fixed remainder, gait, speed, alive/HP/deathT/flinch, real control
snapshot strike id/phase/elapsed and authored conch stage/guard/regular-clock, player
position/HP and actual loot receipt. Observe existing damage events without emitting,
consuming, flushing or changing them. Record before/after HP and event order. Retain
bone-local and bone-world matrices and every skin lane for feet/blade/contact sample
frames from actual native draws; include all weighted influences, geometry identity,
bind matrices and world transforms. Cached-matrix reads must not substitute for
rendered poses. Video anchors use actual wall/game/frame records; do not assume
codec cadence or deterministic pixel identity between advancing-time runs.

First-use evidence must show one existing CSM light, unchanged rig/map/bias/radius,
zero prior receiver graphs/programs/render calls and no prior filter. The boot seam's
existing firstUse check fails closed if these are false. For rendering proof, retain
actual CURRENT_PROGRAM and linked fragment shader for every native Conch mesh draw,
through the already reviewed public WebGL observation technique. Any forwarding
onAfterRender observer must call the original exactly once and preserve arguments,
receiver and return; it must not mutate the shader or create a new render. Require
castShadow and receiveShadow true, control Vogel/noise constants and tent arithmetic
2704/144 with comparison sampling
and receiver-plane derivatives, no Vogel/noise constants, same light/filter identity
through retries. A filter configuration label or dark pixels alone do not prove it.

## Required continuous cycles

1. Start normally in initial-pursuit, place the player five metres away inside the
   arena, and observe real walk. After a native attack, observe a stationary
   post-strike neutral/rest window: alive actor/player, stage2, guard0, speed below
   .05, no flinch, idle StrikeRunner, evaluated pose attack=-1, at least three
   consecutive observed frames spanning .4 real simulation seconds, unchanged
   actor position and both actors inside the arena. This is NOT ordinary or
   sustained disengaged idle. That original requirement remains unsupported and
   unproven under unchanged AI; no distance trick or AI modification is permitted.
2. Stay within natural attack range, recording anticipation, active strike and full
   recovery. Actual player damage must occur from a real strike/contact. Record the
   first-contact frame, event ordering and HP delta. Avoid collider or range edits.
3. Guard/block naturally, then counter; record guard, recoil/recovery and enemy hit/
   flinch. Interrupt a natural windup by an ordinary input attack if reproducible.
   Missing interruption is missing coverage, not a waiver or forced state.
4. Continue normal combat until enemy death. Retain full death and settled endpoint,
   actual coin/reward receipt and reward amount, with no duplicate payout on extra
   attack/wait. Source equality does not prove the runtime reward path executed.
5. Retry through the real UI; establish a new live actor and HP reset, one world/
   canvas, exact same Conch product and empty stores. Let the enemy defeat the player
   through actual damage and retain defeat UI and Retry recovery to live combat.
6. Pause during active normal combat, record frozen simulation/bout state across wall
   time while paused, then resume and require advancing clocks and ordinary recovery.
   No catch-up burst, duplicated strike/damage/reward or bypass of the pause UI.
7. Reload the page, verify identity/empty stores and Start/Retry behavior again. Repeat
   a short natural attack/recovery sequence to exclude one-shot initialization only.

Interruption phase labels alone do not prove that damage landed at each intended
boundary. Actual damage-event, strike and evaluated-pose clocks are required;
phase presence is only recorded trial coverage.

Require every phase with raw supporting frame/event ranges. Checks must fail for a
missing phase, non-monotonic advancing clock, unexplained clock jump, missing damage,
missing/duplicate reward, absent defeat/Retry/reload, nonempty store, shader mismatch,
identity delta or page/console error. Existing interruption, foot-sliding and contact
limitations remain disclosed; successful source tests do not change their verdicts.

## Independent review and stopping condition

Review the actual complete portrait movie and all phase-marked full canvases, not
only a still or contact sheet. Assess stippling during movement, shadow retention,
edge softness and temporal stability while preserving Conch4 silhouette/poses.
Motion/readability and likeness remain separate, with no inherited >=4 score. Tent
radius2 has sixteen comparison taps rather than five; no phone-performance inference.
If all functional checks pass, return an unaccepted candidate report plus separate
independent visual verdict. Any blocker ends this bounded attempt with partial evidence
preserved. Shipping/shared-arena integration, replacement of public4, selected model
admission and a second attempt require separate review and authority.

## Attempt2 corrections and acceptance scope

Attempt1 remains immutable and failed. The new harness records actual bindMode and
associated world matrices for initial geometry and every trace/event observation.
Invariant positions/indices/four weights/triangles/bones/bone inverses/bind matrix
and mode compare exactly across entries. Every dynamic inverse is independently
checked against its own world matrix under installed Three attached binding, with
finite/non-singular checks, inverse coefficients and both matrix product orders
within absolute 1e-8. No dynamic inverse is silently dropped.

Actual pre-presentation enemy damage events retain trial name, StrikeRunner clocks,
behavior clocks and prior evaluated pose. Missed interruption boundaries are
reported explicitly, not accepted from phase labels. `completed` means only the
supported combat/lifecycle plus same-runtime filter parity checks; it never closes
sustained disengaged idle or missing interruption boundary coverage. `acceptance`
remains false pending independent complete motion review.

Reload follows successful invariant/dynamic-binding comparison. Separate hashed
reload streams, new performance.timeOrigin, fresh hp/species state, empty stores,
actual post-reload player damage, normal clocks and fresh first-use/native shader
proof are mandatory. No pre-reload event substitutes for reload proof.
