# SF86 one-shot run 2 — Mesa Outpost

2026-10-11, sp-x5. **Overall FAIL: native brief gates PASS; built client refuses the goat rig before play.** Readability and phone art remain
**WAITING FOR OPUS**, ungraded. This is a fresh author test, not a port or a phone performance proof.

## Frozen seat and isolation

Pin `c7b1c591bf85f5251e5f2487481b8f56a3d4b861` includes OS-F7 `de596178c` and OS-F9 `c7b1c591b`.
The same brief as [run 1](../oneshot-2026-10-11/README.md):

> Mesa Outpost: a dry mesa with a well, two adobe huts, a watchtower with a ladder,
> a goat herd that flees and a hawk that dives, one quest to light the tower beacon at dusk,
> a commons spear, the four entries.

Fresh Codex CLI 0.162.1, default model, ephemeral execution with personal configuration/rules disabled.
16:46:37–17:06:25.813 UTC: **1,188.5 s (19.8 min), 71 decisions / 150, exit 0**, within 2 h.
63 completed commands, 18 failures; every tool call and assistant message consumed a decision.
No hints, messages, source corrections or assistance were sent during the measured run.

The inherited macOS read-deny sandbox blocked main/worktree source, other shards, personal configuration and
parent control files; eight denied-read probes and the allowed-doc probe passed. Locally installed SDK, format,
commons, third-party packages, generated public docs and frozen three.js docs were available. No external
node_modules symlinks. Direct network was denied; the opaque proxy allowed only Codex/auth API hosts, refused
GitHub, and closed in finally. Authentication stayed in its original runtime location; no credentials were copied.
Three zero-decision CLI initialization failures preceded the run and are excluded. Compared with run 1, the
public format package is readable and the catalogue includes the new spear; these are intentional author inputs.

Package archive SHA-256: SDK `8cede3e7fd7a52cfc2ba483ee2cc0e2210d99b15c8cfa058812491f5d969a4ed`;
format `a7b7df8ed816df136d94ba9ce38a53ae4c3895bc0dc6cf5d86263bdd98910935`;
commons `fa4f094a26ce1b721e221c078da1e952cc2124fff26b5f64171462faf3686c1c`.
Catalogue `4cbc648590b76107568bc20197dec5127fef55c1264ba3f2a608fb0d648d06d9`.

## Independent grades on the unchanged product

Parent rebuilt from retained TS generators and reran the seat's tests, plus independent worker/grid checks.
Every authored input hash remained unchanged. Seat and parent shard.json SHA-256 match:
`4126a1c5d20de1248198a5580827f1bc30ac201738eabfa60e83b36ed4686001`.

| Gate | Run 2 evidence | Run 1 |
|---|---|---|
| Build / validate | PASS; both exit 0, 92 entry lanes, 46,102 real capsule steps | PASS; 46,095 steps |
| Structural content | PASS; 80 render tiles, 64 collision tiles, 152 immutable files, four entries | PASS; 92 files |
| Required fauna | PASS; three goats flee 35.2–37.3 m; hawk lands damage, health 100 → 94.067 | FAIL; idle animals |
| Beacon / dusk | PASS; actual reachable interaction, shared day observation; unreachable, early and after-dusk negatives; early request never ignites later | Narrower event-injection proof |
| Native replay | PASS; mandatory Mesa checkpoint 783, 30 exact suffix ticks; independent worker 60-tick suffix exact | PASS for reduced product |
| Grid lifecycle | PASS; reserve before physics, admission fence, save refusal, checkpoint, five frozen ticks, two loads, zero leaked leases | Parent-only PASS |
| Ledger | PASS; gameplay fact mesa.beacon-lit at tick 482; one grant, durable reload and duplicate stable | Parent-only PASS |
| Ladder walk | PASS; real vertical ladder ascent to y=6.020 and descent to y=0.020, zero stuck | Inclined tread workaround |
| Commons spear | PASS native/data closure; exact equipped loadout/profile and both catalogue hashes | FAIL; decorative local spear |
| Report card | PASS; estimated worst playing 741.014 MB, loading 821.014 MB; download 0.784 MB; script p95 24.958 µs, max fuel 40,865 / 8,000,000 | PASS; 754.855 / 834.855 MB |
| Author boundary | PASS; zero engine/game imports, zero runtime/ lines, zero ShaderMaterial constructors | PASS |
| Built client | FAIL; level.kit refuses goat rig missing required body bone; no playing views, prompt or equipped spear credit | Unmeasured |

The model values above are not physical-device memory or timing measurements. Native grid proof does not certify
browser crossing performance. The authored goats/hawk have admitted custom skin/clip bytes, rather than primitive
placeholder views; admission alone does not prove their rendered appearance.

14 retained source files, 36,349 bytes / 628 lines; maximum file 150 lines, maximum line 118 columns.
This includes the supplied 44-line prove-mesa.ts: 13 files are newly authored. Generated bundles/data/client are
excluded. Numerical limits pass; source readability is not awarded a blind-review grade. The seat's test-beacon.ts and generators/animals.ts
also contain three non-null assertions: this remains an author-quality finding, not a source patch made by the parent.

## Client failure and honest open list

Independent muted Chromium, iPhone 16 Pro, on the exact packaged client: boot stopped at level.kit with
`species 'goat (goat)': rig missing required bone 'body'`. The goat generator declares Root and Leg0–Leg3;
its admitted custom skin therefore does not satisfy the live species rig contract. A second diagnostic attempt
recorded the actual loading error after the first wait timed out. No author source or admission check was changed.
The hawk/client prompt/equipped spear cannot be credited because boot never reaches play. Native validation,
including the mandatory native Mesa runner, did not detect this mismatch. Full proveMesaOutpost remains open.
The fresh seat itself honestly reported browser evidence unmeasured. Readability and art remain ungraded;
no physical-phone or browser-grid performance proof was attempted. Both parent browser sessions/server closed.

## Comparison against all 37 run-1 friction items

Numbers refer to the ordered bullets in run 1. “Not repeated” describes this run, not proof of a universal fix.

| Run-1 items | Run-2 result |
|---|---|
| 1, 2, 7, 27 | Repeated shell/readline, oversized reads and Python/Xcode sandbox friction; /bin/sh and focused reads work. |
| 3, 8, 16, 21, 28 | Guessed declaration-path friction persists (exportGlb, spear, skins); public format imports work. |
| 4, 6 | Direct Valibot unwrapping not repeated; schema CLI used, but /ui pointer refused. |
| 5, 12 | Closed in this run: actual commons spear catalogue, exact asset/profile closure and loadout. |
| 9, 10, 23–26, 29 | Typed script generation/ABI works without numeric capacity guesses; compilation must run in generate.ts, not bundled config. |
| 11, 17 | No hearing/spawn arity refusal; canonical herd/diver rows and actual custom skin bytes admitted. |
| 13 | Closed in this run: declared vertical Ladder and real ascent/descent. |
| 14, 15 | No identifier/tag refusal; generated typed declarations used. |
| 18–20, 22, 30 | Closed in this run: real data-host herd flight and diver attack, not calm/zero-speed substitutes. |
| 31, 32, 37 | Public proof runner now proves gameplay Ledger, grid lifecycle and replay; parent repeats them independently. |
| 33 | Seat still lacks browser tooling; parent client grade is separate. |
| 34 | Generated output excluded from source limits; generators retained. |
| 35 | Self-matching regex failure not repeated; independent AST audit also passes. |
| 36 | Design assumptions remain explicit: stepped mesa scenery, dry hollow well, two-minute day, three goats. No taste grade. |

Run 1: 65 decisions / 16 failed commands / 17.7 min. Run 2: 71 / 18 / 19.8 min.
The 38 run-2 friction bullets include assumptions, superseded workarounds and successful proofs; they are not
38 defects. Functional coverage improved; effort and failed-command counts did not decrease.

## Proposed new friction rows — coordinator to place

- **Species view contract admission:** document mandatory per-species bone names and reject incompatible
  custom skins in build/validate before the client. This product passed both yet cannot play; add the missing-body
  negative fixture and require the exact built product to complete the mandatory client proof.
- **Config/generator boundary:** document and diagnose Node file writes and compiler use in bundled data-URL
  shard.config.ts. Reference generate.ts must compile/write assets before config loading; the seat hit this thrice.
- **Data-only director actions:** public emit-to-script actions refused native binding admission; flag → one-tick
  request → quest completion works. Make supported action/host combinations explicit, with executable examples.
- **Schema/declaration discovery:** make root /ui lookup work or document its actual discoverable schema ID;
  document packaged declaration paths for exportGlb, skins and commons spear instead of requiring guesses.
- **Standalone proof execution:** provide the supported installed-commons bundling recipe; Node type stripping
  refuses installed commons TS. Also clarify bootstrap's destination package/dependency declarations.
- **Named interactive meshes:** document a retained named-node export recipe; staticGlb merged primitive names,
  forcing an explicit glTF-transform exporter to preserve the scene-controlled flame.
- **One-shot client environment:** expose one isolated browser driver while preserving source/network denial,
  so mandatory F7/F9 client gates can execute inside the fresh seat, not only after it.

These are proposals, not edits to plan state. No generated shard, raw events/archive, screenshot or credentials
are committed. Retained author sources and frozen packages for reproduction:
`/private/tmp/claude-501/sp-builders/sp-x5/oneshot-run2/{sandbox,control,worktree}`.
