# Mantis candidate7: authoritative precontact sweep

Source-only, unaccepted WIP. Candidate6 remains the exact published fallback. No app build, mounted browser, publication, physics/contact acceptance or phone-performance acceptance is claimed.

## Implemented

The existing numeric pose reads `frame.attack`: normalized authoritative windup while nonnegative, then negative after cancellation into active. Stages1/3 alone admit attack motion. Live windup overrides every stale observer phase. After cancellation, observed windup or active immediately selects the original full cut, including same-tick cancellation before the10Hz observer updates. No previous-joint input, local memory, frame-history smoothing or new engine API.

Normalized keys: raise0–.30; hold.30–.45; smooth sweep.45–.95; full-cut endpoint.95–1. Existing actual windups remain.75s/.45s. `tell = smoothstep(attack/.30)*(1-sweep)`, `cut=sweep`; body lift uses their sum. Original attack amplitudes and active endpoint remain unchanged. Active still holds; recovery still follows the10Hz observation and can stair-step. This is not a recovery fix.

New isolated files use `Precontact`, `precontact`, `motion7`, and `arena-candidate7`; none of the candidate6 sources, files or hosts was edited. Exact candidate7 admission pins the existing native22 geometry/payload, measurements, decisions, AI and combat source, plus new clips/preview. No identity wildcard or shared exemption.

## Executable evidence

- `node --test scripts/mantis-precontact-admission.test.mjs`:3/3 passed, including changed tuple and self-authorizing receipt rejection.
- `node node_modules/vitest/vitest.mjs run --config docs/reviews/mantis-precontact-source/vitest.config.ts`:10/10 passed in2files.
-30 native numeric programs; maximum111nodes, below128; no locals or joint inputs.
- Both stages and all stale observer phases tested at exact raise/hold/sweep/endpoint keys; same-tick active, active hold, recovery endpoint, first-recovery→second-windup reuse, and stages0/2/5 gate tested.
-700 cases retain exact candidate6 lower-body living gait and accelerated death local poses.14 lower-body/head/abdomen DAGs remain byte-identical after program-ID normalization. Full dead-stage poses remain equal. These are local-pose tests, not a new runtime corpse-contact proof.
- Combat/AI/moves/strikes/rewards catalogue data are candidate6-exact. The isolated species display label changes from EarlyKnee to Precontact; test decodes the hashed section and normalizes that label only.
- Actual native vertex skin indices/weights are applied, rather than bone-only proxies. Fixed identity-root blade travel remains1.236036m. Boundary discontinuity falls from1.236036m to0 at both strikes. At30Hz across10 phase offsets, maximum vertex steps are.174651m(first) and.289147m(second); maximum shoulder steps.146269rad and.242602rad. Sampled local minimum bladeY=.403522m; all-meshY=.013308m. These synthetic fixed-root samples do not establish runtime ground clearance or continuous contact.

## Failed preflights and limits

Preserved logs:01 pnpm automatic store/dependency preflight failed before tests;02 initial700-case parity exceeded the default5s test timeout (assertions themselves succeeded), corrected to30s;03 initial catalogue parity compared hashes after a changed display label, corrected to compare decoded bytes with only that label normalization.04 passes all10tests. First lint found two formatting issues, corrected without exemptions. Full root TypeScript checking was resource-killed with exit137; no typecheck success claimed and no retry attempted.

Existing candidate6 captures omit pose-owned `attack`, so these tests do not claim exact candidate7 replay of4471 historical rendered poses. A new mounted capture must record exact pose-owned `attack`, `t`/boutTime, authoritative strike state/clocks, observer fields, world matrix, deathT/flinch/speed/gait and the evaluated bones. Independently inspect first-hit timing, stale-phase transitions, blade trajectory, both strikes and world-space early death before considering an app replacement. Recovery stair-steps, held active, possible world/root discontinuities and corpse overlap remain explicit limitations.

## Reproduce

Run the two test commands above from the repository root. Use direct installed Vitest; do not trigger pnpm dependency installation. Product/app builds require the coordinator's build lane and remain unrun. The isolated build entry is `scripts/build-mantis-precontact-preview.mjs`; its heavy-lane assertion and nonempty-destination refusal remain intact.
