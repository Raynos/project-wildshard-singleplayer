# Closed-anatomy rig1 normal-cycle recording

2026-10-19. **Attempt 1 blocked before page creation; no gameplay recording.**
No visual, motion, collider, physical-death or gameplay acceptance is claimed.
The selected source remains unaccepted; all public fallbacks are unchanged.

The frozen recorder was audited against the public70 authored-recoil normal
recorder, the gray-v2 phone recorder, and the shared-arena cycle QA. It targets
390×844 portrait with the original phone renderer policy and no capture clock.
Its intended cycle uses real UI actions, with explicitly logged player-only
placement for sword/coin/defeat coverage. It requires a final two rendered
simulation-second hold after post-reload damage. None of those actions ran.

Exact prerequisite checks passed for all 137 app files and 50 frozen product
files, before and after the attempt. Product sourceHash:
`99a69f9d3fc61912beaf08db8e7d67456756773976bb9a199dbd033910d610ed`.
App inventory receipt SHA-256:
`a213d07707ccae211505ac7d21e23a47a1a71cd45ee08084b92e8d2f3639103c`.
Frozen recorder SHA-256:
`ddd6feec4918caa5de1cae3760600e7082aa85a53035ba5ddfe927576e4cdcf0`.

The browser-lane attempt started at 21:09:30.192 UTC and ended at
21:09:30.746 UTC. Playwright could not create its video-enabled page because its
configured browser cache lacked the required ffmpeg executable. It produced no
page, video, runtime samples, input actions or checkpoints. The owned browser
and static server were closed. Failure evidence remains immutable; no retry was
made. An existing matching ffmpeg installation was subsequently located by a
read-only check, so this is a recorder dependency-resolution blocker, not evidence
of a product defect.

Any next recording must use a new explicit attempt directory and repeat exact
pins, retain this failed attempt, preflight the video dependency, and freeze its
recorder before launch. Cloud cadence must never be described as phone performance.

## Attempt 2: recorded, incomplete defeat coverage

The separate dependency-corrected attempt ran 21:15:00.503–21:17:28.175 UTC
(147.7 seconds). All 137 app and 50 product file pins remained exact. No page or
HTTP errors occurred. Owned browser and server were closed. Attempt 1 is intact.

- Original portrait movie: 390×844, 144.2 seconds, 3,605 encoded frames at 25 fps.
  Movie SHA-256: `3d9484261f1fa40773f0fc68de2d90eac5dcbcf7ae96a7f2548ddb5d507fed49`.
- Authoritative telemetry: 324 unique rendered frames in the first page epoch and
  39 after reload; no gaps within those recorded frame-ID ranges. All rows retain
  full scalar rig context, controller snapshots, actor state, local bone
  transforms, world matrices, camera and game-clock state.
- Every sampled clock was live, unpaused, captureFps=null, scale=1. The normal
  phone renderer retained DPR2, three passes, one shadow cascade and no AO.
- Observed actual locomotion and controller stages 0/1/2, authored hit recoil,
  sword kill, death, 2 bout-local coins, and fresh Retry/reload state. There were
  eight stationary living stage-0 rows and 46 flinch-positive rows before reload.
- Genuine reload sword damage was 45→33. The movie continued for another 21
  rendered frames, 2.0105 simulation seconds and 7.895 wall seconds. Persistent
  browser and world stores were empty at every checkpoint.
- **Player defeat was not reached:** the bounded observation produced five
  12-damage hits, leaving 40 health. Therefore defeated-input blocking and Retry
  after actual defeat remain untested. The recorder's intended phase labels are
  not assertions. Its `retryAfterDefeat` boolean only checks fresh values and
  does not establish prior defeat; the separate qualified verdict rejects that
  interpretation.

The cloud renderer's median delivered-frame interval was 367.9 ms initially and
343.2 ms after reload. Encoded 25 fps contains held/repeated render output; this
is not phone performance and not 3,605 distinct engine frames. Raw evidence is
about 13.4 MB, below the 192 MiB budget. No complete-frame image dump was made.

Recorder SHA-256:
`859aa2633d89d03c557d7242f6827c4769b4cc46743b7606db68a97cf099d993`.
Raw report SHA-256:
`87df17969e46531adb5ac8c528a84e174796cfc53df297cfb8d3506bc7670143`.
The original movie and raw records are retained separately for independent
complete-frame review. **This is incomplete functional evidence, not a complete
cycle pass or visual/motion/physical acceptance.** No product, fallback host,
source geometry, engine or rendering policy was changed, rebuilt or published.
