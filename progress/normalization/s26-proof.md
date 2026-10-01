# E357 S2.6 scheduler proof — sol-s26

Source: `63edbe1635ae51e735508e4adb714df371b0abfc`, `ef1140968feb4f3538a39243e302f4dfb1aa2d49`, final scheduler correction `1bad44e465e7f58cc3aefe463a6113a732f1d0d4`.
Shared Game race: `f5ac2422` isolated scheduler hunks while S3.2 dependencies landed concurrently; `4a9c7e2f` restored the exact already-committed Game integration per lead. S3.2's final `9455590b` owns subsequent Game reconciliation. No foreign working-tree source imported by the final scheduler checkpoint.

73 focused cases in five files passed at06:57 on2026-10-01:
`test/engine/scheduler.test.ts`, `test/ai/tick-rates.test.ts`, `test/ai/approach-sequences.test.ts`, `test/ai/group-states.test.ts`, `test/combat/wall-characterization.test.ts`.
Owned oxlint0. Whole working-tree tsc was0 at the main source checkpoint; later moving S3 work introduces unrelated errors. The committed-tree check is the final source authority.

| Subject | Distance | Brain ticks / 2 seconds at60fps | Body frames / 2 seconds |
|---|---|---:|---:|
| Regular boar / bear runtime, sheep flock | <60m | 40 | 120 |
| Regular boar / bear runtime, sheep flock | 60–<160m | 20 | 60 |
| Regular boar / bear runtime, sheep flock | >=160m | 0 | 0 |
| Scoped pin | any | near cadence | every frame |
| Existing boss / elite / quest scripts | any | existing frame updater | every frame |
| Unmigrated custom species callback | any | 20 | 120 |
| Ambient FX | <120m | 60 | retained presentation |
| Ambient FX | >=120m | 0 | retained presentation |
| Pine weather state | any | 20 | presentation every frame |

The scheduler tests also prove the bands at30fps, full3D player distance, independent subject clocks, active elapsed dt, paused time discarded, instant interrupts in every band, scoped pin reference counts, tier override reset, stable instanced-row identities, and no stale clock replay after scripted cadence returns to AI. Repeated same-frame interrupts carry dt0 so they re-think without advancing timers twice. The manager test proves a charge wind-up advances between decision ticks.

Frozen approach snapshots remain byte-identical through an explicit pre-S2.6 clock adapter. B4 contact tests now invoke the owning body callback; cover remains blocked and exact variant damage25/32/40/35/45/42/55 is unchanged. No snapshot update was used.

Latest committed gate checked: `e6507722ff4b62bedc0d50ea8c3951040301e180`. CSS, generation, app/API TypeScript and oxlint pass. Ratchet fails13 new S3 audio/look/terrain/renderer rows; no scheduler or Manager increase remains. Lead notified; earlier full gate at `5ac8a99acf19ac0b4c2c94dc4217fdd65cfd76fc` passes with the first scheduler checkpoint.

Allowed narrow phone run: `scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=e6507722ff4b62bedc0d50ea8c3951040301e180 --lane=m5 --shards=all --tiers=phone --only=walk+combat+leak --out=/private/tmp/e357-s26/phone-final`.
Stopped approaching the four-minute builder wait cap; all owned browsers closed. Completed Driftwood result is `/private/tmp/e357-s26/phone-final/driftwood-isle.phone.json`: boot errors[], walk stuck0, sword three hits, first hit0.569s (limit3s), kill1.676s (limit15s), pause diff[], leak before/after equal and scope counters all zero. Its comparison remains red at `walk.sounds.event`, `boot.systems.input/update/late`, and `boot.registry`; no all-four green claim. Nalati partial walk stuck0; GPU logs repeatedly report `GL_INVALID_OPERATION: glDrawElements: Two textures of different types use the same sampler location` (S3.2/shared shader integration investigation handed to lead). Pine/Nine Dragon not completed in this run.

Queued for lead after the S3 ratchet cleanup: `bash scripts/vercel-tree-gate.sh` on a captured tip containing1bad44e4, then the all-four narrow command above with `--retry=0` (or the lead's full parity batch). The earlier transient ef run was canceled and its browser closed too.

Lead owns quiet-machine Pine budget inputs/calibration (no estimates authored), M2 tick-band board, pending-fill/accept, full two-tier parity and push/pin. Interpretations: sheep use their existing flock center; Pine skinning stays per frame; unmigrated custom callbacks keep10Hz per09§5.7; existing boss/elite/quest scripts remain frame-driven and pinned.
