# SF86 — Codex one-shot baseline, 2026-10-11

**Verdict: FAIL on the exact brief.** The fresh seat delivered an admitted outpost and a working native dusk quest,
but did not implement fleeing goats, a diving hawk, or a commons/equipped spear. Its final answer explicitly calls
the delivery partial. A calm zero-speed creature controller and decorative spear scenery are not substitutes.
This is the baseline before the new authoring docs; it does not close phase 1 or SF86.

## Run and isolation

- Frozen source/docs/SDK: `3032075bb348c2a2cffd5f9f126269cf44b1a7b2`.
- SDK tarball SHA-256: `a7b772658382718de8f32648e8ecee75220c0c55578450a42173e3c10c81555a`.
- Fresh `codex exec` 0.162.1; default model selection; no fork or repository memory. Empty Codex state,
  `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, `project_doc_max_bytes=0`, web search disabled.
- Measured run: 14:29:57–14:47:40 UTC, 1,062.6 s (17.7 min), 65 decisions, exit 0.
  Caps: 7,200 s and 150 decisions. Every tool call and assistant message consumed a decision, so this bound is
  stricter than 150 model turns. No messages, hints, source patches or human help were sent during the run.
- Feature branch `sf86-oneshot-2026-10-11`, worktree `/private/tmp/wildshard-sf86-worktree`, never pushed.
  Execution used its isolated SDK sandbox `/private/tmp/wildshard-sf86-sandbox`; completed files were copied into
  the worktree's `src/shards/oneshot-2026-10-11/` for inspection. The shard remains untracked and is not merged.
- macOS Seatbelt inherited by every descendant refused source contents under the main checkout, feature worktree,
  other temporary exports, personal config/memory, and every other shard folder. Eight explicit probes refused
  main and worktree game/engine/shard files, personal config, and the parent control prompt; allowed docs passed.
  Installed dependencies had **zero external node_modules symlinks**. Only the packed SDK/public declarations,
  third-party dependencies, frozen allowed docs, commons catalogue/assets and the seat's own folder were exposed.
- Direct outbound network was denied. An opaque CONNECT proxy admitted only the Codex/auth API hosts;
  GitHub was refused both directly and through the proxy. Codex's authentication runtime could read its existing
  auth file; no credential contents were copied or committed. The final stderr confirms personal skills were refused.
- Two initial launches failed before any model decision because Codex tried to open shared state. Those zero-turn
  setup failures are excluded from the measured run. A default Homebrew shell/library refusal affected the actual
  run and remains in its friction log. The packed SDK's format dependency was installed locally before the run;
  no baseline SDK implementation was patched.
- Commons catalogue: four actual first-party packs (`arm-clips/aliases`, `bag/starter-items`, `effects/starter`,
  `starter-weapons/bow`). It contained **no spear**. This limits the baseline and is a catalogue gap, not proof
  that all possible commons builders lack spear geometry.

Exact brief (unchanged):

> Mesa Outpost: a dry mesa with a well, two adobe huts, a watchtower with a ladder,
> a goat herd that flees and a hawk that dives, one quest to light the tower beacon at dusk,
> a commons spear, the four entries.

## Scripted grades

Parent checks used the frozen SDK/product after the seat exited; no fixes were applied to its source.

| Gate | Grade | Evidence and scope |
|---|---|---|
| `wildshard build` | PASS | Seat and independent parent execution exit 0; persisted shard.json bytes identical. |
| `wildshard validate` | PASS | Independent exit 0; 240 ticks, all 92 edge lanes, 46,095 real capsule steps. |
| Grid-ready | PASS, native scope | Real GridSimulation/ResidencyAllocator: reserve before physics, admission fence, enter, step, refused save, durable checkpoint, leave/freeze, unload/release and restored re-entry. Tick 30 restored; two loads; no leaked allocations. No browser grid transition was graded. |
| Content gate | PASS, structural scope | Official shardContent: candidate with zero issues; 64 L0 + 16 L1 tiles, 92 hash-admitted files, 40 collider descriptors / 80 shapes and a heightfield; no trusted runtime or opaque private binary. This does not certify completion of the brief. |
| Headless gameplay | FAIL for the full brief | Worker boot and dusk quest pass; the five goats and hawk use zero-speed calm pursuit. Fleeing/diving remain absent. |
| Native replay | PASS, shipped-product scope | Seat's actual quest suffix: 90 exact snapshot/effect ticks. Parent independently compared 60 ticks after the real tower journey, with no reward re-emission. The missing creature behavior has no replay proof. |
| Ledger | PASS, parent grade | Actual journey emits mesa.beacon at tick 860 and five coins. Platform Ledger grants mesa-watchkeeper once; real SaveStore storage survives reconstruction; duplicate fact changes no state; restored worker emits no duplicate. Seat alone could not file the profile reward through a public SDK API. |
| Physics walk | PASS, native scope | Continuous spawn-to-tower drive, no teleport: four waypoints, 857 movement ticks, every waypoint reached, final feet y=20.220 m. Parent uses the ruler's less-than-0.3 m in 120 ticks criterion; 0 stuck. This is a native motor/collider proof, not a browser/phone capture. |
| Report card | PASS | Refusal policy; worst play 754.855 MB / 1,000 MB, load 834.855 MB / 1,800 MB; unique download 2.001 MB. Script p95 25.8 µs, fuel 66,078 / 8,000,000. Values are estimates/Node observations, not device measurements. |
| Engine/game imports | PASS | AST audit of every author/proof module: 0 imports of @wildshard/engine or @wildshard/game. |
| runtime/ lines | PASS | 0 source lines; shard.runtime is null. |
| ShaderMaterial | PASS | 0 constructor uses. |

The independent journey reaches the beacon's declared interaction radius before submitting its declared scene event.
It does **not** prove that the browser's crosshair/LOS/prompt produces that event. Dusk is implemented by an AS
formula matching the declared four-minute day, not a public observation of the rendered day clock. Those limits
remain explicit. Native grid and Ledger checks show platform capabilities exist even though the fresh seat could
not discover/invoke them through its permitted public author interface.

The reproduced product declaration hash is
`dfa8aded405e9d827d25a2d31a7759d1dbfff630bb30271924200afbf24f386a`.
Generated declaration.json is 125,004 bytes / one canonical line; it is not handwritten source and is not merged.

Final seat commands, each exit **0**:

```sh
node_modules/.bin/wildshard build src/shards/oneshot-2026-10-11 src/shards/oneshot-2026-10-11/product
node_modules/.bin/wildshard validate src/shards/oneshot-2026-10-11
```

Parent checks: the same build/validate, seat proof.mjs and walk.mjs, public native worker validation/restore,
real grid residency, official content audit, continuous native tower journey, and platform Ledger filing from that
journey's actual committed fact. Setup/parent-grader failures were corrected only in parent harnesses: one-tick
fact emission had to be observed on both the scene-event tick and the next tick; storage initialization writes had
to be distinguished from the one atomic Ledger document. No acceptance bound or agent source changed.

## Source measurements — not a readability grade

12 source files, 22,163 bytes, 416 lines, maximum file 90 lines, maximum line 120 characters.
Every source file meets the numerical 300-line / 120-column bars. There is one two-line TS config;
authoring/proof modules are MJS plus one AS controller. TypeScript authoring quality and API shape still need
the blind seats; these measurements do not award a B. Raw canonical output is excluded.

| Source file | Bytes | Lines | Longest line | Lines >120 |
|---|---:|---:|---:|---:|
| audit.mjs | 1,823 | 31 | 99 | 0 |
| beacon.as | 1,302 | 33 | 88 | 0 |
| fauna.mjs | 2,978 | 39 | 111 | 0 |
| inspect.mjs | 569 | 10 | 101 | 0 |
| prepare.mjs | 3,155 | 55 | 120 | 0 |
| probe.mjs | 624 | 9 | 94 | 0 |
| proof.mjs | 2,799 | 57 | 100 | 0 |
| quest.mjs | 2,096 | 32 | 106 | 0 |
| settlement.mjs | 4,290 | 90 | 108 | 0 |
| shard.config.ts | 74 | 2 | 45 | 0 |
| terrain.mjs | 626 | 21 | 93 | 0 |
| walk.mjs | 1,827 | 37 | 101 | 0 |

Readability (three blind seats) and phone looks: **WAITING FOR OPUS**, ungraded. No screenshot/board is presented.
The only main-tree result is this summary; raw events, logs, caches, auth state and shard outputs are not committed.

## Proposed plan rows — coordinator to place

| Proposed row | Concrete fix / next-run acceptance |
|---|---|
| OS-F1: public data-host creature owners | Give author-declared herd/diver rows an admitted native owner without game imports or runtime/ code. Prove real goat flight and hawk dive, not merely a valid controller name. Current group/custom port refusals are the largest behavior blocker. |
| OS-F2: commons spear catalogue | Publish an equipped spear with its asset/profile closure, catalogue identity and author example. The next seat must use the commons entry, not decorative local scenery. |
| OS-F3: schema/declaration discovery | Document one stable way to inspect every root/section, identifier/tag grammar, hearing arity and spawn coordinates. Every exported declaration dependency must be available at its documented public path; callers must not probe Valibot internals. |
| OS-F4: typed AS ABI path | Document/directly generate buffer capacities in f64 elements, backing memory, complete effect records, actor bindings and field/event offsets. A public typed example should compile and run without numerical opcode guesses or repeated failed ABI iterations. |
| OS-F5: native director day input | Expose/document the admitted day observation used by client and headless directors. The beacon should read that authority rather than duplicate the rendered clock formula. |
| OS-F6: author-only proof runner | Expose/document grid enter-save-unload-restore and durable Ledger filing from real committed facts through the author workflow. The parent proved both; the fresh seat reported no public API. Keep full gameplay requirements separate from basic admission. |
| OS-F7: scene interaction / view proof | Provide an author-only native/browser test path for creature views and actual scene prompts, including distance/LOS selection. A raw scene event injected into headless is narrower evidence. |
| OS-F8: traversal contract | Document whether ladder traversal is supported and the intended authored collider/traversal rows. This seat used an inclined tread ladder and proved that geometry; it did not prove a vertical ladder mode. |
| OS-F9: enforced brief coverage | Add scripted checks for flight response, dive/attack, equipped commons spear and real beacon interaction. Generic validation/content/replay can admit a reduced outpost while these required behaviors are absent. |
| OS-F10: standalone author setup | Publish the exact install/catalogue/bootstrap path and supported shell/tools for an isolated fresh seat; keep package/declaration closures complete. Use readable TS author generators in the reference workflow. |

These are proposals, not newly closed/open plan rows. Thirty-seven original friction bullets follow without deleting
failed guesses. Sixteen tool commands failed during the measured run; the tenth numbered build attempt succeeded.

## Fresh seat's friction log

- Initial documentation command failed before reading: default Homebrew bash requires blocked readline dylib.
  Workaround: use /bin/sh with login disabled.
- Combined documentation read exceeded output limits. Workaround: read focused sections separately; no missing content
  assumed.
- Public declaration lookup for format/creatures.d.ts failed: no such file. Followed the public shardfile schema
  declaration instead.
- Guessed the public Valibot ShardfileSchema exposes entries directly; inspection failed. Inspecting its public pipe
  representation to locate the defining schema.
- Catalogue lookup found no spear: installed commons catalogue has only arm aliases, bag items, effects and bow. A
  commons spear cannot be claimed from those bytes; keep this brief gap explicit.
- Second attempt to unwrap ShardfileSchema also failed: it is not an inspectable strict-object root. Workaround: SDK
  formatJsonSchemas() gives defining section schemas.
- Python emitted blocked xcrun cache errors although the edit succeeded. Subsequent edits use Node or shell.
- Declaration glob game/shardfile/script* and engine/script/abi.d.ts do not exist. Used the declarations referenced by
  the public headless/script contracts.
- generateDirectorAbi guessed input {version,inputs,events} was rejected. Supplying the complete documented Director
  row succeeded and exposed clock/event accessor offsets.
- Guesses pending proof: numeric script effect 5 encodes field/value in a/b; numeric event offsets match generated
  director ABI; buffer caps are counts. Quest uses engine tick and the same declared day cycle; no direct public day
  observation was found.
- Guesses pending proof: herd hearing triple [10,16,24], non-stallion goats flee, default creature views resolve
  goat/hawk without explicit looks. Native recipe availability must be tested, not inferred from schema acceptance.
- Workaround for missing commons spear: local rack spear scenery only. No equipped or commons spear is claimed.
- Ladder uses shallow sloped rung/tread geometry because no ladder traversal declaration was found in permitted
  documentation. Traversability remains unproven until a physics walk.
- Build 1 failed (exit 1): state name beaconLit violates lowercase identifier grammar. Changed to beacon-lit.
- Build 2 failed (exit 1): custom type rejects hawk. Public StrikeSchema shows namespaced tags; changed strike tag
  hawk to animal.hawk. Initial suspicion about species kind was not confirmed.
- Guessed declaration paths engine/creatures/species.d.ts and format/species.d.ts failed; Species SDK declaration
  references engine/ai/species instead. No source read.
- Build 3 failed (exit 1): hearing needs four entries; spawn is x/y/z, not at tuple. Full parseShardfile issue paths
  exposed both. Corrected hearing to [10,16,24,30] (tuning guess) and spawn to object coordinates.
- Build 4 failed (exit 1): Missing declared group port. The default installed data host does not supply the herd
  recipe despite accepting its schema. Native availability remains an actual blocker; inspecting the public custom
  brain alternative.
- Custom-brain probe failed (exit 1): Missing custom brain port. Default data host lacks this alternative too.
- Unimplemented native behavior remains explicit: active product will keep the goat/hawk roster with null controllers.
  Requested herd/diver tuning is retained in fauna.mjs as candidate data; it will not be claimed as running. This
  removes unsupported declarations, not validator checks.
- rg --files did not enumerate packaged public declarations even with -L. Workaround: ls named declaration directories
  and read only the needed public type dependencies.
- Build 5 failed (exit 1): exactly one declared creature controller. Null brains alone are not a valid static roster.
  Testing the platform's built-in pursue controller with zero awareness and calm wandering; fleeing/diving still not
  claimed.
- Build 6 failed (exit 1): Script actor binding does not match host identity. Guessed actorId player was wrong.
  Changed shared-state server binding to actorId null, as the public schema permits; next proof must verify scene
  delivery.
- Build 7 failed (exit 1): Invalid/overlapping ABI regions. Earlier guess that capacities are counts was wrong; trying
  byte capacities 8192 input / 4096 output in disjoint 16K/32K buffers. Permitted docs publish signatures but do not
  explain these capacity units.
- Build 8 failed (exit 1): ABI buffer outside memory. Constants alone do not reserve an initial memory page.
  Workaround: AssemblyScript memory.data() reserves real static input/output buffers, with the same relative event
  layout.
- Build 9 failed (exit 1): ABI buffer outside memory also with reserved buffers. Byte-capacity inference was not
  proven and is retracted. Testing f64-element capacities (512 input, 40 output = eight complete five-value effect
  records); allocated storage is 4096/320 bytes.

- The separate SDK documentation read also exceeded output limits; focused sections were used afterward.
- Public declaration lookup engine/kit/skin.d.ts failed. No visual rig behavior is claimed from that lookup.
- Build 10 succeeded (exit 0): f64-element capacities and complete effect records were accepted.
  Numeric field/event assumptions are now proven by before-dusk rejection and dusk completion tests.
- Native herd and custom-brain ports remain unavailable. The final generic controller keeps animals idle
  (speed zero); requested fleeing and diving are unimplemented, and product guide text says so by describing rest.
- The headless fact and five-coin reward emit once and do not repeat across restore and replay.
  The ledger mapping parses, but actual profile achievement filing is unproven: the installed SDK exports
  no public ledger filing API. Headless fact emission is not a full profile-ledger proof.
- No public GridSimulation export is present in the installed SDK export map or SDK API catalogue.
  Four midpoint entries and budget/closure admission are proven; a live grid transition witness remains unproven.
- No browser rendering witness was available through the permitted public author interface. Creature view
  resolution and prompt interaction in a browser are not claimed from headless event injection.
- Canonical declaration JSON, immutable assets, copied client and logs are generated build/evidence artifacts.
  Authoring modules are checked separately for the 300-line / 120-column readability bar.
- The first source audit failed (exit 1): its forbidden-material regex matched its own literal.
  Changed the audit to construct the search token from parts, keeping the same ban on actual source usage.
- Authoring choices where the brief supplied no numbers: mesa top radius 70 m / height 12 m,
  90 m smooth perimeter descent, huts about 7 by 6 m, tower deck at 20.2 m, and five goats.
  Dusk is day fraction 0.75 through 0.84 on a four-minute cycle starting at 0.72.
  These are design assumptions, not facts about an existing shard.
- Final proof.mjs and walk.mjs runs both exit 0. Content audit exits 0. Full profile ledger and
  live grid transition gates remain open even though ordinary CLI admission passes.
