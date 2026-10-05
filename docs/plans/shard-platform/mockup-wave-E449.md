# SHARD-PLATFORM: the next mockup wave (E449)

Jake, 2026-10-04: *"Next wave of mock-ups, questions, decisions, make a mini plan for what type of mock-ups have to be
made based on all of the councils and routes and the current state of the plans and all of the spots and holes and
things that require more visual thought and decisions."*

Sources: councils 2 and 3 (round 1), G150–G162, rows SF19a (G158 frame owner, built default-off `6551dabab`), SF46,
SF55 / SF55a, SF56, SF57 / SF57b, SF58, SF59, and the for-Jake page. Each item below is a hole where the plan says
**what** but nobody has shown **how it looks**, or where a builder chose a look for Jake.

Rules (MOCKUPS.md, JAKE.md): one labelled A / B / C board per pick, iPhone portrait, started from a live capture;
codex `image_gen` for the final frames (Qwen only to explore: Jake can't read blurry frames); motion as a short video;
every image read before it is sent; each wave goes to Jake as one swipeable batch (variants full-size, then the board),
then at most four questions. Taste is his: the old look stays a Debug variant.

## Wave 0: real boards ready now (no mockup needed)

| # | Board | Question | Recommendation | Row |
|---|---|---|---|---|
| 0a | `art/_template/round-2-dev-look/board.jpg` | Template 1: today's grey (A) or the orange dev map (B)? | B | SF56 |
| 0b | `art/driftwood-isle/round-16-g134-sea/board.jpg` | The lowered sea reads OK? Boat at anchor + ladder (A, built) or aground by the pier (B)? | A, sea OK | SF46, G134 |

The SF19b one-frame boards (`art/grid/sf19b-one-frame/`) show the per-pixel grading G158 replaced; they are superseded
by the frame-owner boards (W3 below).

## Wave 1: new mockups (decision holes)

| # | Subject → folder | Why it's a hole | Variants | Question for Jake |
|---|---|---|---|---|
| M1 | **Fade-reload at a shard exit** (SF57b, G159) → `art/grid/round-16-fade-reload/` | The plan specifies a 250 ms fade and a handoff, not what the player sees; also the SAVE FAILED hold and the crash-resume note | A black dip with the SAVING… chip · B a cyan VR-void grid sweep (the road's own language) · C a "LEAVING NALATI" title card held over the reload. A 4-frame storyboard each + a ~3 s video; plus the SAVE FAILED, RETRY hold frame | Which fade? |
| M2 | **What you see from the road** (G158 consequence) → `art/grid/round-17-road-view/` | Inside a shard it owns the frame; from the road, do neighbours sit under the road's light or show their own skies? | A road light over everything outside the cells · B each cell's own sky / weather as a column you can see from the road · C a haze curtain at each border (Signal Dunes' band for every shard). Aerial + road-level frames | Which view from the road? |
| M3 | **The Blender Template's look and layout** (SF55, G161, G162) → `art/blender-template/round-1-concept/` | G161 fixes the verbs (overhang or bridge, interior, a 14 m rise entry, door + creature + two-step quest + reward), not the art | A the dev-map look shared with Template 1 · B Blender "clay" grey with one textured hero material · C a small textured ruin (stone bridge, a hall, a cliff entry). Plus a top-down layout sketch and its SHARD SELECT card (accent `teal`) | Which look? |
| M4 | **A refused or unavailable shard** (SF58, SF57 refusals, G86) → `art/grid/round-18-refused-cell/` | Nothing says what a grid cell shows when its shardfile is refused, over budget or needs an upgrade | A an empty VR-void plinth with a holo sign "SHARD UNAVAILABLE" · B the far proxy under a grey static shroud behind the soft wall · C a sealed gate at each entry stating the reason. Plus the SHARD SELECT card state | Which refusal look? |
| M5 | **A shard's script breaks** (G115, SF11b three strikes) → `art/hud/round-22-script-error/` | G115 asks for a player-visible message before outside authors; no design | A a small toast ("Something in this shard stopped working") · B a line in pause + the journal · C quiet for players, a red Developer banner with the error | Which message? |
| M6 | **Material graphs: what SF59 must prove** (G155–G158) → `art/grid/round-19-art-styles/` | The research says 9 of 12 shard ideas fit with graphs + a shard-owned frame; Jake hasn't seen any of them in the grid | Three of the twelve, each a shard cell seen from inside and from the road: a GTA-style photoreal town at night, a No Man's Sky pastel alien plain, an ink / cel-shaded valley | Add one as SF59's stress case? |

Order: M1–M4 are one batch (four questions); M5–M6 the next.

## Later waves: real captures, not mockups

| # | Board | When | Row |
|---|---|---|---|
| W3 | Frame owner A / B (G158: road look vs shard-owned frame) and a video of the 16 m edge blend the builder chose | after the quiet window (`art/grid/sf19a-frame-owner/board.mjs` exists) | SF19a / SF19b |
| W4 | G120 real crossroads captures (pop-in at L0 150 m / L1 400 m) | before M2 | G120 |
| W5 | SF48 Nalati look (G123, G148) | when SF48-g is prepared | SF48 |
| W6 | SF47 Pine variant sheet (only if Pine fails 1.0 GB) | after SF47's census | SF47 |
| W7 | SF55 the Blender Template, built (accent and slot) | after SF55 | SF55 |

## Status

| Item | Status |
|---|---|
| Wave 0 | answered 2026-10-04: 0a B, the dev map (G163); 0b neither option: lower the whole world 0.8 m, sea and island together (G164) |
| M1–M6 | made 2026-10-04 (`c953c7a0f`); M1–M4 asked: all four came back "Skip for now" (suspected stray Enter), so `needs pick (2026-10-04)`, re-asked in plain chat; M5–M6 not asked yet |
