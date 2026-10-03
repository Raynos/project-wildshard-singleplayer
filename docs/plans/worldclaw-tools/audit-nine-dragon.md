# Audit: what Jake looked at before Nine Dragon was walkable (for WORLDCLAW-TOOLS §0)

2026-10-01. Read-only audit of the main checkout. Sources:
- the session transcript `~/.claude/projects/-Users-raynos-projects-games-wildshard-singleplayer/be65981d-8428-4bae-8549-6996f99c15c1.jsonl`
  (172 MB; counted by a script, main thread only, subagents excluded; times below are local, UTC−5);
- the blow-by-blow `docs/Nine-Dragon-Stack-blow-by-blow.pdf` (E360, 30 pages; its header: 111 h, 98 prompts, 35 decisions
  on the ask tool, 50 agent launches, 32 production builds);
- `art/nine-dragon-stack/round-*/` (first-commit time and image count per round);
- git history (`f230117d`, `54d87764`, `33c629af`, `96d57347`, `3719d1d8`, `e760b30e`);
- `docs/plans/NINE-DRAGON-STACK.md` §6, §7, §10 P0, §12; `project/archive/2026-10-03-shard-checkpoints.md` (merged into WORLDCLAW-SHARD, E406);
  `docs/sessions/nine-dragon-mega-session.md` (the feedback ledger F1–F10); `docs/process/nine-dragon-imaginary-play-by-play.pdf`.

"Walkable" = the first deployed build Jake could walk on the phone: `3719d1d` at 09-26 01:43, the in-engine partial
shard behind Debug ▸ "Nine Dragon Stack prototype". Before it, the clean room (`dev/nine-dragon.html`) and the nine labs
ran only on a dev server. Jake never had them on the phone; he saw screenshots. At 01:18 he asked "Did you say there
was a way for me to enter shard 4?"

## 1. The numbers (09-25 19:19 → 09-26 01:43 = 6 h 24 min)

| Measure | Before walkable | After walkable (to 09-30 10:49) | Whole session |
|---|---|---|---|
| Jake's prompts (deduplicated, queued ones included) | **37** | 57 | 94 (the PDF counts 98) |
| Decisions on AskUserQuestion | **6** questions in 2 calls (21:03 ×4, 22:10 ×2) | 29 in 16 calls | 35 in 18 calls |
| Files pushed to chat (SendUserFile) | **48 images + 1 video** in 27 sends | 49 images + 14 videos in 35 sends | 97 images + 15 videos |
| Agent launches (main thread) | 24 | 26 | 50 |
| Committed images (`art/nine-dragon-stack/`) | **505** in 38 rounds | 644 in 48 rounds | 1,149 in 86 rounds |
| Commits in the window touching Nine Dragon | 45 | — | — |
| Production builds that changed the COMING SOON card | 3 (`f230117` 21:40, `17f27bd` 22:39, `da2566d` 23:05) | 1 (`903d66e` 07:09) | 4 |

The 505 images before walkable: 41 front images (concepts, mockups, styles, live baseline HUD: rounds 1–4, 6), 147
from the clean room and nine labs (10 rounds), 316 from the look loop and the domes (22 rounds), 1 render.

## 2. Phase by phase: what Jake had to look at

| Phase (local) | What was made | What Jake saw / did | Friction a tool would remove |
|---|---|---|---|
| **A · the front**, 19:19–21:06 (1 h 47) | 9 concepts, 4 spawn compositions, a style research note, 6 styles on one spawn, 4 Jiehua Neon views, fresh live captures of the 3 shards' HUD | 10 images in 3 sends; **4 decisions in one call at 21:03** (style, spawn + hero view, weapon, name) | **19:49 "you're using stale … mockups of the HUD"**: 4 compositions were drawn on an old Nalati HUD capture and re-made (round 6). Jake also had to ask "What choices are there for me to make? Show me the mockups" (19:48) |
| **B · clean room + labs + look loop**, 21:06–00:22 (3 h 16) | the clean room v1 → v2 (a standalone three.js page, `54d87764`, `d84c29b5`); labs P1 ink, P2 neon, P3 facade, P4 hero, P5 texture, P6 light, P7 organic, P8 viewmodel, P9 grapple; look-loop rounds 1–12 (9 frozen angles vs codex paint-overs); dome B rounds 1–10; the COMING SOON card live at 21:40 (2 h 21 after the ask) with clean-room captures and a PROTOTYPE caption | 27 images + 1 video in 18 sends; **2 decisions at 22:10** (the loop's target, time of day) | **22:10 "Show me a progress image from mockup to attempt 1 to attempt n/2 to attempt current"**; **22:46 "What is image 5/5 … a mockup or an in-game?"**; **23:14 "I thought we were way further ahead … round six or round seven"** (round 8 had gone backwards; the colour score liked it, his eye didn't); "% done?" at 23:08; **23:50 "an ungodly amount of … throwaway shit"** |
| **C · break away into the engine**, 00:22–01:43 (1 h 21) | labs deleted (`33c629af`), the clean room moved into the shard module (`96d57347`, a rename), the eight domes' 3×3 targets (round 15, 259 images), the render repair; first walkable deploy `3719d1d` at 01:43 | 11 images in 6 sends; 0 decisions; 13 prompts, most of them steering the method (two domes per mockup, targets imagined from the mockup) | "% done?" twice (00:31, 01:20); **01:18 "Did you say there was a way for me to enter shard 4?"**; **01:26 "the clean room … was producing a lot better screenshots … give me them side by side"**; 01:30 "I'm missing A1 and A2 3×3 mockups" |

After walkable the same pattern went on: "% done" four more times (7 in all, the last "What's left and what's next?"),
the sword-size A/B (07:30, answered 2½ days later), and 63 more files pushed to chat.

## 3. The clean-room experiments

- **The clean room** (`dev/nine-dragon.html`, three.js only; the light lab carried a "10 k-line clean-room copy" of it
  at 23:28, `d999fe8b`; the shard module it became was ~20 k lines by 09-26, NINE-DRAGON-STACK §6.2): the spawn in Jiehua
  Neon on the baseline HUD, v1 at 21:04, v2 at 21:37; its captures were the first COMING SOON art.
- **Nine look labs**, each its own folder and question, each ending in a README with LEARNINGS and integration steps
  (`art/nine-dragon-stack/round-7-lab-*`, `round-9-lab-*`): ink (ruled lines, silk fog), neon (SDF signs, streak cards,
  bloom), facade (a 28-piece kit and grammar), hero (the Jian, the paifang, the banyan, TRELLIS crowd), texture (painted
  swatches; it made round 8 worse), light (baked pools, a learned LUT), organic (canopy, roots, the sky scroll),
  viewmodel (the rigged arms; the snapping hand), grapple (aim → lock → fire → zip, a 5.7 s video).
- **The look loop and the domes**: 12 loop rounds at 9 frozen angles, then two half-domes per mockup (Jake's fix, 22:19),
  then eight domes with targets imagined from the mockup, not painted over our frames (Jake's fix, 01:13).
- **The verdict** (NINE-DRAGON-STACK §12): "Clean rooms are for finding a look, not for building a world." The labs
  earned their keep; everything else moved into the engine as soon as it could.

## 4. What a Draft mode would have replaced

| Then (before walkable) | Count | In Draft mode (WORLDCLAW-TOOLS §3) |
|---|---|---|
| Images pushed one by one into chat | 48 images + 1 video, 27 sends | the Shard Atlas gallery, filled at every step; chat carries one board image + the question |
| Decisions only in chat (AskUserQuestion) | 6 | board items in the Atlas with their verdicts kept, plus the same AskUserQuestion |
| "% done?" / "what's left?" | 3 before walkable, 7 in all | the run header: stage, rows done, waiting on, next |
| Progress lineage and side-by-sides on request | 22:10, 23:14, 01:26 (and 07:30 after) | a lineage strip per view: mockup → round 1 → … → now, any two compared by a slider |
| "Is it a mockup or in-game?" | 1 | every item labelled by kind and source (concept · mockup · clean room · lab · engine · target) |
| "Is there a way for me to enter?" | 1 | DRAFT on the shard's deck card; a PLAY chip on each playable prototype or build |
| A stale reference under the mockups | 1 correction, 4 images re-made | each mockup item records its reference capture's build id; the Atlas flags one older than the live build |
| The COMING SOON card + slideshow | 4 deploys; `src/chunks/placeholders.ts` (74 lines) + ~260 lines of HUD slideshow, all deleted by E318 (`e760b30e`) | the public teaser: data, no deploy, Jake's verdict publishes it |
| Ten throwaway prototypes seen only as screenshots | 147 images; a ~10 k-line clean room | the prototype gallery: each with its question, result and verdict; a playable page when it answers a feel question |

**What Draft mode does not replace:** the labs and the loops themselves. They found the look, and Jake's three method
fixes (two domes, eight domes, targets from the mockup) moved the frames more than any lab. Draft mode removes the push
and ask friction and keeps the history browsable; the work and the taste calls stay.

## 5. Lessons for the tools

1. **Jake reads progress as a lineage**, not as single frames: three asks before walkable for "mockup → attempt 1 → … →
   now" or side-by-sides.
2. **He loses track of state**: "% done" seven times, "I thought we were further ahead" once. A run header answers it.
3. **Provenance matters**: a mockup, a clean-room frame and an engine frame look alike at phone size.
4. **Prototypes he can't touch are screenshots.** No dev server (E317) and no URL bar (the PWA) means a throwaway page is
   invisible unless the deployed site links it.
5. **The public card came first** (2 h 21 after the ask) and changed four times, and its whole mechanism was later
   deleted. A coming-soon card needs a permanent, data-only home.
6. **A link from chat opens Safari, not the home-screen PWA**, and the two keep separate storage on iOS (Developer
   mode, the review password). So the in-game Draft mode is reached from the PWA's own deck, and chat keeps the board
   image (or links the Artifact host, which opens in the Claude app).
