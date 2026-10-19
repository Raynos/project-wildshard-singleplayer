# Candidate7 independent source review

2026-10-19. Reviewed source commit `5df5e1be3`, exact admission SHA256 `5b4d993d4d16f41406cd8e4757d56a5582fcc302eee145c93a15284ad958d004`.

## Decision

**GO diagnostic-build only.** No visual, runtime, collider, continuous-contact, performance, publication or replacement acceptance follows. Candidate6 remains the fallback. Animation/readability scores stay unchanged. The new diagnostic must record actual pose-owned attack and measure first contact in the real physics/world flow before promotion.

## Source conclusions

- The real numeric pose DAG reads `frame.attack`, using raise0–.30, hold.30–.45, sweep.45–.95 and endpoint.95–1. Both .75/.45s windups are unchanged. This is an actual authored precontact sweep, not a delayed active ramp. Active remains a held cut and recovery remains a10Hz observed step.
- Live attack wins over all observed phases, including fresh first/second windup with stale idle/recovery. Negative attack with observed windup or active selects the full endpoint immediately. Recovery after cancellation matches candidate6 exactly. Stage0/2/5 blocks stale attack; reused-rig reset/missing-memory cases return to rest. No previous-joint reads, private locals, history or new engine clock.
-30 programs, maximum111nodes, all inputs frame/scalars only. Exact admission independently passes3/3, including tampered tuple and self-authorizing receipt refusal. All9 shared candidate6/7 pins agree; metadata, dimensions and dimension-measurement bytes are identical. Geometry/material payload, AI, moves, HP55, damage10, rewards3 and strike declarations are preserved. The only non-pose catalogue difference is the isolated display label, tested after decoding hashed sections.
-14 lower-body/head/abdomen program DAGs are byte-identical after ID normalization.700 bounded cases preserve legs; full authoritative stage5 death poses and final endpoints match. This does not claim arbitrary inconsistent synthetic death inputs with a live attack stage are identical.

## Independent native geometry and recorded death evidence

The copied baseline checks were redirected into this review directory; additional checks were authored independently. All geometry measurements apply actual native skin indices/weights.

- Each strike moves native blade vertices1.236036m between tell and cut. Cancellation endpoint displacement is exactly0, versus the former1.236036m switch.
- Across20 offsets per cadence, maximum full-joint quaternion steps are first/second:60Hz .073479/.122320rad;30Hz .146666/.243294rad;10Hz .430687/.686786rad. Maximum30Hz vertex steps .174651/.289157m. Low-cadence gaps remain substantial; numerical continuity is not visual smoothness acceptance.
-97 actual moving and127 actual stationary-supplement stage5 poses reproduce their captured local skeleton within1.11e−16. Candidate6 versus candidate7 weighted full-world vertex error is exactly0. Minimum sampled clearances are13.651mm and13.667mm respectively. These use recorded pose-owned t/speed/gait/deathT/flinch and full world matrices. Missing historical attack is mathematically irrelevant at stage5 and is not invented for living rows. No new main-trace input or continuous clearance claim.

At41 normalized keys per strike, weighted triangle surface checks find only proximal raptor:neck overlap, present at every key including rest, tell and cut. No elbow/hook surface crossing with body/neck/head/abdomen is found. This is a bounded surface test, not a containment or whole-body self-collision proof.

## Combat timing and its limits

The exact StrikeRunner with the unchanged declarations was tested at60Hz using documented attack clock semantics and deterministic straight-line root integration. This is not Rapier or a mounted runtime replay.

- Close range .8m: first damage .766667s/.483333s; cut endpoint .716667s/.433333s,50ms before damage. Native vertices first enter an actual-size Player capsule16.7ms after damage in this diagnostic.
- Normal2.8m approach: first damage1.050000s/.766667s; full cut is held about333ms before damage. First native vertex overlap follows damage by33.3ms. This exposes the known held-active readability limitation; it is not evidence of a continuous active swipe.
- Obstructed and fixed-root long-active cases cause no damage and retain active about1.717s, preserving the lane timeout instead of incorrectly treating nominal .5s active as its endpoint.
- No sampled native vertices enter the player capsule before damage in these cases. A negative vertex test does **not** exclude a triangle crossing or containment. Actual root motion, relative orientation, triangle/capsule overlap and first-hit timing still require the diagnostic capture. No damage clock was moved to fit animation.

## Validation scope and retained failures

Commands from repository root:

- `node --test scripts/mantis-precontact-admission.test.mjs`
- `node node_modules/vitest/vitest.mjs run --config docs/reviews/mantis-precontact-independent/source/vitest.config.ts`

The first independent run had13passing tests and one test timeout: the extended quaternion sweep took37.9s against a30s limit. Its numerical assertions completed without a mismatch. The log is retained; the second run increases only test timeout to120s, without relaxing any assertion. Builder's root TypeScript process was killed137; no successful full root typecheck is claimed. No application build, browser, Mac operation, remote write, source edit or STATE edit was performed by this reviewer.

Final independent rerun: **15/15 tests in2files pass**. Independent admission: **3/3 pass**. `independent-results.json` contains full measurements. `log-normalization.json` preserves raw log hashes before replacing the executor prefix and trimming trailing blank lines; failures remain intact.
