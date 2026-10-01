# E357 · review wave 2

Phone captures: **390 × 844, phone tier**, ANGLE Metal. BEFORE is the pinned live source **dcd6a29a7109a3357a811c55af3a22446ce0b9c6**; AFTER is the frozen HEAD **618b1cea80f7c640a0b19fcbd8495fc2d094d93f**. Both were built from `git archive` by `scripts/serve-build.sh`, invoked from `/private/tmp/e357-sol-w2/`. Later HEAD changes are excluded.

| Item | BEFORE | AFTER | Visible result / Jake's decision |
|---|---|---|---|
| Drowned Captain · decision 91 | [Portrait](captain-before.jpg) | [Portrait](captain-after.jpg) | Captain and health bar visible. Cyan compact bar → gold shared BossBar with phase marks. Review the shared bar's look and placement. The Captain model also differs between these builds; that is outside this bar comparison. |
| Big reef crab · decision 86 | [One hit: 100 → 90](crab-before.jpg) | [One hit: 100 → 86](crab-after.jpg) | Actual species contact: **10 → 14 damage**. VITALS at top left and the red hurt arc show the hit. Review the heavier hit, already chosen in decision 86. |
| B1 · spear thrust through cover | [4 s clip](b1-before.mp4) | [4 s clip](b1-after.mp4) | Registered wall stays closed. Target HP **200 → 170** before, **200 → 200** after; the old damage float appears through the wall. Review cover blocking. This clip covers thrust; brace/lance are not independently captured. |
| B2 · Naizagai crescent through cover | [4 s clip](b2-before.mp4) | [4 s clip](b2-after.mp4) | Same registered wall: target HP **200 → 160** before, **200 → 200** after. Review cover blocking. The exact production crescent method is invoked directly while the spear is held; this is a labelled fixture, not a mounted-input demo. Arc-chain variants are not independently captured. |
| Pine ambient drum · classification board B2 | [10 s SFX tap](pine-drum-before.mp3) | [10 s SFX tap](pine-drum-after.mp3) | Both recordings contain two successful `woodpecker_drum` plays. Review whether HEAD's scheduler cadence is acceptable. **No cadence regression is established by this short, unseeded pair.** No visual difference is claimed for this audio item. |

## How the evidence was staged

Captain: set the existing `used:altar` quest flag, move the player into the pool arena, let the authored rise complete, and frame the Captain. Camera movement/physics was held for framing. These are rendered game frames with the real boss UI; no bar was painted into an image.

Crab: move beside the first native `big` crab, leave its species AI running, and observe the real `animals.onCharge` callback. The first matching callback reaches the original player-damage handler; later callbacks are suppressed to preserve a single-hit health reading. The captured values are before 100/90/raw 10 and after 100/86/raw 14. Captures precede regeneration.

Walls: a capture-only cuboid mesh and Rapier WORLD collider, 0.8 m wide × 1.5 m high × 0.18 m deep, between player and wolf. Camera `(0, 1.7, 230)`, wall `(0, 0.77, 228.75)`, target `(0, 0.02, 227.5)`. Target HP is initialized to 200. The spear target adapter returns the wolf contact behind cover, matching the B1 characterization fixture; the production thrust decides whether cover vetoes it. B2 uses the production Naizagai target selection and crescent contact. Locomotion is held after the first creature render. The overlay is explicitly **CAPTURE FIXTURE**, and prints actual HP before/after the production call. The strike happens 1 s into each clip. Nothing synthesizes a damage result.

Pine audio: trusted input starts audio; `audio.muted=false`, `worldMuted=false`, and the real AudioContext is confirmed `running`. The game SFX bus connects to a MediaStreamDestination/MediaRecorder for a 10 s tap. This isolates the bird from the music and ambient bed. Chromium's output remains muted at the OS-facing launch flag. The existing woodpecker debug handle stages a perch 20 m away and starts its countdown; the scheduler then chooses the plays. Both logs report two successful real sample voices. MP3 encoding preserves WebM timestamp gaps (`aresample=async=1:first_pts=0`) and pads only the sub-0.1 s recorder tail to ten seconds. No sample is substituted or generated. Unseeded timing and this staged perch do **not** prove the board's original parity-route cause inference.

## Verification and limits

Every kept portrait was visually inspected. All four 4 s wall videos were decoded with `ffmpeg fps=4,scale=195:422,tile=8x2`; every sampled frame was inspected. Old hit floats and HP drops are visible; HEAD's target HP stays full. Poor Captain framing, missed crab contacts and the first wall render were discarded. Audio logs plus spectrograms confirm non-silent recorded drum bursts; no subjective listening verdict is claimed.

All media are below 500 KB individually. JPEGs preserve the original 390 × 844 viewport. MP4s are 4 fps, H.264/yuv420p, with no audio. MP3s are 96 kbps stereo, approximately 10 s including encoder padding.

Replay scripts and raw diagnostics: `/private/tmp/e357-sol-w2/{walls,crab,audio}.mjs`, `walls.log`, `crab.log`, `pine-drum-{before,after}.json`, and the four `*-tile.jpg` sheets. These scratch scripts attach to this lane's agent-browser CDP session and were run through `scripts/browser-lane.sh`; they are not repository runtime changes. Session `sol-w2` and both owned previews (4400/4401 at the time of capture) were closed. A later port reuse belongs to another session.

Both frozen builds booted. The final whole-working-tree `tsc --noEmit -p .` is red in sibling WIP (engine exports, title events, telemetry outcome types and new shards); log `/private/tmp/e357-sol-w2/tsc.log`. This lane changes only media/documentation. Full batch checks and pushing remain lead-owned.
