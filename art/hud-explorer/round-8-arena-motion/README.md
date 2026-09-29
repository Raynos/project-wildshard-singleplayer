# Round 8: arena motion and graphics (E285, 2026-09-29)

Live local dev build (commit 167da165 plus the tuning commit after it), headless Chromium on Metal, iPhone portrait
390 × 844 at 3×. The dummies still use the first five-bone GLBs: the humanoid skeleton from the art pass drops in
without a code change (bone contract, `src/practice/TrainingDummy.ts`).

| File | What it shows |
|---|---|
| `still-driftwood-isle.jpg`, `still-pine-hollow.jpg`, `still-nalati-grasslands.jpg`, `still-nine-dragon-stack.jpg` | The spawn frame per shard: three dummies with their labels inside the frame (Nalati's narrow one and its weapon strip included), studio-lit PBR figures, a room with a lit floor pool, a ceiling grid and wall gradients instead of a black upper half. HOVER, HORSE and JOURNAL are gone in the room |
| `stills-four-shards.jpg` | The four stills side by side |
| `before-after-driftwood-nalati.jpg` | Before (E285 audit captures) and after, Driftwood then Nalati |
| `sword-driftwood-player-view.mp4` | The wooden sword, player's view, real touch ATTACK: two light taps, a combo third, then charged holds. Light hits nudge the figure; the charged blow rocks it back and the arms swing and settle |
| `crossbow-pine-hollow-player-view.mp4` | The crossbow, player's view, real FIRE: two body shots (the chest punches back), then two headshots (the head snaps back) |
| `four-hits-three-quarter-view.mp4` | The same four classes from a 3/4 camera, driven with the weapons' own numbers (sword 12 light / 24 charged with their stagger, bolt 38 body / 84 head) so the rock, the follow-through and the head snap are visible side on |
| `side-peaks-charged-and-headshot.jpg` | Frames from the 3/4 video: the charged blow's peak and recovery, then the headshot's snap and recovery |

Videos are canvas captures (`captureStream` + `MediaRecorder`) at the game's phone-tier buffer, 780 × 1688, no HUD.

Measured spring peaks (`test/practice-dummy-motion.test.ts`, straw dummy): sword light rock ≈ 6°, charged ≈ 17°, a bolt
to the body rocks ≈ 6° but punches the chest ≈ 11°, a headshot snaps the head ≈ 30°; each settles in under 2 s.
