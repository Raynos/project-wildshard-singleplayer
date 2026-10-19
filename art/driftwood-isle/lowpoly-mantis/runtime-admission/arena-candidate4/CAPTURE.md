# Candidate4 actual capture, 2026-10-19

Unaccepted WIP. Frozen product sourceHash: `8ffdee515e3426653e8ebc74f8ccefc229f35ceb00c869e743615e27b792b89c`. Source closure SHA256: `0b9a31b042ecceddbe55b10bab620ae05a478bf09f16a7f9b0ac37dc407372d0`.

## Tested host and scope

The exact native tuple is in evidence/host-preview.json. The complete tested host inventory contains 137 files. Product build, app build and browser QA exited 0. The browser and server closed at 05:05:51 UTC. Root changed PracticeCreature event draining after this capture, at 05:06 UTC. This capture does not validate that subsequent host. The tested built directory remains intact.

All 11 checks passed: only Mantis; both strikes; actual player damage; actual enemy damage; enemy death; no post-death strike; three bout-local coins; Retry; empty browser storage; unchanged empty SaveStore documents, shard and generation; no page errors. The report contains actual before/after state snapshots. Player repositioning and the diagnostic render-only observer camera are logged. Health, rewards and enemy clocks were not injected.

## Fresh collapse and settled contact

469 rendered samples record authoritative strike phase/time, observed phase/time, game frame/time, performance clock, 22 bone position/quaternion transforms and the full mesh world matrix. There are 129 dead samples across collapse and settling.

Exact native rigid weighted world vertices have zero samples below −5 mm. The live minimum is +0.000672828 m; the corpse minimum is +0.013622386 m. The last six game seconds before Retry (frames 276–352, game time 23.7589–29.7501) have an identical full world matrix, body minimum +0.013627155 m, and eight vertices within 2 cm. The physical root still settles to Y=899.85986328125; anatomy rotations provide clearance. This bounded result is not universal terrain, contact or collider acceptance.

## Recording and visual inspection

The full recording is 55.32 seconds with 1,383 encoded frames at 25 fps. Original and compressed frame counts match. Raw and MP4 SHA256, byte counts and ffprobe receipts are in evidence/encoding.json. No speed or cadence filter was applied. Actual rendered cadence differs from encoded duplicate frames. Align using the burned-in HUD game frame, not an assumed equality between performance clock and video time.

Death starts at render frame 224, game time 19.3782. The last dead frame is 352, game time 29.7501. Retry is visibly present near the end: the inspected final image shows a fresh bout at frame 465, game time 39.30. The recording tail does not include every last telemetry frame (through 473).

Direct inspection of the corpse and recording tail confirms the full body is in frame and Retry is visible. Independent full-frame review remains required. Candidate3 phase-observation/active-blend latency and weak gait anchoring remain unchanged. No performance, fun or promotion claim is made. Candidate3's separate idle diagnostic and corrected top/source-native views remain separate evidence, rather than new candidate4 captures.
