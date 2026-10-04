# SHARD-PLATFORM council: the register

Every finding, with a stable ID. Status: `fixed` + commit · `rejected` + reason · `settled` · `parked` · `escalated`.

| ID | Round | Seat | Severity | Location | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| R1-A1 | 1 | A | must-fix | SF1 | Expanding the row walk conflicts with shrink-only in the same row | fixed (round-1 commit) | SF1a bootstraps the expanded inventory with provenance, then SF1b |
| R1-A2 | 1 | A | must-fix | SF1, SF2, §9 | "Compare against HEAD" has no working historical gate | fixed (round-1 commit) | SF1b: explicit baseline/candidate files, pre-commit index vs HEAD, push gate exports the predecessor |
| R1-A3 | 1 | A | must-fix | SF1, SF51 | The runtime/ ban removes Thin Ice's exception | fixed (round-1 commit) | SF1c allowlist (six + template + Thin Ice) |
| R1-A4 | 1 | A | should-fix | §1, SF6 | Public-SDK share has no unit or denominator | fixed (round-1 commit) | §1 exact formula; SF6 fixtures |
| R1-A5 | 1 | A | should-fix | F1, §5 | M1 template and outside-author scope unspecified | fixed (round-1 commit) | §4.1 inventory; SF16 names the battery shard |
| R1-A6 | 1 | A | should-fix | SF5, SF11, SF16 | Cold replay is weaker than snapshot → restore → replay | fixed (round-1 commit) | SF4c |
| R1-A7 | 1 | A | should-fix | SF7, SF11, SF33 | State contract doesn't separate player and shared state | fixed (round-1 commit) | SF7a actor-scoped state; SF11c two-actor test |
| R1-A8 | 1 | A | must-fix | SF8, SF11, SF15 | Build-time fuel isn't admission enforcement | fixed (round-1 commit) | SF11a admission refuses forged unmetered modules |
| R1-A9 | 1 | A | should-fix | SF11, SF13, L | Per-script caps don't bound aggregate or induced host work | fixed (round-1 commit) | SF11b per-shard allowances + metered queries |
| R1-A10 | 1 | A | should-fix | SF11, SF14, SF15 | Quarantine leaves player outcome and mutation semantics open | fixed (round-1 commit) | SF11b atomic effects, NaN rejection, freeze + dev toast |
| R1-A11 | 1 | A | should-fix | SF14, SF20 | Ledger rules undefined; travel wallet replacement missing | fixed (round-1 commit) | SF14 fact ids + atomic write; SF20a wallet rules |
| R1-A12 | 1 | A | should-fix | SF7–9, SF18, SF22, SF46 | "At the caps" has no numbers; Pine Hollow target missing | fixed (round-1 commit) | §3.2 caps v0; SF47 targets |
| R1-A13 | 1 | A | should-fix | SF7, SF9, SF17, SF18, SF22 | No safe traversal during a stall | fixed (round-1 commit) | SF18d traversal safety |
| R1-A14 | 1 | A | should-fix | SF7, SF15, SF18, C | Render residency and sim lifetime not separated | fixed (round-1 commit) | SF18a sim residency per shard |
| R1-A15 | 1 | A | must-fix | §0, C, §6 | 80/20 can be declared while gameplay stays browser-only | fixed (round-1 commit) | §1 transitional flag + per-shard compatibility checks |
| R1-A16 | 1 | A | should-fix | SF7, SF15, SF43, G29 | Support window has no runtime mechanism | fixed (round-1 commit) | §3.4 versioning; SF15a N and N−1 |
| R1-A17 | 1 | A | should-fix | SF21, SF8 | DEVSERVER undefined; live dev-mode removal undefined | fixed (round-1 commit) | §0 DEVSERVER; §3.3 applies at next assembly |
| R1-A18 | 1 | A | should-fix | SF23, G38 | Whole-grid proxies at login conflict with bounded far view | fixed (round-1 commit) | SF18b / SF23 bounded rings |
| R1-B1 | 1 | B | must-fix | G32, SP3, SP4, SF1 | Stale row ids steer committed files; WebGPU spike dropped | fixed (round-1 commit) | SF1e renames; SF37 restores the WebGPU spike |
| R1-B2 | 1 | B | must-fix | F1, SP3 | No row turns function-valued rows into data | fixed (round-1 commit) | SF7c |
| R1-B3 | 1 | B | must-fix | SF16, SF10 | Template parts inexpressible at M1 | fixed (round-1 commit) | §4.1 + SF7e, SF7f, SF10b |
| R1-B4 | 1 | B | must-fix | SF7, SF8, SF15 | No project layout or repo build for shardfiles | fixed (round-1 commit) | §3.5 + SF7b |
| R1-B5 | 1 | B | must-fix | §1, SF6 | Measure and script define runtime differently; AS counts as custom | fixed (round-1 commit) | §1 formula; AS counts public |
| R1-B6 | 1 | B | must-fix | F1, C | No hybrid loader for converted shards; placement still in manifests | fixed (round-1 commit) | SF15b + §3.3 grid file |
| R1-B7 | 1 | B | must-fix | SF17, SF21 | No grid placement for the three shards | fixed (round-1 commit) | §3.3 3 × 3 layout (G49) |
| R1-B8 | 1 | B | must-fix | SF5, SF11, SF16, SF30 | Rapier SIMD isn't cross-platform deterministic | settled | settled by G48 (bounded-lite: cross-engine physics identity out) |
| R1-B9 | 1 | B | must-fix | SF3, SF4 | three.js maths call host trig | settled | settled by G48 (three trig out of the requirement); motor uses its own module (SF4d) |
| R1-B10 | 1 | B | must-fix | SF45, SF49 | Driftwood's edge entries lost their owner | fixed (round-1 commit) | SF46 owns them; SF49 Sky Reach |
| R1-B11 | 1 | B | must-fix | SF21 vs T1, NINE-DRAGON | G46 contradicts T1 and another plan | fixed (round-1 commit) | T1 updated; §7 notes the Nine Dragon owner |
| R1-B12 | 1 | B | must-fix | SF1 vs T4, THIN-ICE | SF1 would refuse Thin Ice | fixed (round-1 commit) | SF1c allowlist; §7 notes the Thin Ice owner |
| R1-B13 | 1 | B | must-fix | SF7, SF18, SF22, SF46 | No budget cap has a number | fixed (round-1 commit) | §3.2 caps v0 |
| R1-B14 | 1 | B | should-fix | L, SDK, C | 28 rows without done-when or size | fixed (round-1 commit) | every L / SDK / C row has done-when, size, consumer |
| R1-B15 | 1 | B | should-fix | SF6 | Share unit missing; SDK absent in F0 | fixed (round-1 commit) | §1: prints 0 % until SF8b |
| R1-B16 | 1 | B | should-fix | SF6, §1 | No mechanism stops kit relocation lowering the share | fixed (round-1 commit) | §1 kit attribution |
| R1-B17 | 1 | B | should-fix | SF8 | SDK layer and distribution undefined | fixed (round-1 commit) | §3.5 + SF8b |
| R1-B18 | 1 | B | should-fix | SF8, SF37 | Repo bans vite dev servers | fixed (round-1 commit) | §3.5 rebuild-and-serve |
| R1-B19 | 1 | B | should-fix | SF7, SF15, SF43 | Two version numbers, no window rule | fixed (round-1 commit) | §3.4 |
| R1-B20 | 1 | B | should-fix | §7 | ARCH-GUARDS archived | fixed (round-1 commit) | §2, §7: this plan owns the guards |
| R1-B21 | 1 | B | should-fix | SF1 | ShardManifest adds ~30 fields to a shrink-only list | fixed (round-1 commit) | SF1a re-baseline once |
| R1-B22 | 1 | B | should-fix | SF4 | Maths library not chosen; sim folders miss shard code | fixed (round-1 commit) | G48 narrows to the motor (SF4d); SF3a lists sim folders incl. behaviour/ |
| R1-B23 | 1 | B | should-fix | SF20 | Border and inventory rules incomplete | fixed (round-1 commit) | SF20a, SF20d |
| R1-B24 | 1 | B | should-fix | SF7 | Format lacks fields for compatibility decisions | fixed (round-1 commit) | SF7a field list |
| R1-B25 | 1 | B | should-fix | §10 → §4 | Answers mapped to no row | fixed (round-1 commit) | §0 out-of-scope list; G34 noted |
| R1-B26 | 1 | B | should-fix | SF15, SF18 | Offline boot dropped | fixed (round-1 commit) | SF15a offline gate; SF18c cache |
| R1-B27 | 1 | B | should-fix | SF9, SF17, SF19 | Done-whens with no measure | fixed (round-1 commit) | SF9b parity script; SF17b seam metrics; boards |
| R1-B28 | 1 | B | should-fix | SF23 | Done-when breaks unbounded rule | fixed (round-1 commit) | SF23 bounded rings |
| R1-B29 | 1 | B | should-fix | SF45 | Driftwood "already baked" overclaims | fixed (round-1 commit) | SF46 notes V-B1 open |
| R1-B30 | 1 | B | should-fix | §7 | Overlapping live plans missing | fixed (round-1 commit) | §7 lists them |
| R1-B31 | 1 | B | should-fix | MMO-REQ | Requirements doc contradicts itself | fixed (round-1 commit) | §7 O3–O5, O7 decided/superseded; §4, T3, W7a fixed; §3.9 O4/O5 restored |
| R1-B32 | 1 | B | should-fix | SF40 | Outside author lacks the judge; Jev undefined | fixed (round-1 commit) | SF41 Opus alone or Clef locally; Jev defined |
| R1-B33 | 1 | B | should-fix | SF21 | DEVSERVER undefined | fixed (round-1 commit) | §0 |
| R1-B34 | 1 | B | should-fix | SF11 | Player-visible misbehaviour undefined | fixed (round-1 commit) | SF11b |
| R1-B35 | 1 | B | should-fix | SF8 | Validation skips binary assets | fixed (round-1 commit) | SF8a asset parsers |
| R1-B36 | 1 | B | should-fix | §3, SDK lane | SDK lane timing contradiction | fixed (round-1 commit) | SDK lane from M1 |
| R1-B37 | 1 | B | should-add | SF8, G19 | Deterministic builds | fixed (round-1 commit) | SF8a byte-identical builds |
| R1-B38 | 1 | B | should-add | SF16 | Pre-register expected gaps | fixed (round-1 commit) | SF16 |
| R1-B39 | 1 | B | nit | SP1–SP5 | "(this commit)" unresolvable | fixed (round-1 commit) | SHAs filled in |
| R1-B40 | 1 | B | nit | SP4 | Stale @wildshard/engine/data path | fixed (round-1 commit) | fixed |
| R1-B41 | 1 | B | nit | throughout | Slugs differ from names | fixed (round-1 commit) | §0 gives the slugs |
| R1-B42 | 1 | B | nit | SF47 | Nalati has two bosses | fixed (round-1 commit) | SF48 says two |
| R1-B43 | 1 | B | nit | §2 | 42,949 figure compares JSC with Wasm libm | fixed (round-1 commit) | §2 reworded |
| R1-B44 | 1 | B | nit | SF17 | Signposts drop rating | fixed (round-1 commit) | SF17c "rating later" |
| R1-B45 | 1 | B | nit | §9, COUNCIL.md | Cap lift not in COUNCIL.md | fixed (round-1 commit) | COUNCIL.md exception line |
| R1-B46 | 1 | B | nit | SF22 | 2× render scale unstated | fixed (round-1 commit) | SF22 says 2× |
| R1-C1 | 1 | C | must-fix | SF15, SF16 | M1 can't pass: template trusted surfaces unreplaced | fixed (round-1 commit) | §4.1 + SF7e, SF7f, SF10b |
| R1-C2 | 1 | C | must-fix | SP3, F1 | Nobody owns the 45 function fields | fixed (round-1 commit) | SF7c + owner rows |
| R1-C3 | 1 | C | must-fix | SF4, SF5, SF11 | Determinism rows leave out physics | settled | settled by G48 |
| R1-C4 | 1 | C | must-fix | SF18, SF5 | Render streaming would make the sim non-deterministic | fixed (round-1 commit) | SF18a sim residency whole, fixed order |
| R1-C5 | 1 | C | must-fix | SF17, SF18, SF20 | Grid offsets break bit identity | fixed (round-1 commit) | §3.1(d) local frame; SF18a test at cell (1, 0) |
| R1-C6 | 1 | C | must-fix | SF7, SF8, SF9, SF22 | Caps never set | fixed (round-1 commit) | §3.2 |
| R1-C7 | 1 | C | must-fix | SF21, §5 | Grid would ship before the phone gate | fixed (round-1 commit) | §3.3 Debug row default-off; SF21b |
| R1-C8 | 1 | C | must-fix | §5, SF8 | F1 order makes SF8 impossible | fixed (round-1 commit) | SF8a / SF8c split |
| R1-C9 | 1 | C | must-fix | SP4, SF45, SF49, lint | Stale ids hide Driftwood's edge work | fixed (round-1 commit) | SF1e; SF46 |
| R1-C10 | 1 | C | should-fix | SF8, SF16 | SDK distribution undefined; Rust injector | fixed (round-1 commit) | §3.5 tarballs + JS-only toolchain |
| R1-C11 | 1 | C | should-fix | SF7, SF11, SF25 | Shared state is opaque | fixed (round-1 commit) | SF7a host-owned declared fields |
| R1-C12 | 1 | C | should-fix | SF11, SF27 | ABI v1 push-only | fixed (round-1 commit) | SF11b read-only host queries in v1 |
| R1-C13 | 1 | C | should-fix | SF11 | Instance granularity and caps unspecified | fixed (round-1 commit) | SF11b |
| R1-C14 | 1 | C | should-fix | SF18, SF20 | Which sims tick on the grid | fixed (round-1 commit) | SF18a neighbours frozen |
| R1-C15 | 1 | C | should-fix | SF17, SF21 | Empty cells and layout undefined | fixed (round-1 commit) | §3.3 (3 × 3, no empty cells; outer empty-neighbour profile) |
| R1-C16 | 1 | C | should-fix | §3, SF21, C | M2 gated on unschedulable conversions | fixed (round-1 commit) | §0 grid-ready |
| R1-C17 | 1 | C | should-fix | SF20 | SF20 depends on later rows (car, auto-path) | fixed (round-1 commit) | SF20b car; SF20c auto-path |
| R1-C18 | 1 | C | should-fix | L, SDK, §6 | Scope explosion: rows with no exit | fixed (round-1 commit) | consumers + done-when per row |
| R1-C19 | 1 | C | should-fix | SF3, SF5, SF11, SF20 | Secretly huge rows | fixed (round-1 commit) | split: SF3a–c, SF5a–c, SF11a–c, SF20a–d |
| R1-C20 | 1 | C | should-fix | §1, SF6 | Public-SDK share formula | fixed (round-1 commit) | §1 |
| R1-C21 | 1 | C | should-fix | SF46 | Pine Hollow fix is a guess | fixed (round-1 commit) | SF47 gpuTrace first |
| R1-C22 | 1 | C | should-fix | SF10, SF47 | Nalati has no family | fixed (round-1 commit) | SF10a painterly family |
| R1-C23 | 1 | C | should-fix | SF21 | DEVSERVER undefined; live toggle | fixed (round-1 commit) | §0, §3.3 |
| R1-C24 | 1 | C | should-fix | SF7, SF43 | API versioning in the client undefined | fixed (round-1 commit) | §3.4 |
| R1-C25 | 1 | C | should-fix | SF11, SF14 | Hostile-script outcome and fact ids | fixed (round-1 commit) | SF11b; SF14 |
| R1-C26 | 1 | C | should-fix | C | No save migration for players | fixed (round-1 commit) | C lane rule |
| R1-C27 | 1 | C | should-fix | C | Legacy path as Debug variant | fixed (round-1 commit) | C lane rule |
| R1-C28 | 1 | C | should-fix | MMO-REQ | Requirements contradict decisions | fixed (round-1 commit) | see R1-B31 |
| R1-C29 | 1 | C | should-fix | SF5, SF7 | Sim time contract not in the format | fixed (round-1 commit) | SF7a sim contract |
| R1-C30 | 1 | C | should-add | §0 | Name the headless sim artifact | fixed (round-1 commit) | SF4a @wildshard/engine/sim |
| R1-C31 | 1 | C | should-add | §5, SF22 | Measure the crossroads before the format | fixed (round-1 commit) | SF22a |
| R1-C32 | 1 | C | should-add | SF3, SF11, SF25 | Sim lane in a Worker in dev/test | parked | parked: revisit after M1 if lint misses a leak |
| R1-C33 | 1 | C | should-add | SF7 | Reserve commons references | fixed (round-1 commit) | SF7a |
| R1-C34 | 1 | C | should-add | SF8 | Validate memory per location | fixed (round-1 commit) | §3.2, SF8a worst disc |
| R1-C35 | 1 | C | should-add | SF18 | Persistent tile cache | fixed (round-1 commit) | SF18c |
| R1-C36 | 1 | C | nit | SF7 | 250 m level has no consumer | fixed (round-1 commit) | dropped |
| R1-C37 | 1 | C | nit | §1 | "A fresh author built a shard" not computable | fixed (round-1 commit) | gap-log boolean |
| R1-C38 | 1 | C | nit | C, §6 | Archive point unclear | fixed (round-1 commit) | archives at 80/20 |
| R1-C39 | 1 | C | nit | SF17 | Origin rebasing | fixed (round-1 commit) | §3.3 |

Round 1 (2026-10-04): 103 findings (must-fix 27, should-fix 56, should-add 8, nit 12); 99 fixed, 3 settled by G48, 1 parked.

| R2-A1 | 2 | A | must-fix | SF7b, §5 | SF7b needs the CLI, SDK and grid file before they exist | fixed (round-2 commit) | SF7b layout + grid catalogue; SF8d build integration later |
| R2-A2 | 2 | A | must-fix | SF15b | Hybrid loader proof needs post-M1 Driftwood | fixed (round-2 commit) | SF15b moved into SF46 (fixture first) |
| R2-A3 | 2 | A | must-fix | §4.1, SF16 | Template elite and boss unowned | fixed (round-2 commit) | SF13b; §4.1 complete |
| R2-A4 | 2 | A | should-fix | §3.1, SF11 | Script cross-engine check lost its owner | fixed (round-2 commit) | SF11c conformance gate |
| R2-A5 | 2 | A | should-fix | SF7c | "0 for the template" not expressible | fixed (round-2 commit) | SF7c data-only schema check; global ratchet stays |
| R2-A6 | 2 | A | must-fix | SF18a | Collider metadata keyed by per-world handles | fixed (round-2 commit) | SF18a world-scoped metadata + fixture |
| R2-A7 | 2 | A | should-fix | §3.3, SF14 | No placement instance in fact ids | fixed (round-2 commit) | SF14 placement instance id |
| R2-A8 | 2 | A | should-fix | §3.2 | Validator counts part of the working set | fixed (round-2 commit) | §3.2 one cost model |
| R2-A9 | 2 | A | should-fix | SF18d, SF22 | Readiness distance omits transfer time | fixed (round-2 commit) | SF18d formula + critical bundle cap + soft wall |
| R2-A10 | 2 | A | must-fix | SF50, S5 | Signal Dunes shader fallback breaks grid-ready | fixed (round-2 commit) | SF10a acceptance includes Signal Dunes; SF50 adapter must pass the gate |
| R2-A11 | 2 | A | should-fix | §3.4, S18 | No Part A upgrade path | fixed (round-2 commit) | §3.4 one-commit bump + manual steps |
| R2-C1 | 2 | C | must-fix | §4.1, SF7d, SF16 | Template boss, elite, audio unowned before M1 | fixed (round-2 commit) | SF13b, SF29a, SF7f, SF7h; §4.1 complete |
| R2-C2 | 2 | C | must-fix | SF15b | SF15b on M1 path needs Driftwood | fixed (round-2 commit) | moved into SF46 |
| R2-C3 | 2 | C | must-fix | SF20a | SF20a deletes the Select a shard path | fixed (round-2 commit) | travel.ts stays for Select a shard and explore |
| R2-C4 | 2 | C | must-fix | SF22a, §3.2 | Memory measured on the Simulator only, then frozen | fixed (round-2 commit) | SF22a instruments + Jake's physical rig reading before v1 freeze |
| R2-C5 | 2 | C | must-fix | §5, SF46–48 | Grid-ready not separated from 80/20 | fixed (round-2 commit) | -g / -p split; M2 needs the -g parts |
| R2-C6 | 2 | C | must-fix | SF18d, SF22 | 30 m/s gates need a vehicle | fixed (round-2 commit) | G60: hoverboard 30 m/s on the highway |
| R2-C7 | 2 | C | should-fix | §3.3, SF21a | Select a shard "unchanged" exposes Nine Dragon; explore has two homes | fixed (round-2 commit) | §3.3 mode table; Nine Dragon at (+1, −1), Debug toggle |
| R2-C8 | 2 | C | should-fix | SF21a | iOS memory kill reloads into the grid | fixed (round-2 commit) | SF21a unexpected-end → title |
| R2-C9 | 2 | C | should-fix | SF3a, SF4a | Template sim invisible to SF3a; SF4a too early | fixed (round-2 commit) | SF3a walks template sim files; SF4a after SF3c |
| R2-C10 | 2 | C | should-fix | S1, S4, S8 | Stretch goals hold capabilities used today | fixed (round-2 commit) | swim → SF34, stems → SF29, far herd → SF27, crowd → SF25 |
| R2-C11 | 2 | C | should-fix | SF7a, SF9b | No skinned assets in the format | fixed (round-2 commit) | SF9c |
| R2-C12 | 2 | C | should-fix | §10, MMO-REQ §5 | Changed answers unmarked | fixed (round-2 commit) | narrowed-by notes; MMO-REQ §5 aligned |
| R2-C13 | 2 | C | should-fix | SF7b vs SF17a | Grid file read before it exists | fixed (round-2 commit) | SF7b creates the catalogue |
| R2-C14 | 2 | C | should-fix | §3.3, SF14, SF33 | Template instance saves have no owner | fixed (round-2 commit) | SF33 instance key; SF14 instance id |
| R2-C15 | 2 | C | should-fix | SF18a, SF20a | Player world and frame across a border unspecified | fixed (round-2 commit) | SF18a names it |
| R2-C16 | 2 | C | should-fix | §3.3 | EXPERIMENTAL label covers grid only, not shared code | fixed (round-2 commit) | §3.3 + SF18a: grid paths only inside EXPERIMENTAL |
| R2-C17 | 2 | C | nit | SF24, SF30, SF51, SF26 | "Used today by" wrong in places | fixed (round-2 commit) | corrected |
| R2-C18 | 2 | C | nit | SF23 | Impostors have no consumer in 3 × 3 | fixed (round-2 commit) | moved to S6b |
| R2-C19 | 2 | C | nit | §7, Handoff | Stale refs | fixed (round-2 commit) | fixed |
| R2-C20 | 2 | C | nit | SF22a, SF22 | Measurement is Codex tooling | fixed (round-2 commit) | SF22a X+O |
| R2-D1 | 2 | D | must-fix | §5, SF7b, SF15b | F1 order needs downstream work | fixed (round-2 commit) | see R2-A1, R2-A2 |
| R2-D2 | 2 | D | should-fix | SF4c | Full snapshot gate precedes its components | fixed (round-2 commit) | SF4c interface + fixture; SF16a full test |
| R2-D3 | 2 | D | must-fix | §4.1 | Template slices incomplete (boss, audio, meter, bag) | fixed (round-2 commit) | see R2-C1 |
| R2-D4 | 2 | D | must-fix | §4.1, SF1d | JumpCourse at y ≈ 3000 violates cell bounds | fixed (round-2 commit) | moved inside the cell |
| R2-D5 | 2 | D | must-fix | §3.2, SF22a | Admission omits resident allocations | fixed (round-2 commit) | see R2-A8; SF22a fills every category |
| R2-D6 | 2 | D | must-fix | SF47 | gpuTrace gives counts, not bytes; MiB ratchet | fixed (round-2 commit) | SF47 uses glbytes + native footprint |
| R2-D7 | 2 | D | must-fix | SF14 | Template instances collide in fact ids | fixed (round-2 commit) | see R2-A7 |
| R2-D8 | 2 | D | must-fix | SF20a | Deleting travel.ts breaks the single-shard flow | fixed (round-2 commit) | see R2-C3 |
| R2-D9 | 2 | D | must-fix | SF7c | Checker can't express the done-when | fixed (round-2 commit) | see R2-A5 |
| R2-D10 | 2 | D | should-fix | SF16, §3.4, MMO-REQ | M1 vs S19 and upgrade contradictions | fixed (round-2 commit) | see R2-A11, R2-C12 |
| R2-D11 | 2 | D | should-fix | SF34, S4 | Swim classified as new | fixed (round-2 commit) | see R2-C10 |
| R2-D12 | 2 | D | should-fix | §3.3 | Nine Dragon cell unnamed | fixed (round-2 commit) | see R2-C7 |

Round 2 (2026-10-04): 43 findings (must-fix 19, should-fix 20, nit 4); all fixed. Must-fix fell 27 → 19 (many duplicates across seats), should-fix 56 → 20.

| R3-A1 | 3 | A | must-fix | §5, F1 | Wave-1 acceptance needs the host and loader | fixed (round-3 commit) | §5 reordered: SF8a → SF15a-min → SF11a → SF11b; rows proved on fixtures, template at SF16 |
| R3-A2 | 3 | A | must-fix | SF17a, SF20a | Template ±100 m bounds respawn at grid edges | fixed (round-3 commit) | SF17a legacy bounds yield to the cell in grid mode |
| R3-A3 | 3 | A | should-fix | SF33, SF18a | Instance saves have no dependency | fixed (round-3 commit) | SF33a right after M1, before F2 |
| R3-A4 | 3 | A | should-fix | §3.3, §6, SF22 | Two different physical readings named | fixed (round-3 commit) | one reading (SF22a); §3.3, §6, SF18a aligned |
| R3-A5 | 3 | A | should-fix | §4.1 | Template door unmapped | fixed (round-3 commit) | §4.1 door line; SF16 tests it |
| R3-A6 | 3 | A | should-fix | SF22a, SF47 | glbytes gives no labelled breakdown | fixed (round-3 commit) | SF22b labelled GL bytes |
| R3-D1 | 3 | D | should-fix | SF9c | Procedural rigs and clips undefined | fixed (round-3 commit) | SF9c build-time export + clips or pose bindings + video |
| R3-D2 | 3 | D | should-fix | SF22a, SF47 | glbytes attribution | fixed (round-3 commit) | SF22b |
| R3-D3 | 3 | D | should-fix | §3.2, SF18d | Critical bundle has no cap | fixed (round-3 commit) | §3.2: ≤ 2 MB wire |
| R3-D4 | 3 | D | should-fix | SF18a | Physics baseline never enters the grid | fixed (round-3 commit) | SF18a grid-mode harness with seam routes |
| R3-D5 | 3 | D | should-fix | SF14, SF33 | Standalone vs grid identities | fixed (round-3 commit) | canonical placement instance (home cell; template solo) |
| R3-C1 | 3 | C | must-fix | SF3a, SF3c, SF4a | F0 can't finish in F0 | fixed (round-3 commit) | template sites owned by F1 rows; SF3c engine + kit; SF4a engine test level |
| R3-C2 | 3 | C | must-fix | §5, F1 | F1 order can't run | fixed (round-3 commit) | see R3-A1; "no template chunk" at SF16 |
| R3-C3 | 3 | C | must-fix | SF18a | Motor can't query two worlds | fixed (round-3 commit) | capsule in the current frame's world; deck + strip colliders duplicated into adjacent shard worlds |
| R3-C4 | 3 | C | must-fix | SF46, M2 | Several runtime/ chunks in one page undefined | fixed (round-3 commit) | runtime hooks only while inside the cell; scope swap at crossing; fixture |
| R3-C5 | 3 | C | must-fix | SF21a | iOS-kill recovery relies on sessionStorage | fixed (round-3 commit) | grid boots only from a one-shot tap intent; AliveInfo mode |
| R3-C6 | 3 | C | must-fix | §4.1, SF14 | Water bodies and feats have no row | fixed (round-3 commit) | SF9d; feats via SF14 facts; §4.1 lines |
| R3-C7 | 3 | C | should-fix | SF27 | farHerd is draw batching, not a brain LOD | fixed (round-3 commit) | removed from SF27; Nalati horses via SF9b in SF48 |
| R3-C8 | 3 | C | should-fix | SF22a, SF47 | glbytes can't order by MB saved | fixed (round-3 commit) | SF22b |
| R3-C9 | 3 | C | should-fix | SF22, §6, §3.3 | Phone readings disagree | fixed (round-3 commit) | see R3-A4 |
| R3-C10 | 3 | C | should-fix | §0, §3.3 | DEVSERVER can't be detected | fixed (round-3 commit) | __DEVSERVER__ build define; gate asserts false in prod; Nine Dragon on by default there |
| R3-C11 | 3 | C | should-fix | §3.3, SF21a | "Lists" ambiguous | fixed (round-3 commit) | enters vs shows; today's visibility kept |
| R3-C12 | 3 | C | should-fix | SF14, SF33 | No instance for the single-shard flow | fixed (round-3 commit) | see R3-D5 |
| R3-C13 | 3 | C | should-fix | SF18d, §3.2 | Critical bundle has no number | fixed (round-3 commit) | see R3-D3 |
| R3-C14 | 3 | C | should-fix | §3.2, SF8a | validate's neighbours unspecified | fixed (round-3 commit) | three neighbours at caps + commons once |
| R3-C15 | 3 | C | should-fix | SF9c, SF7c | Exemplars are procedural | fixed (round-3 commit) | see R3-D1; SpeciesLook baked |
| R3-C16 | 3 | C | should-fix | State, Handoff | Plan state stale; uncommitted WIP unrecorded | fixed (round-3 commit) | State, rows and Handoff updated |
| R3-C17 | 3 | C | should-fix | SF30, SF49 | Movers list wrong | fixed (round-3 commit) | Driftwood boat added; hover decks to SF34 |
| R3-C18 | 3 | C | should-add | SF17b | Strip generator in the headless sim | fixed (round-3 commit) | SF17b pure function under @wildshard/engine/sim |
| R3-C19 | 3 | C | nit | SF1e | Stale mapping | fixed (round-3 commit) | fixed |
| R3-C20 | 3 | C | nit | SF23 | Sightline ≈ 2.4 km | fixed (round-3 commit) | fixed |
| R3-C21 | 3 | C | nit | §5 | "freezes" vs v0 | fixed (round-3 commit) | fixed |
| R3-C22 | 3 | C | nit | MMO-REQ A6 | A6 still says first proof | fixed (round-3 commit) | note added |
| R3-C23 | 3 | C | nit | SF18a | surface.ts comment false | fixed (round-3 commit) | SF18a corrects it |
| R3-C24 | 3 | C | nit | SF20d | Where 30 m/s ends | fixed (round-3 commit) | eases across the strip |
| R3-C25 | 3 | C | nit | SF15a, §3.4 | N−1 over-specified | fixed (round-3 commit) | only the offline-cached case |

Round 3 (2026-10-04): 36 findings (must-fix 8, should-fix 20, should-add 1, nit 7); all fixed. Must-fix 27 → 19 → 8; should-fix 56 → 20 → 20.
