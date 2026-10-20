# WASM-HOST council: the register

| ID | Round | Seat | Severity | Location | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| R1-01 | 1 | A01, B12, C1 | must-fix | Why; H0; H2 | Integrator refusal is the module-sized fuel price, not JS speed; cost ranking unmeasured | fixed | Why split into three costs with Pine numbers; H0 profiles real scripts; H2 per-block fuel |
| R1-02 | 1 | A03, C2, C3 | must-fix | H2; W2 | In-Wasm fuel global must survive hostile binaries; static depth needs a named check | fixed | Internal non-exported global, budget in/remainder out, verified charge sequence, call-graph cycle + depth 64 refusal, local trap, no guest imports |
| R1-03 | 1 | A04, B1, B22 | must-fix | H1; W6 | Refusing reinterpret breaks AS Math; dropping finite guards leaks NaN bits | fixed | Inline in-Wasm NaN traps on float stores/reinterpret inputs; reinterpret allowed; keep refusing SIMD |
| R1-04 | 1 | A16, B2, C4 | must-fix | W6; battery 7 | Cross-device sim determinism impossible: rapier3d-simd, host JS Math, frame-drop backlog | fixed | Jake re-picked W6 10-20: guest pure, loads valid; H16 parked for deterministic physics |
| R1-05 | 1 | A02, B3, C5 | must-fix | H3; H7 | Dropping the rewind lets hidden guest state survive saves; touched range undefined | fixed | Sim lane resets globals/heap/static data per entry; committed state in host-owned columns; scramble test |
| R1-06 | 1 | A07, B15, C6 | must-fix | H5; battery 1-2 | Deferred queries late; contact through queries tunnels; next tick ambiguous; in-flight unsaved | fixed | Standard observations from one batched pass before the step; ring answered in afterBodies with ids, saved; height grid; contact via strike/sweep hosts |
| R1-07 | 1 | A08, B14, C7 | should-add | H4; H8 | No input channel; events lack tick stamps | fixed | 60 Hz-stamped input edges and atTick on events in the observation block |
| R1-08 | 1 | A08, A10, C8 | should-fix | H9 | Player swing lags through sim tick + interpolation; hit-stop unnamed | fixed | Local-player prediction in the view lane; hit-stop presentation-only |
| R1-09 | 1 | A09, B9, C9 | must-fix | H8 | Movers: v0 movers already native; a 10/30 Hz collider stair-steps | fixed | Movers stay native via motion segments evaluated each fixed step; only far-reach-legacy's v0 mover |
| R1-10 | 1 | B16, C10 | should-fix | Design; battery 5 | All bindings on one tick spike every 6th frame | fixed | Deterministic stagger by binding id |
| R1-11 | 1 | A06, B13, C11 | must-fix | H6 | Batched call widens failure scope and breaks fairness | fixed | Per-binding fuel slices, quotas, blame slot, re-step without the trapped binding, order by id, capability scoping |
| R1-12 | 1 | A12, B16, C12 | must-fix | W12; H14 | Done-bar budget unmeasurable as written (lanes, statistic, device state, 1 ms Safari clock, 20 vs 40) | fixed | p99 total script time per frame incl. marshalling and renderer, 10 Hz + view 30 Hz, LPM, 5 min warm, 20 bar / 40 stress, batched timing |
| R1-13 | 1 | A17, B17, C13 | should-fix | H0; battery 8 | H0 has no URL, results channel or decision rule | fixed | Calibration reading posted to telemetry; threshold decision rules |
| R1-14 | 1 | A13, B8, C14 | must-fix | H7; H13; W5 | One save migration can't decode v0 memory saves or v1 exact stateVersion | fixed | Owner inventory, per-hash decoders or restart-on-load, store.ts migrate hook, decoders kept, old-save fixtures |
| R1-15 | 1 | A10, C15 | must-fix | H9 | View can't read sim state; alpha undefined vs sim cadence | fixed | Host copies prev/current sim columns into view; alpha formula; zero-copy consumers listed |
| R1-16 | 1 | A11, B20 | must-fix | H9 | Guest-writable displayed transforms contradict freeze-on-trap; NaN reaches renderer | fixed | Validate/clamp candidates; protected last-good publication |
| R1-17 | 1 | A15, B5 | must-fix | Design; H13 | Synchronous ReturnProgram projections missing | fixed | Third entry ws_project (H6b); families in H13 |
| R1-18 | 1 | B6, B7 | must-fix | H13 | v0 user inventory and AS corpus incomplete; estimate light | fixed | Full inventory with lines in H13; _template first; legacy via N5; re-estimated 2-3 weeks |
| R1-19 | 1 | A14, B4 | must-fix | Order | Instrumentation changes re-hash modules and break saves before H13; deletions before ports | fixed | v2 built alongside behind Developer with explicit versions; deletions and migration only in the H13 cutover |
| R1-20 | 1 | A05, B23 | should-fix | H4; H6; W8 | Binary ABI is an outline; widths and layout unspecified | fixed | H0b wire contract before code; ticks i32, durable f64 |
| R1-21 | 1 | B10, B11, C16 | should-fix | H8; H9; H14 | First users: Jian conflicts with G515 held-melee host; view lane unnamed; demo isn't a real user | fixed | Jian input windows only (host keeps contact); view users pastel-plain/ink-cel/_template; demo supplies the reading only |
| R1-22 | 1 | B18 | should-fix | H12 | Contradicts HOST-BAR and SCRIPT-ABI without amending | fixed | H12 amends both and records superseded picks |
| R1-23 | 1 | B19 | should-fix | Why | Misses v0 whole-memory slice and ReturnProgram rewind | fixed | Added to Why |
| R1-24 | 1 | B21 | nit | Design | G484 (4) miscited | fixed | G454 (4)/(6), W8 |
| R1-25 | 1 | B24 | nit | Header | Status belongs in STATE.md | fixed | docs/plans/wasm-host/STATE.md added |
| R1-26 | 1 | B battery 4 | should-fix | Battery 4 | Does Nalati's storm need a view lane once G515 routes visuals to forestWeather? | parked | Answered by H9's first users; storm stays on G515 route unless a second view user appears |
| R2-01 | 2 | A03, C1 | must-fix | Design reset; H3; H0 | Partial reset leaves hidden state anywhere in linear memory | fixed | Whole-image reset plus globals before every sim/projection entry and re-step; one-page memories; H0 rule dropped |
| R2-02 | 2 | A01, C2 | must-fix | Design; H2 | Guest can refill fuel by calling another entry; per-binding slices contradict fuel-global rules | fixed | Entries host-callable only; read-only fuel access; SDK-enforced slices; module budget hard bound; refill counterexample test |
| R2-03 | 2 | A02, C3 | must-fix | Design; H6 | Guest-written binding ids can forge blame and authority inside one memory | fixed | Module is the trust boundary: union capabilities, blame a hint, one re-step then skip, strikes per module |
| R2-04 | 2 | A04, C4 | must-fix | Stagger; view alpha; H9 | One alpha wrong for staggered phases; per-binding stagger multiplies entries and copies | fixed | Stagger by module; per-binding sample-tick stamps; SDK computes interpolation |
| R2-05 | 2 | C5 | must-fix | View prediction; H8; H9 | Prediction plus correction fights host contact | fixed | No prediction; guest publishes a combo transition table the 60 Hz held-melee host applies on input |
| R2-06 | 2 | C6 | should-fix | H9 | Last-good publication vs zero-copy unnamed | fixed | Validate in place, needsUpdate only on success, hide on context loss, clamp scale/shear |
| R2-07 | 2 | A06, C7 | must-fix | H0; H14 | 1,000-call batches below clock resolution; cheap undefined; batch averages hide frame tails; no Rapier timing | fixed | Adaptive ≥ 50 ms batches in ns/op; cheap ≤ 2× direct call; Rapier timing; H14 per-frame samples via isolated page or threshold counts |
| R2-08 | 2 | A05, A07, B4 | should-fix | H0; H14 | Telemetry endpoint refuses calibration; URL unnamed; LPM undetectable | fixed | /calibration/ page, sendNote perf to /api/inbox with ack; LPM unknown/inferred/confirmed; final open for H14 |
| R2-09 | 2 | C8 | should-fix | H13 | Atomic multi-week wave conflicts with no-branches main | fixed | Ports land one by one compiled for v1 and v2; only flip, migration and deletion are one commit set |
| R2-10 | 2 | B5, C9 | must-fix | H17 | No headless world in Node; existing headless runtime ignored | fixed | Extend sdk/headlessRuntime.ts; trace replay V8 vs JSC; save-codec round trip; full world deferred to the MMO plan |
| R2-11 | 2 | C10 | should-fix | Inputs; H4; H8 | Client-claimed atTick stamps; client-side hit events | fixed | Host-written stamps, server receipt tick within ≤ 6-tick window; strike/held-melee hosts sim-side |
| R2-12 | 2 | B6, C11 | should-fix | W13; H6b; H17 | Client-only sources undefined; some projection families are client code; global terrain port | fixed | Enumerated client-only list; families tagged sim/view; owner-host terrain; H17 checks callers |
| R2-13 | 2 | C12 | should-fix | H7; battery 9 | Offline timers undefined; binding ids as table indices | fixed | Timers count sim ticks and pause offline; stable declared binding ids |
| R2-14 | 2 | B1 | should-fix | Design; H6b | Projection count ~2× low | fixed | ~109 calls in 35 files, dependent chains named; H6b 4-6 days |
| R2-15 | 2 | B2 | should-fix | H13 | v0 inventory missing item hooks, lane wiring, client consumer, memory lease | fixed | Added with their fates |
| R2-16 | 2 | B3 | should-fix | H13 | Save migration pointed at the wrong layer | fixed | SimSnapshot adapters, SIM_API_VERSION bump, logical ClientCheckpoint as restart-on-load |
| R2-17 | 2 | B7 | should-add | H0b; H4 | Single-player observation shape would force ABI v3 for an MMO | fixed | Per-player keyed rows with a bounded count |
| R2-18 | 2 | B8-B11 | nit | Order; H12; Why; H13 | H17 unordered; superseded picks incomplete; Pine number wording; 56 files; returnProgram path | fixed | All corrected |
