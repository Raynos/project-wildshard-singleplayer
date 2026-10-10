# WorldClaw shards: from Jake's vision to a fun, polished shard, with WorldClaw doing the labour

**State:** `draft` 2026-10-03: **a plan only.** **SHARD-CHECKPOINTS is merged in** (E406, D77–D92: grey world first, then a checkpoint per place, Frame · Form · Play · Pin; new shards only, D90, except a director's single stage on any shard, D91; Nine Dragon stays on its own plan, D89); L1 (T1's formats) done; the merge and its council done (four rounds, register MC1–MC51; MC48 answered by Jake, D92). GAME-NORMALIZATION is archived (2026-10-01); the rows start with WORLDCLAW-SHARD N0 on Jake's go. Done: the research, Jake's grill and picks (D1–D76), four prototypes and the fjord dry run (§10; its front and content round 2 are Jake-reviewed), the flow ([06](../design/worldclaw/06-shard-flow.md)), council rounds 1–4 + a scoped check, the three skills (interactive, auto, sketch: D62; this plan's S rows, drafted in `.claude/skills/`). **One of three plans** (Jake): this one is the workflow and its skills; [WORLDCLAW-TOOLS](WORLDCLAW-TOOLS.md) is the tools and Draft mode; [THIN-ICE](THIN-ICE.md) is the pilot shard. **The pilot is Thin Ice** (D74; [THIN-ICE](THIN-ICE.md)). Companion: [WORLDCLAW-TOOLS](WORLDCLAW-TOOLS.md) (Draft mode, the drafts site, the Explorers). The content boards sit at P5b (D75). Open: Jake's go (§7): "Not yet, I'll review the pages". Pages: https://claude.ai/artifact/BmJQrhiuLPoqVXVfAoLdbp · Thin Ice https://claude.ai/artifact/1v5EE7bt75m3dGFAkVh7P1. On `main` since 2026-10-01 (merged from branch `worldclaw`; the prototypes and the review copies at the local tag `worldclaw-archive`, D76).
**Reviews:** [worldclaw-shard-review](../reviews/worldclaw-shard-review.md) · [gw2-zones](../reviews/gw2-zones.md)

## 0. Read this first

### 0.1 Why (Jake's words, 2026-10-01; the ask file E359 holds every quote)

> "making a shard with Claude without being incredibly aggressive on steering just leads to a large shard where …
> 500 by 500 … every square meter … needs to be polished. I also want to be able to explore ideas and have a co-pilot."

> "The reason we need iterative is because the current worlds need so much polish it feels like slop. Maybe worldclaw
> can make better autonomous worlds with less polish or slop."

> "we're building real fun worlds … not … random ass dioramas that look cute … a real fun shard. That's a standalone
> level … with their content, their quests, their themes, their art styles."

> "Content and world are equal weight, they have to happen together."

> "we need to make art direction, we need to make concept art, we need to turn concept art into mock-ups of in-game,
> in-engine screenshots … there's a whole ideation and planning flow to a shard that we're not doing. We need to do a
> lot more visual planning … sometimes be lazy and attempt to create an autonomous shard with the world claw technique
> from one sentence prompt as like a zero shot."

> "if it's going to need feedback from the human, you need to front load that feedback as far to the front as possible
> at the mock-up and the image generation stage."

> "I want to watch you build it … in all the skills at the beginning, just ask the user if they want progress and time
> lapse videos."

> "I just want you to do the plan … We can't build this until the normalization finishes."

**The thesis this plan tests.** Unsteered agent shards are slop because things don't sit right, nothing is composed,
and the style drifts (Jake's three picks). That slop lies across 250,000 m² that all need polish. WorldClaw's core
idea is that "a globally coherent world need not be generated everywhere at once". Its techniques go straight at the
three causes: contact solving and co-deformation, image-model composition, and generating from one style. **So: fix the
vision up front on images, prove the fun in grey by playing it, then let WorldClaw build the detail only where a player
sees it.** The score is Jake's first-walk notes.

### 0.2 The ledger: settled decisions (the council may reopen one only with new evidence)

Superseded rows stay, struck through by the row that replaced them, so the history reads.

| # | Decision | Source |
|---|---|---|
| D1 | The plan lived on branch `worldclaw` (worktree, from tag `pre-normalization` = `dcd6a29a`) until it merged into `main` on 2026-10-01 (D76). Execution happens on `main`, on the normalized engine, after GAME-NORMALIZATION is archived (D28) | Jake |
| D2 | Shards are built on the model contract: models (`defineModel`), placements (`place`), Sets (`placeSet`, every named place a Set) and World, reviewed in the Model, Set and World Explorers | Jake + model-architecture archive |
| D3 | Three flows: autonomous, iterative high quality (checkpoints, partial shards), sketch (fast low-poly). **Refined by D33 / D44:** they are tools used together, and each shard picks how hands-on it is | Jake |
| D4 | The autonomous flow and the visual front (D46) are planned in full; iterative and sketch stay outlines | Jake |
| D5 | A shard is a **fun standalone level**, never a cute diorama | Jake |
| D6 | ~~The autonomous flow builds the world only; content comes after~~ → **superseded by D37**: content and world have equal weight and happen together | Jake |
| D7 | The plan is `ready` only after a council (Codex + Claude seats, a register, a battery). **Capped by D29** | Jake |
| D8 | No territory licence caveats; Hunyuan3D is as allowed as TRELLIS.2 | AGENTS.md |
| D9 | Phone first: the engine's derived per-pose budget (R28), ≤ 1.8 GB loading and ≤ 1.0 GB Explorer on a physical iPhone (Jake, E264); never render-scale cuts; never facade multi-draw | AGENTS.md (E388: the triangle and draw caps once cited here are not in AGENTS.md) |
| D10 | No URL switches: variants in pause ▸ Settings ▸ Debug; harness params only | AGENTS.md |
| D11 | Pitches: the agent proposes **three**; Jake picks one | Jake |
| D12 | Art direction: Jake picks from **three directions** | Jake |
| D13 | ~~A greybox peek mid-run~~ → **superseded by D41**: the play gates | Jake |
| D14 | The pilot is a **full shard** (8–12 places, every gate); how far its content goes is the run-scope answer (D38) | Jake |
| D15 | **Front-load every human decision**: images first. **Refined by D41**: images, then two play gates in grey, then no interrupts except Jake's own notes (D36) | Jake |
| D16 | Every WorldClaw skill **asks at its start** for progress photos, time-lapse photos, a progress video and a time-lapse video (default yes). **Extended by D35**: a live page, milestone clips, a daily summary, the final time-lapse | Jake |
| D17 | **World as data**: the spec, placements, Sets, scatter rules, pads and happenings are data files read by generic placers; code is thin | Jake |
| D18 | **The catalog is decided per place**: kit pieces (code / Blender, instanced) or generated (TRELLIS / Hunyuan3D) | Jake |
| D19 | **Paint-then-lift places dressing + buildings**; anything the player walks on, climbs or fights around is a CODE model placed from the spec | Jake |
| D20 | **Scatter source by a tech demo** of three approaches (code / Blender species, image-to-3D, stock CC0 / CC-BY), shown to Jake (row X1) | Jake |
| D21 | **Model Explorer provenance**: a card shows its reference image, the composition it was lifted from, and the place / Set using it | Jake |
| D22 | **Set Explorer target vs built**: a place's approved mockup beside its built Set at the same camera | Jake |
| D23 | **World Explorer channels**: lit / instance / normals / depth; a pure viewer, no overlays | Jake |
| D24 | **The cube first**: per-shard vertical extent (250 m up, 250 m down) exists before a pilot | Jake |
| D25 | Every level has, from the start: **discovery places + map pins, traversal toys, arenas + a boss arena, secrets + vistas** | Jake |
| D26 | Keep three organic techniques: **LOOK-LOOP, two domes per hero view, 3×3 targets from mockups** (the horizon matte is optional) | Jake |
| D27 | After Jake's front and play gates, taste calls go to **two judges, Claude + Codex** | Jake |
| D28 | **Plan only now.** Nothing is built for the game until GAME-NORMALIZATION is archived. **Amended by D56** for throwaway prototypes | Jake |
| D29 | The council runs **4 rounds at most**, stopping early after a clean round; no two-clean rule | Jake |
| D30 | The dream is a **co-pilot for Jake's vision** that also explores ideas; the why is §0.1's 250,000 m² of polish | Jake |
| D31 | Jake's fun: **traversal toys, big reveals and vistas, discovery and secrets**: "organic stuff, just seeing cool stuff" | Jake |
| D32 | **Art per shard**: the pitch decides; stylized shards may use generated assets, photoreal ones lean on Blender and scans | Jake |
| D33 | **Hands-on level per shard**: autonomous or iterative is Jake's choice per shard. The iterative flow exists because today's worlds need so much polish | Jake |
| D34 | A **signature traversal verb is up to the pitch**; **combat is an equal pillar** with traversal and discovery | Jake |
| D35 | **Follow-along**: a live page, milestone clips, a daily summary and the final time-lapse | Jake |
| D36 | **Notes any time**: Jake may send a note mid-run (chat or the live page); it is applied at the next step boundary and logged; the run continues | Jake |
| D37 | **Content and world have equal weight and are designed and built together** (enemies, bosses, quests, happenings with the places) | Jake |
| D38 | **Run scope per shard**: the run's first questions ask how far it goes (world + all content; world + one slice; …) | Jake |
| D39 | **Slop is: things don't sit right, no composition, style drift.** It is worst in Pine Hollow and Nalati | Jake |
| D40 | **The slop score is Jake's first-walk notes**: he walks the result once on the phone, and the count and size of his notes is the score | Jake |
| D41 | **Images, then play gates**: after the visual front, Jake plays (1) the verb greybox when the pitch has a new verb and (2) a 10–15 min session slice in grey; only then is the look built (the first two of the GW2 director loop's three play gates, [GW2-ZONES](GW2-ZONES.md) §4.3; P17 is the third, the arc) | Jake |
| D42 | **WorldClaw and the director loop are separate tools used together**: a director may call WorldClaw stages, and a WorldClaw run follows the director's gates | Jake |
| D43 | **The detail budget: beats + every route.** Full polish where a beat is and wherever a route can see; off-route land is coherent terrain + scatter that never needs hand polish | Jake |
| D44 | **Happenings are designed with the world**: events with a spot, a trigger, an objective, a timer, outcomes and a signal visible from afar | Jake |
| D45 | No A/B on an existing place first; the pilot is a new shard | Jake |
| D46 | **The visual front**: art direction (a style bible), concept art, concept → in-engine mockups, illustrated maps, every shard, before building | Jake |
| D47 | **Vision intake**: a sentence + references, Jake's voice notes or long description, and a pick from three pitches | Jake |
| D48 | **The style guard**: a style bible + a per-asset check by the judges before an asset is placed | Jake |
| D49 | Review: **a live visdev page and one board per decision** | Jake |
| D50 | Concept art: **Qwen-Image-2.1 locally to explore, codex for finals**; every in-engine mockup by codex | Jake |
| D51 | **Zero-shot is a mode**: one sentence → a whole shard; the judges take every front and gate decision; Jake sees only the final board and the time-lapse | Jake |
| D52 | **`design.md` + `spec.json` are one source**: the human page and its machine twin; WorldClaw and any director read and write both | Jake |
| D53 | **New verbs: the pitch decides**, saying "existing verbs" or "new verb (+ N days)" | Jake |
| D54 | **Fun is measured by Jake's fun-rules page and the Claude + Codex judges** (no bot metric is a gate) | Jake |
| D55 | **One shard at a time**; neighbouring shards are a later plan | Jake |
| D56 | **Throwaway prototypes are authorized** to finalize this plan: as many mini prototypes as useful, each in its own worktree and branch, never on `main`, never merged; their findings go into the plan as evidence (§10) | Jake: "if you think we need to do some standalone throwaway prototypes to finalize this plan, those are authorized … use a work tree and a branch … Don't work in the main branch" |
| D57 | **The verb gate comes after the mockups**: P7 runs after P6 (after E9b for a moved toy), before P8. Supersedes R13's early order (§7 Q1) | Jake, 2026-10-01: "After the mockups" |
| D58 | **`design.md` lives in the shard folder** (`src/shards/<slug>/design/`), and the shard's `docs/SHARDS.md` section links it with the pillars and a verdict-log summary (§7 Q2) | Jake: "Shard folder + link" |
| D59 | **E1 is one row shared with Nine Dragon's P2-E1**; whichever plan reaches it first builds it (§7 Q3) | Jake: "Whichever plan first" |
| D60 | **Polish every seen m²**: full polish (compositions, paint-then-lift, look cameras) on the close, mid and far bands; only never-seen land gets nothing; the close band goes first. Supersedes R11's "what each band gets" (the bands stay as the order and the camera plan). R28's budget gate stays hard | Jake: "Polish everything" → "Every seen m², full polish" |
| D61 | **Jake's go: not yet.** First a **visual dry run of the whole front** (P1–P6) on the fjord ("a frozen fjord where you are the last ferryman"), guided (Jake picks every step), as a throwaway prototype (D56) on `worldclaw-proto` (merged into `worldclaw`: D76), in parallel with the tool mockups (D64) | Jake: "See a visual dry run first"; "Through the mockups"; "I pick, as in a real run"; "In parallel" |
| D62 | **Three skills**: `worldclaw-auto` (fully autonomous, today's zero-shot), `worldclaw-interactive` (Jake in the loop: the front's boards, the play gates, a checkpoint per place, steering, polish; it absorbs `worldclaw-visdev` and the iterative outline), `worldclaw-sketch` (fast low-poly exploration). Supersedes D4's flow split and the visdev / autonomous split | Jake: "I'd much rather have two to three skills. One for fully autonomous, one for like super interactive, human in the loop, checkpoint, review boards, iterative steering, polish" → "Three skills" |
| D63 | **The interactive build checkpoints every place**: each place's composition and its placed result come to Jake as a board, and he steers before the next place. D15's "no interrupts during the build" now holds for `worldclaw-auto` only | Jake: "Checkpoint every place" |
| D64 | **A companion plan, WORLDCLAW-TOOLS** (`docs/plans/WORLDCLAW-TOOLS.md`), with its own mockups, its own brainstorm and questions with Jake, and its own council later. First mockups: Draft mode / the Shard Atlas (private review + a public coming-soon), Map Lab, Composition Explorer, Coverage Explorer, as image mockups | Jake: "we want a secondary companion plan … a WorldClaw tools plan"; "that tools plan needs its own mock-up of the tools … its own brainstorming … its own counsel run on that later" |
| D65 | **Draft shards and Draft mode**: from the start of a new shard, its card is on the deployed deck as "Coming soon" (no Model / Set / World Explorer yet); with developer tools on, **Draft mode** (a mode before Explore World) shows the front's pitches, bible, concepts, map, mockups, prototypes and clean-room results, and the draft tools. It replaces image-in-chat review for everything before a partial world (WORLDCLAW-TOOLS owns it). **Revised by WORLDCLAW-TOOLS J21:** review and answers stay in chat (one titled set per stage, the map first); the drafts site is the history | Jake: "as you start working on a new shard, you immediately get to go into draft mode on the deployed website and you get to like touch and feel and iterate … before we have a partial shard" |
| D66 | **The map and the first-person views are the core review, in two waves** (P5, P6, and every later look at the world). **Wave 1 (P5), choose the map:** the illustrated map with **numbered** place labels + an **8-angle World Explorer view** of the whole shard (N, NE, E, SE, S, SW, W, NW, ~130 m up, every place placed from the map's coordinates), sent together so Jake can page through them on Claude iOS; he approves or revises the map. **Wave 2 (P6), only after:** the **first-person mockups**, one per place in the map's numbering, framed from cameras placed on the approved map (each prompt lists what that camera sees left, right and ahead), sent with the map. Every image carries a burned-in title strip (number · place · role) outside the frame. Map variants must differ in kind (different layouts), not repaint one layout | Jake, the fjord dry run: "you forgot the map it's impossible to review without also sending the map"; "the mockups don't have a little title on them"; "if we did a 8 angle mockup of the world map in the world explorer that would help a lot"; "All these map plus first person view are the most important to review"; "I mean first you have to choose map and world explorer views lol. The first person it's two waves"; "They all look the same lol" |
| D67 | **The map must show the shard contract and safe routes.** Every map variant shows the **four edge exits** (N, E, S, W roads to the neighbouring shards, gated) and a spawn on land with clear access; spec-check refuses a map whose spawn is a bridge or whose edge roads don't reach the boundary. **No accidental boss fight:** the boss place is never on a through-route without a summon; a quest step (e.g. ringing the drowned bell) wakes the boss, and the routes past it are safe until then | Jake on map A: "you must have access on all on west, east, south, north … the south landing is a mess and needs to be a clear landing with access"; "as you're navigating from the village to the rest of the content, you don't want to accidentally start the fight with the final boss" |
| D68 | **World views come from one 3D blockout, painted over.** P5's top-down map and every World Explorer angle are renders of one Blender blockout built from the map (Eq. 6 terrain from the regions, roads, simple shapes at every place, the edge gates), then each render is painted by codex keeping every shape. Never generate the angles independently: they drift and invent features (two lighthouses). **The paint-over treats the blockout as a layout guide only** (coastlines, roads, landmark positions) and targets the fidelity of the approved concept views, passed as references; a smooth, 1 m blockout (no stair steps); a painted angle that adds a landmark is re-rolled. **A revision's review set is a new map + ONE 3-in-1 image** (three World Explorer views side by side, painted in a single codex generation at its largest size, guided by the three blockout renders stitched together and the new map), never eight separate views: codex has no spatial memory across images (Jake). T2 / T4 make the blockout (with Map Lab, WORLDCLAW-TOOLS); map variants differ in layout, each with its map + 3 views | Jake: "the three views are not internally consistent with each other … I don't know if that can be fixed" → "3D blockout, painted"; then "generate a brand new revised map and three World Explorer views … a single 3-in-1 image with Codex … that shows three world explorers side by side from three different angles"; "We lost all of the graphical fidelity … the eight mockups are way too close to a low poly blocky Blender style … I need them to look like the other ones"; "we need to view lots of variants that are like map A + three world explorer views A and then do the same for B, C" |
| D69 | **The blockout encodes what a painter must not misread**: frozen water is dead flat (ice lanes are flag-marked, ice-coloured, never road-coloured stripes, or they paint as walls); open water and the landform's identity (a fjord stays a narrow cliff-sided inlet) are modelled, not left to the paint; a pit is a negative shape (the quarry); a glacier is a tongue mesh, not boxes; the spawn is marked; a hub gets its own small street plan at P5. Even so, painted angles stay only roughly consistent: good for a feel, and the exact views come from the grey world at P8 | Jake on revised A: "the ice should be flat"; "the fjord's completely gone … add the fjord back"; "the quarry should be a pit"; "a bunch of blocks behind the glacier"; "it's not clear exactly where I start"; "the village needs … more planning"; "these eight mock-ups are nowhere near consistent. But that's fine" |
| D70 | **Content gets its own review boards, as visual as the art**, before the first-person views: (1) the **player journey** drawn on the approved map (the critical path as numbered steps: where the player goes, why, what they do, what they get); (2) the **quest and narrative chain** (main quest steps, the antagonist's setup, how the boss is reached); (3) **side content** (side quests, feats, secrets, collectibles, NPCs, rewards) per place; (4) the **session slice**. Structure options come as A / B / C like the pitches (e.g. a linear chain, hub-and-spoke keys, signal-lit unlocks). Content is never drafted into `design.md` without being shown | Jake, the fjord dry run: "there was a quest objective inside the glacier all this time … We didn't review anything about the quests … the scenarios … the slices … the gamer's user journey through the 12 places, where he's going, why he's going, what he's doing in each place, what narrative … is making him go places … We've not been reviewing any content" |
| D71 | **Every quest step is a 2x2 board**: slot 1 is the step's A → B journey on the approved map (code-drawn: the whole route dimmed, this leg lit, the step's why / what / gets under it); slots 2–4 are wildcards chosen for what the step means (a first-person moment of doing it, a second moment, a character or object model sheet, a fight). Content gets as much image effort as the world: a 12-step quest is 12 boards, sent as one set with the journey overview. Iterated like the art (revise a step, a slot) | Jake: "we need to put way more effort into the quest and the content, like, way more"; "every single step of the quest line is some kind of 2x2 image … one of those four slots being map and the other three of them being wildcard, depending on what that step of the quest means" |
| D72 | **The front's images are inspirational, not spatially exact.** The map, the places, the quest boards, the World Explorer views and the first-person views are designed together and must agree in substance (what is where, who, why); across 60–80 mockups they cannot agree pixel for pixel, so remaining spatial mismatches are resolved by the build (the grey world at P8 is the source of truth), not by more re-rolls. The quest board (D71) format is kept; where it sits in the flow is settled by D75 (P5b, after P5 and before P6) | Jake after the fjord content review: "I like this quest content board … I don't know where we should sequence [it] … all of it has to be designed together … the map, the places, the quest board, the world explorer views and the first person views … these mock-ups, by very definition of being mock-ups, they're not spatially coherent across a set of 60, 70, 80 images. So these are like inspirational mock-ups that go into the building" |
| D73 | **Each quest board lists the mechanics its step needs, and which the engine lacks** (each a cost and an engine / kit row). The fjord's review found four: an NPC interaction / cutscene moment (an NPC hands you an item in first person), a rope-grab traverse (the only safe way across unlit ice), a surface rule that refuses a tool (the hoverboard on ice, with a message), and the thin-ice mask itself. **Enemy density is a pitch-level dial**: a shard may be sparse (Thin Ice: crawlers, one mini boss, bears, few pockets), its content traversal and discovery | Jake on the fjord's quest boards: "this feels like a cutscene, and we have no cutscenes in the engine. So, yeah, that requires some work"; "the ice can only be crossed when you interact with the rope"; "the hoverboard can't be equipped on the ice"; "cool to try a shard where we don't pump it full of enemies" |
| D74 | **The pilot is Thin Ice** (the fjord dry run's shard). Its shard plan is [THIN-ICE](THIN-ICE.md). Its front (pitch, style, concepts, map, content round 2) carries over from the dry run and is re-checked at P0–P6 with the built tools; the P-rows below run on it | Jake: "Yes, Thin Ice is the pilot"; "I'm not going to put this much effort into a dry run and then not build the shard" |
| D75 | **The content boards sit at P5b** in every run: after the map (wave 1) and before the first-person views (wave 2), so the views can show quest moments; the pitch (P2) picks the journey structure. Answers §7 Q4 | Jake: "P5b, after the map" |
| D76 | **One WorldClaw branch; the prototypes become the tools.** `worldclaw` holds the three plans, the skills and the prototypes (`prototypes/worldclaw/`, ~208 MB, 200 MB of it images); `worldclaw-proto` is merged into it (`43369eff`) and its worktree is gone. Supersedes D56's "own worktree and branch, never merged". **What the prototypes proved is converted into the tools, or redone as tools** (WORLDCLAW-TOOLS J20), by the rows that own it: `schematic.py` → T2; `terrain_vis.py` → T4, T5 and Map Lab (W6); `place_solve.py` → T8; the paint-then-lift test → T6, T8, P12; `run_jobs.py` → T14; `blockout_data.py`, `blockout.py`, `cam_pick.py`, `minimap.py`, `label_map.py`, `title_strip.py` → T19; `board.py`, `compose_steps.py`, `content_c.py`, `journey.py` → T11, T20. Each of those rows reads its prototype at the archive tag. **Thin Ice's dry run** enters as the pilot's draft at TI0 / P0 (J18): its design docs in `src/shards/thin-ice/design/`, its ~100 MB of original images in `art/thin-ice/round-<n>-<stage>/` (every decision's images, rejected options included; THIN-ICE §4.1 lists them), shown on the drafts site; the ~100 MB of copies made from them (titles, boards, numbered maps, the sets sent to chat) stay at the tag, since the tools re-make them. Until the merge, Jake keeps everything as it is. **After GAME-NORMALIZATION is archived:** tag the tip `worldclaw-archive` (local), merge into `main` without `prototypes/` (the originals moved to `art/` as above), then remove the worktree and delete the branch **Done 2026-10-01:** tagged `worldclaw-archive` (`1436c063`) and merged into `main` without `prototypes/`; the originals in `art/thin-ice/`, `art/worldclaw-tools/`, `art/worldclaw/` (JPEG, a README per round); Thin Ice's design docs in `docs/plans/thin-ice/dry-run/` | Jake: "Can we just have one workflow branch? And once normalization is done, we can merge and delete all the work trees"; "Those 200 megabytes of images is something that we need for the draft of Thin Ice. Honestly, I'll keep those for now"; "everything that [the prototypes have] proved, we're just gonna put it into tools or convert it into the tools or redo it so the tools comes in" |
| D77 | **SHARD-CHECKPOINTS merged in** (E406): a shard grows **grey world first, then checkpoints**. A new shard runs the front and the grey world as written; every place of its build is then a **checkpoint** (§2b). (Its existing-shard half is withdrawn: D90.) SHARD-CHECKPOINTS is archived as merged; its PDFs stay as history | Jake: "The goal is to merge them but I don't want to merge them blindly: pair, brainstorm and grill me"; M1 "Grey world first, then checkpoints" |
| D78 | **A checkpoint keeps SHARD-CHECKPOINTS' four gates** (Frame, Form, Play, Pin) **and boards**: the agent brings as many boards as it sees fit; there is no one-board rule. Refines D63 | M2: "Both four gates and boards. There's no one board only rule. As many boards as the agent sees fit" |
| D79 | **A pinned place deploys, still hidden**: on a new shard each pinned place ships with the next deploy inside the hidden shard (Developer on to walk it); the shard opens to players at P17 | M3 "Deploy, still hidden" |
| D80 | **One skill**: `shard-checkpoints` folds into `worldclaw-interactive` (its build chapter is the checkpoint; §S stays a director's one-stage call); the old skill becomes a pointer | M4 "Fold into worldclaw-interactive" |
| D81 | **The agent measures every place before the pin** (the iOS Simulator and the phone tier: load, frame rate, memory) and pins on that; Jake's iPhone is needed at the play gates (P7, P9) and his first walk (P17), and whenever he wants | M5 "Agent measures, you play at gates" |
| D82 | **Models: the catalog batch, re-checked per place.** P11 makes and shows the catalog (every side, the Model Explorer); a place's Form gate shows only its new or changed models, in place | M6 "Catalog batch, re-checked per place" |
| D83 | **Place order: the golden path, and Jake picks.** After each pin the agent proposes the next place along the golden path (the session slice first, each place's close band first); Jake picks the next place. Refines D60's order for the build | M8: "Golden path but also pick each next place" |
| D84 | **(Withdrawn by D90.)** **On a live shard the slice in progress is public as it is built** (existing shards: Nine Dragon, Pine Hollow, …); a pin is the approval, not a release gate | M11 "Public as it's built" |
| D85 | **(Withdrawn by D90.)** **An existing shard's light front**: `design.md` + `spec.json` written from the live shard (places, routes, critical path, verbs) in T1's formats, a top-down map and World Explorer views captured from the real world; Jake confirms its pillars and next slices in one pass. No pitch round, no drafts-site history | M7 "A light front first"; M9 "Design + map from the live world" |
| D86 | **(Withdrawn by D90.)** **Nine Dragon's light front now, pausing its slice in flight**, made by the WorldClaw tools agent | M10 "Now, pausing the slice"; M13 "This agent" |
| D87 | **T1 splits**: its **formats** first (the `design.md` template with its machine block, the `spec.json` schema: row L1, done); the checks stay in T1's place (D89 withdrew the Nine Dragon front they were to validate) | M15 "T1's formats now, checkers later" |
| D88 | **The merged plan keeps the name WORLDCLAW-SHARD** and goes through a full council (COUNCIL.md, at most four rounds) | M12 "Keep WORLDCLAW-SHARD"; M14 "Full council" |
| D89 | **Nine Dragon is not a WorldClaw shard**: no light front, no slices; it keeps NINE-DRAGON-STACK and its own loop (a director's single stage excepted, D91). Rows L2 and L3 are dropped; its design files are removed (its captures stay as history) | Jake: "No I don't think we can do nine dragon worldclaw it's too much of a partial shard"; "Remove the design files, keep the captures" |
| D90 | **WorldClaw builds new shards only**: the existing-shard path (D84–D86, §2c, the skill's §X) is dropped; existing shards keep their own plans and loops; one exception, D91 | Jake: "New shards only" |
| D91 | **A director's single stage runs on any shard** (the skill's §S, 06 §9 / §10.2), Nine Dragon included: the exception to D90. On a shipped shard it writes `design/design.md` with a **slice-scope** machine block (no `run`, never resumed: MC47) and a slice spec (T1 `--scope slice`) from the director's plan, and keeps the shard's terrain (T17 content-only); it is the director's call inside that shard's own plan, never a WorldClaw run (no light front, no checkpoints, no takeover). Its outputs ship as built (D92). For §S only it overrides D89's removed design files | Jake, E406 round 3 (MC36): "Any shard" |
| D92 | **A director's stage ships as built** (MC48): no per-content Debug row. Visibility is the shard's: a partial shard says partial or experimental in its status and sits behind the Developer menu, which shows partial work to players as COMING SOON | Jake: "Ship as built. Partial shards should say partial or experimental and be behind the developer menu. The developer menu hides partial work as coming soon" |

### 0.3 Lead resolutions (the design choices; the council may challenge them with evidence)

The council's round-1 finding IDs are in brackets; [the register](worldclaw/reviews/register.md) maps every ID to a fix.

| # | Resolution | Why |
|---|---|---|
| R1 | Layout maps, final concepts, mockups, targets, compositions and every reference that becomes a shipped model come from **codex `image_gen`**; Qwen-Image-2.1 explores (D50). The per-kind engine table is [06](../design/worldclaw/06-shard-flow.md) §10.6 | the paper: open image models fail at layout maps; Qwen's research licence |
| R2 | **No SAM3 / SAM3D**: a new object is re-drawn by codex isolated on white (its crop + the whole composition as inputs), then image-to-3D | no MPS; §10 PC3: the re-draw is faithful |
| R3 | **Placement by a ray from the recorded camera**, through the physics query layer (`castRay` against registered colliders) and then the **baked terrain sampler** (the surface the player walks). Each object names its support (`on: terrain` or a Set member). Game code never hand-rolls terrain bisection (AGENTS.md ▸ Physics). Position and yaw come from the composition; **size from the size class**, and the implied size is a check (flag > 30 % off) [A5, B9, C45] | §10 PC2: positions exact, implied sizes ±20–30 % |
| R4 | **The cube is a new `extent: { below, above }` field** on the manifest and `LevelSpec` (E1). Defaults are each shipped shard's numbers today, so they stay identical. `placement.size` stays the map footprint. Shared with NINE-DRAGON P2-E1, whose own spec names the same field [B2, C2] | every normalized manifest already sets `size: [500, 500, 500]`, so size can't say slab or cube |
| R5 | **Pads** are terrain data applied after the graded routes and never overlap a route corridor (where one must, it takes the route's shelf height). **Place pads** (P8): walkable inside the radius, no steeper than the player's max climb (40°, Jake's pick, AGENTS.md ▸ Physics) (§10 PB1); when the cut / fill would reshape the region, raise the region's edge ramp instead; **only while P8 is open**, move the place inside its region (logged; 06 §10.3's rung-2 row); else rung 3 (06 §10.4). From P9 on a place moves only by Jake's note [R4-A5, R4-C3]. **Object pads** (P12): a small cut / fill, else move the object along its composition ray to the nearest walkable spot. Never `cabinSites` [B10, C15, R2-B10] | `finish()` runs after `graded` (terrain.ts) |
| R6 | **The judges** (06 §6): every judge scores every option on every line (1–10); an option's score is the mean of its lines. **Picks:** the highest J1 + J2 mean wins when J1 and J2 rank the same option first, else J3 joins and the median of three wins; ties → the first rubric line, then lower cost, then the earlier option id. **Pass / fail gates:** each judge marks each line pass or fail with its evidence; a line passes when J1 and J2 both pass it, and J3 decides a line they disagree on; no evidenced must-fix (E388: no invented score bars). Judges read **frame strips, numbers and runner logs, never video**; style checks are batched; every call is logged [A10, B15, C11, C12, C39, R2-A10, R2-B16] | D27; judges can't watch clips |
| R7 | Kit pieces and code models are the default for repeats; generated models are for hero silhouettes and places whose `catalogMode` is `generated` | D9 memory and draws |
| R8 | Every path is written against the normalization spec (`docs/plans/game-normalization/` at `pre-normalization`); **N0 re-grounds every path on `main`** before any other row, except L0 and L1 (§5) | the engine is being rewritten now |
| R9 | Tools live in `scripts/worldclaw/`; Eq. 6's operators start as shard code and move to the kit by the rule of two | GAME-NORMALIZATION's kit rule |
| R10 | The grey gates use **the sketch look and kit** (E8a + T17), so a greybox builds in minutes and is never mistaken for art | D41 |
| R11 | **Polish bands as the order** (§10 PB2). T5 bands every 2 m cell by its distance to the nearest viewpoint that sees it. The viewpoints sit along the **eye paths of every enabled movement mode** (walking at 1.7 m, riding, gliding, swimming), plus every beat place. Close (≤ 30 m), mid (30–80 m) and far (> 80 m) all get **full polish** (D60), in that order; never-seen land gets nothing. The bands also plan the cameras: close-band compositions per place and route leg, mid / far compositions from crests and vistas [A14] | D43, D60; a 500 m shard sees nearly all of itself |
| R12 | **Happenings** are an engine mechanism (`'happenings'`, beside the engine's quests). The world data holds each spot, radius and signal placement (`level.world`); `rows.happening` holds trigger, objective, timer, outcomes and reward, registered at `level.kit` and keyed by the spot id; activation binds them at `level.play`. Fights are delegated to `EncounterService.spawn` / `elite`; everything disposes on unload [A16, B16, C43, R2-B5] | 01 §7 stage order (world → kit → play); quests are `#engine` |
| R13 | **The verb gate comes after the mockups** (D57). A verb is **existing** (in `#engine` / `#kit`, including the zipline and rope bridge after E9), a **moved toy** (still another shard's code: the grapple, riding; a kit move, row E9b, + N days) or **new**. For a moved toy or a new verb, P7 runs after P6 (after E9b for a moved toy) and before P8. A "dull" verb redoes P2's verb line and the concepts and mockups that show it [B14, C10, R2-C12] | Jake's §7 Q1 answer |
| R14 | **One path table** for the run's files: [06](../design/worldclaw/06-shard-flow.md) §10.1. The director's design lives in `src/shards/<slug>/design/`, linked from SHARDS.md (D58, §7 Q2 answered) [B4, C8] | three docs disagreed |
| R15 | **The twins.** `design.md` carries one fenced machine block (` ```json worldclaw `: JSON since L1, so the checks need no YAML parser; its schema is `scripts/worldclaw/spec.ts`) with every row twin-check compares: places, roles, beats, happenings, NPCs, enemy zones, elites, the boss, quest steps, routes, gates, the slice and the run scope. twin-check compares **ids and values**. `design.md` owns intent (roles, beats, Jake's words); `spec.json` owns numbers (coordinates, terrain, budgets). Both checks run after every steer [A3, B19, C13] | D52 "one source" |
| R16 | **Hard and soft gates** (06 §10.4): a hard failure is never marked done. It climbs a ladder: a local fix → the gate's fallback → a decision (rung 3) → a fix beyond its bounds (rung 4). **The decision (rung 3), by mode and phase** (06 §5's table): guided before P9 → Jake; zero-shot before P9 → the judges, who may also move a place inside its region (logged); from P9 on, in both modes → **the judges, inside the approved design** (they may resize, re-seat, re-dress, swap or move an object; never cut a D25 must, a pillar, a place, a beat or a happening, change a role or the critical path, or force a P9 replay). **Rung 4**, a fix beyond those bounds: guided before P9 → a blocked Handoff that holds the work depending on it (06 §10.7's waiting rule); guided from P9 on → a **blocked branch** (the stage is `done (blocked: <ids>)` and the run goes on; at P16 each branch is one question with a recommended answer and its cost; the answer is applied by its 06 §10.3 row, then P14–P15 re-run on what it touched and the changed board panels are re-sent, all before P17); zero-shot → the judges take it, logged. Each judges' decision is posted as "decided for you" (the live page, else the daily summary and the final board) and Jake can overturn it with a note. A required slot is never left empty by the style ladder [A6, B40, C47, C49, R2-A3, R2-B7, R2-C2, R2-C3, R2-C7, R3-B4, R3-C4, R3-C5, R4-A4, R4-B3, R4-C4, R4-C11, R4-K1] | "take the best state" must not pass a broken gate; D15 |
| R17 | **Run scopes**: `world + all content` (default), or `world + one session slice` (the world complete; content = the slice's real grey content; the golden path = the slice). "World only" is gone, because it broke D37 and left P9 nothing to play [A7, B6, C34] | D37, D41 |
| R18 | **Zero-shot dispatch** (06 §8): the invocations are 06 §8's (`/worldclaw-auto zero-shot <sentence> [as <slug>] [until P<n>]`, `… zero-shot <slug> until P<n>`, `… resume <slug>`); nothing is asked; delivery is the final (or partial) board + time-lapse unless the invocation asks to follow along. The judges take P2–P6; **existing verbs and controls only, so no P7 and no moved toys**; content caps: a kit weapon, ≤ 1 new species, a boss on a kit stand-in, ≤ +3 agent-days of adds; P8–P9 judged from strips + T16's log. Every zero-shot run is launched through T18 by the session that receives it (the launcher, which runs nothing itself); T18's workers (`WORLDCLAW_WORKER=1`) run the shard ([06](../design/worldclaw/06-shard-flow.md) §8: the literal invocations, the slug passed as `as <slug>`, §run's `stop`, the relaunch loop); never a subagent [R4-B7, R4-C8, R4-C14, R4-K2]. Recording is always on [A8, B8, B31, C42, R2-A9, R2-B6, R2-C14, R2-C16] | D51 |
| R19 | **Recording vs delivery.** The progress cameras are always shot, into the durable, uncommitted folder `~/.cache/wildshard-worldclaw/<slug>/frames/` (its path in `design.md` §run; copied to the scratchpad only to publish). Follow-along gates delivery only. Committed: milestone frames (JPEG, `art/<slug>/round-<n>-progress/`) and the final time-lapse. A late time-lapse uses only retained frames and says what it covers [A9, B20, C25, C26, R2-B11, R2-C4] | D16 / D35; a session scratchpad doesn't outlive the session |
| R20 | **The live page** (superseded by WORLDCLAW-TOOLS: the drafts site and the auto-made artifact page, J17, J25) is **read-only**: Jake's answers and notes come in chat only (J17, J21) and are logged at every step boundary; every approved image + the latest progress frame per stage as assets, paginated per stage. Chat notes are the fallback [A17, B37, C25, R2-B14, R2-C26] | D35, D36; ≤ 511 files / 256 MB per version |
| R21 | **Invalidation and precedence** ([06](../design/worldclaw/06-shard-flow.md) §10.3). Each change type lists what is redone, kept and held. Jake's notes override the bible and the judges (logged; the bible version bumps). A gate-reopening note holds only the places whose cells it touches [A11, B42, C32, C37] | steering without losing work |
| R22 | **Handing Jake a build.** The pilot stays `status: 'hidden'` until Jake's word after P17 (in either mode); its bakes run because it opts in while hidden (E10). Deploy: push → CI and **`gpu-gate`** green → `gh workflow run deploy` → `version.json` shows the SHA or a newer one containing it. The taps: Settings ▸ Debug ▸ Developer tools ▸ `showHiddenShards` → the pilot's card [B18, C17, R2-B4, R2-B15, R2-C27, R3-B16] | a PWA has no address bar (D10); hidden shards skip the bakers |
| R23 | **Resume** (06 §10.7): `design.md` §run holds (06 §10.7) the mode, the `until` bound, P0's answers, step, waitingOn (timed) with `resentAt`, `stop`, next, the build SHA, the live page URL, the frames folder, the pending board and queued commands; updated at every step boundary, with the ask's Status and the Handoff current at every commit. Start independent work before asking; or post the board and end the turn. A pending answer holds only the work that depends on it; every session's start re-sends a board waiting > 48 h once (recording `resentAt`), then stops with a Handoff when `resentAt` is > 48 h old [R4-B14, R4-C9]. A codex quota stop records the reset time and stops [C18, R2-B12, R2-C11] | AskUserQuestion blocks the session; no session can wait 48 h |
| R24 | **Iterating is `worldclaw-interactive`'s** (D62: the old iterative outline is absorbed): a checkpoint per place in P12 (D63) and polish rounds after P17; P17's notes are fixed in this run, leftovers become asks [B5, C35] | D4, D62, D63 |
| R25 | **Traversal.** Route legs are typed (walk, swim, ride, zipline, glide, grapple), and traversal links have mechanically tested landings and exits. Reach = the navmesh + tested links. Every traversal slot and every secret hint gets approach and activation views and a clear cone, checked by T9 after dressing [A14, A15, B35, C36] | a walking navmesh can't see a glider ledge |
| R26 | **A walk-inside building is CODE whole** (shell + interior), styled to its composition. Generated shells are for buildings never entered, with the door shut by a box collider [C48] | D19's two rules met in one building |
| R27 | **Targets are player views.** Every place's target is framed at eye height on a route or vista where the place is revealed. Elevated views are concept art only [C28] | R11 polishes what is seen from routes |
| R28 | **The budget gate** is the stricter of D9 and the normalized engine's derived per-pose budget (01 §13.4), and includes GPU MB. A model's texture size follows from that GPU-MB budget, not a fixed cap per size class (E388) [B32, C29] | the normalized gate fails a shard on derived numbers |
| R29 | **Skills called by the build** (mockup-to-model, LOOK-LOOP) run without their "ask Jake" steps. The judges take those calls, and LOOK-LOOP's owner sign-off is the judges' plus a 12-frame orbit strip [B41, C16] | D15, D27 |
| R30 | **X1 runs in a hidden lab shard** `worldclaw-lab`, never in `_template`. Its answer is data: `scripts/worldclaw/scatter-sources.json` (kind × asset route → pipeline), which spec-check reads. P7's playground lives in the pilot (`ctx.playground`) [B21, C24] | the template is the gate's teaching copy |
| R31 | **One route grade.** `TerrainSpec.graded` has one `maxGrade`: every route uses tan 40° (≈ 0.84), the player's max climb (Jake's pick, AGENTS.md ▸ Physics), so a graded route is never steeper than the player can walk, with benches across slopes [B11] | ChunkDef.ts:161; E388 |
| R32 | **The slop score** (06 §10.5): each first-walk note is sized L (reopens a gate) / S (one spot) / M (else), first match wins, with a reason, before the baseline (note ids + build SHA) freezes; fixes are tracked beside it [A18, B24, C38, R2-A12] | D40 needs a unit |
| R33 | **The gpu-gate matrix and its exemption.** A new shard joins the gate matrix by itself after normalization. The pilot, the lab shard and every zero-shot shard are **gate-exempt** (`gateExempt`, E10: `scripts/gpu-gate/matrix.mjs` skips such a manifest), so a red grey build never blocks anyone's deploy. **One lifecycle, both modes:** exempt from creation through P15, recording no gate baseline. A shard **leaves the exemption at P16 only with no open blocked branch** (else right after the last one's answer is applied, before P17): T5 marks its 3 `gate` legs, T6 adds its gate poses to the shard's `capturePoses()` (which `scripts/parity/poses.mjs` walks; MC50), its first baseline is recorded and `gateExempt` is removed; from then on every look, layout or content change re-records the baseline (03-harness-gate §16). Its status stays `hidden` until Jake's word after P17. A run bounded before P16 (P18, P19) never leaves it, and P18's shard is deleted after P19's board. **The lab shard** `worldclaw-lab` (X1, E9's fixtures, every P3 mini-X1) stays hidden and exempt for good [R3-B7, R4-A1, R4-B5, R4-B11, R4-C1, R4-C12] | 03-harness-gate's matrix lists every manifest; 5 macOS jobs run at once; budgets are checked per pose on every push |

## 1. Goal, done-when, non-goals

**Goal.** A WorldClaw toolset and its skills, so that:
- Jake can steer a shard from a sentence to a fun, polished, standalone level through images, two short grey play gates and a final walk;
- WorldClaw's techniques do the labour with less slop;
- the zero-shot mode can try one from a sentence alone.

**Done when:**
1. The pilot shard (guided mode) boots on the deck as EXPERIMENTAL with:
   - its approved pitch, style bible, concepts, mockups and targets committed;
   - D25's four musts;
   - its weapon, enemies and audio, and its boss when the run scope holds it (R17) [R4-B12];
   - content per its run scope (R17), including happenings;
   - 0 stuck on its walk legs (non-empty), every place, slot and happening reachable;
   - every pose within the budget gate (R28);
   - D21–D23 visible in the Explorers;
   - **Jake's physical-iPhone reading within 1.8 GB loading and 1.0 GB Explorer** (the method in 06 §7), recorded in the ask file.
2. **Jake's first-walk notes** are recorded as the slop score (R32). Target: none L.
3. **A zero-shot dry run** (P19) has produced a judged front log and a P8-clean grey shard.
4. The three skills (D62: `worldclaw-interactive`, `worldclaw-auto`, `worldclaw-sketch`) are rewritten from what the pilot
   taught, and a fresh main session runs the front from the skills alone (P18).
5. The pilot is **Thin Ice** (D74): it is the shard Done-when 1 describes.

**Non-goals:**
- return loops (daily seed, currency, medals; [GW2-ZONES](GW2-ZONES.md) §7, a later plan);
- neighbouring shards (D55);
- multiplayer;
- the sketch flow beyond its outline (the sketch look and kit, E8a, and the grey builder, T17, are in scope because the gates need them);
- any work before GAME-NORMALIZATION is archived.

## 2. The flow at a glance ([06](../design/worldclaw/06-shard-flow.md) holds it in full)

```
SKILLS worldclaw-interactive (guided, Jake in the loop) · worldclaw-auto (zero-shot, judges) · worldclaw-sketch (D62)
START  P0 questions: follow-along · run scope (mode comes from the skill and its invocation)
FRONT  (images, inspirational not pixel-exact: D72; Jake decides; D15/D46/D49)
       P1 vision → P2 three pitches (+ verb, weapon, enemies and their density, boss, journey structure A/B/C, any new
       HUD control) → P3 art direction + bible → P4 concepts
       → P5 the map, wave 1: design.md + spec, the map + a 3D blockout's World Explorer views (D66, D68, D69)
       → P5b content boards: the journey on the map, a 2x2 board per quest step with its mechanics, side content,
         the slice (D70, D71, D73)
       → P6 first-person views, wave 2, framed on the approved map: GO
       → [P7 verb gate, if a new verb or a moved toy: D57]
GATES  (play in grey; Jake decides; D41)
       P8 grey world + grey content (sketch look) → P9 session slice: YES → P9b re-target onto the grey world
BUILD  auto: the four gates run internally, the judges decide, Jake's notes only (D27/D36; §2b) · interactive: a checkpoint per place (§2b: Frame · Form · Play ·
       Pin; D63, D78), places in golden-path order with Jake picking the next (D83), each pin deployed hidden (D79)
       P10 look → P11 catalog → P12 places (paint-then-lift on every seen band, close first: D60) → P13 content + audio
       → P14 budgets → P15 final judges
END    P16 final board + time-lapse + physical-iPhone request → P17 Jake's first walk = the slop score (the arc gate)
ALSO   P18 clean-room front check · P19 zero-shot dry run
```
In **zero-shot** (R18), the judges take P2–P6, there is no P7 (existing verbs only), and the judges decide P9; Jake sees P16 and walks P17 [R3-B11, R3-C14].

## 2b. The checkpoint (from SHARD-CHECKPOINTS, D77–D83)

A checkpoint grows one place of a new shard's build (P12) while the rest stays playable and pinned. It keeps SHARD-CHECKPOINTS' four gates; the agent brings Jake **as many boards as it sees fit** (D78).

| Gate | The agent brings | Jake | Exit |
|---|---|---|---|
| **Frame** | the place's camera(s): a live portrait capture with the real HUD, the P9b target, the plausible in-engine next view at the same camera | a look direction, when taste is needed | one accepted camera and a limited scope |
| **Form** | the place's **new or changed** models in place, every side (front, sides, back, three-quarter), registered in the Model Explorer; the rest come from P11's catalog (D82); a model the place needs and the catalog lacks goes through `mockup-to-model` here (MC4) | approve, or name one form or material fix | the place's asset set |
| **Play** | a moving capture and a playable build: collisions, controls, hit or miss, landings; World / HUD Explorer evidence where it applies | one steering note on what reads wrong first | the place works moving, not only as a still |
| **Pin** | the agent's measurements (D81), recorded with the cameras and the build: T10 on the phone tier at the place's cameras (triangles, draws, GPU MB against the budget gate, R28; the frame time per camera, a Mac headless reading, reported, not gated); `scripts/sim-lane.sh run wildshard-iphone node scripts/sim-memory.mjs --url=<build> --shards=<slug>` (the 1.8 / 1.0 GB caps); the load time, `scripts/browser-lane.sh node scripts/bench-load.mjs --url=<build> --query='chunk=<slug>&tier=phone&skipintro=1'` (the same build; reported); the four CI gates; once the shard is out of the gate exemption (R33, after P16), its gpu-gate baseline re-recorded by R33's recipe; the shard's physical-iPhone reading is P16's (06 §7); a before / current / target board (MC5, MC8, MC9, MC25, MC38, MC40) | approve or revise | commit; the next deploy ships it, hidden (D79) |

- **Order** (D83): after each pin the agent proposes the next place along the golden path (the session slice first); Jake
  picks. Inside a place its bands go close → mid → far (D60), and the far vistas seen from it are its own; **the route
  leg into a place is part of that place's checkpoint** (MC11). Before Jake's pick, start only work that doesn't depend
  on it (the proposed place's captures) (MC10).
- **Content after a pin** (P13 on a new shard): content that lands on a pinned place (an NPC moment, a mechanic, props)
  re-runs that place's Form for every new or changed model it places, then its Play and Pin; a place is pinned again,
  never silently changed (MC12, MC42). A shard-wide pass (the score, ambience, SFX, credits) re-pins no place: P14 and
  P15 check it once over every place's strips.
- **A blocked branch** (R16's rung 4, guided from P9 on): a place whose only open failure is a blocked branch pins as
  `pinned (blocked: <id>)`, deploys hidden, and the next place opens; the branch is P16's question (MC41).
- **Engine code:** a place that needs a change to engine code shipping to the live shards (rendering, batching or memory
  policy outside the shard's folder) asks the engine's lead for it; that change carries its own physical-iPhone reading
  (AGENTS.md ▸ Rendering), never the place's Pin (MC40).
- A rejected variant is deleted with its Debug row. Internal nine-angle sheets and measurements are evidence, never nine
  decisions. A failed gate shrinks or polishes the same place; it never opens a new one.
- After a pin: `design.md` records the accepted camera, the assets, the gate evidence, the rejected variants and the next
  place; the drafts site gets the step (WORLDCLAW-TOOLS W13).
- **A hard failure** a checkpoint can't fix inside the approved design climbs 06 §10.4's ladder by its "from P9 on"
  rows: the judges inside the approved design, beyond that a blocked branch (MC4, MC23).
- `worldclaw-auto` runs the four gates **internally**: the judges decide every gate (D27) from frame strips and numbers (R6: never video; Play's moving capture goes to them as a strip, with the walk legs), no boards go to Jake, the next place is the golden path's next (no pick); Jake's notes only (MC6, MC30).

## 3. Rules for every row (after normalization)

1. **AGENTS.md as it stands then**: main checkout, pathspec commits, `scripts/push-main.sh`, the deploy rules. If a lock
   is still on, the shard's slug is reopened by its lead first.
2. **The shared machine.**
   - The model lock: batches < 30 min.
   - The browser lane: ≤ 4 browsers, sessions closed.
   - Served builds only.
   - Headless muted.
   - JPEG / WebP.
   - codex 4–6 runs at once (AGENTS.md ▸ Mockups).
   - The subagent caps: ≤ 3 live, ≤ 400 k, ≤ 90 min, ~200 turns, one job, a Handoff in the ask file.
   - Long waits belong to the main agent (`run_in_background`).
3. **Engine and Explorer rows** (E) carry the other-shards proof: identical programs, passes, draws and triangles;
   captures within noise.
4. **Every tool has a test** (vitest for pure code, a fixture run for scripts).
5. **Every row ends with evidence:** a commit, a number, an image path.
6. **Hard gates are hard** (R16). **Frame rate** (phone tier) is reported at every gate ([GW2-ZONES](GW2-ZONES.md) §4.3).
7. **The status line**: `set-label.sh` once per stage, from the main session only, with a tag ≤ 24 chars.

## 4. Rows

State per row: `todo` · `in flight (<owner>)` · `done (<commit>)` · `needs pick` · `dropped`.

### N: re-ground (first, after GAME-NORMALIZATION is archived)

| Row | What | Done when | State |
|---|---|---|---|
| N0 | Re-read `main`'s normalized code and update every path, type and API in this plan, the docs and the skills. That covers: `ShardManifest` / `LevelSpec`; Placement + scatter (01 §17); `place` / `placeSet` / `defineModel`; `EncounterService` (01 §19); quests and interactables as data; `#engine/explore`; the template shard (Z1); the model checks' successor; the bake / bake-check, navmesh, reach and walk scripts; the `style` union and `kitLook`; `WaterBody`; the harness params; **the derived phone budgets** (01 §13.4). Log each change in §9. Add `scripts/worldclaw/plan-paths.mjs`, which scans the plan, docs and skills for dead paths | §9 complete; `plan-paths.mjs` clean | todo |

### F: Jake's fun rules (once, global)

| Row | What | Done when | State |
|---|---|---|---|
| F1 | **The fun-rules page** (D54): Jake's dated taste quotes from the ask files (E359 holds all of this session's), memories and plans, compiled into `docs/design/fun-rules.md`, one rule per line with its date and source. A board-style page; Jake confirms or strikes lines | Jake's confirmation recorded; T12 reads the page | todo |

### X: decide-by-demo

| Row | What | Done when | State |
|---|---|---|---|
| X1 | **The scatter tech demo** (D20, R30) in the hidden lab shard `worldclaw-lab`: one 60 × 60 m patch, three times: (a) code / Blender species, (b) image-to-3D (TRELLIS + Hunyuan3D-2), (c) stock CC0 / CC-BY (credits recorded). Each has a tree, a bush and a rock family with variants, LODs and impostors; same camera, light and density; both asset routes (stylized and photoreal) where an approach supports them. Per approach: 3 portrait frames, a 20 s clip, and the numbers (triangles, draws, minutes per kind; memory **relative**, the same conditions for all three; absolute memory is P14's) (T7, T10, T11). One A/B/C board [R2-C17] | Jake's pick (or a mix per kind and route) written to `scripts/worldclaw/scatter-sources.json` | todo |

### E: engine, game and Explorer rows (the other-shards proof on each)

| Row | What | Done when | State |
|---|---|---|---|
| E1 | **The cube** (D24, R4): `extent: { below, above }` on the manifest and `LevelSpec`. Terrain range, slab depth, the horizon cloud sea, the boundary lines, the navmesh height range and the bakes read it; the shipped shards default to today's numbers. **One row shared with NINE-DRAGON P2-E1: whichever plan reaches it first builds it** (D59) | a fixture shard spans −250..+250 m; the shipped shards are byte-identical in bakes and captures | todo |
| E2 | **World as data** (D17): a generic placer for `src/shards/<slug>/world/*.json`. It reads placements per model (pose, `variant`, `params`, `color`), the draw options (`draw`, `cull`, `cell`), Sets (`id`, `name`, `place`, `members`, `target`; `file` = the JSON path), scatter rules (model, region, sampler, density, slope / height bands, culling, **`exclude: routes · pads · clearZones · sets` + a margin**), pads and happenings. The shard's models index exports an id → `ModelDef` map. **The model checks' successor reads the JSON** (every named place has a Set, every member and model id resolves), and the pilot's named places are registered. **The navmesh bake includes JSON-placed colliders.** A JSON Schema lives in the repo [A4, B3, B38, C27] | a fixture world loads identically to the same world in code; the model check fails a deleted Set, a dangling member and an unknown place; the navmesh contains a JSON-placed wall | todo |
| E3 | **Model provenance** (D21): `defineModel({ provenance?: { ref, composition?, place? } })`; the card shows the two **phone copies** (06 §10.1: `public/assets/explore/<slug>/…`, made by T7 for emitted models; E3's fixture copies are made by hand [R4-C16]) and links the Set [R2-A11] | a fixture card shows both images on the phone | todo |
| E4 | **Set target vs built** (D22): `placeSet({ target?: { image, cam } })`, `image` a phone copy (06 §10.1, made at P9b); the Set Explorer shows it beside the live Set framed from `cam` | a fixture Set shows both at one camera | todo |
| E5 | **World Explorer channels** (D23): lit / instance (a stable flat colour per model id) / normals / depth, as a Debug row (`explore.channel`) that scripts set with `debugSettings`; a viewer switch only [B36, C46] | all shards render the four channels; each channel's frame time reported beside lit; **Explorer memory ≤ 1.0 GB with each channel on** | todo |
| E6 | **A new look, kit included** [B13, C23]: the pilot declares its own look with no engine edit, and **`kitLook` becomes open**, so the pilot registers `creatureLook(name, factory)` and the kit material factories for its look | in a fixture look, the kit boar and the kit sword pass T12's style check | todo |
| E7 | **Happenings** (D44, R12): the engine mechanism, the `rows.happening` verb, the world-data spot. A row has: a spot + radius; a trigger (arrival, a short clock, a chain, the player); an objective template (chase / hunt, race / courier, hold against telegraphed waves of ≤ 2, a timed puzzle, an elite duel; escort marked avoid); a visible timer; success and fail outcomes; a participation reward; a signal with `seenFrom` | race and hold fixtures run start → fail → retry → success → unload **in the fake `Game` (sim-no-render, no browser)**; signal visibility is checked later by T9 [R2-C1] | todo |
| E8a | **The sketch look + kit** (R10): one flat low-poly look (the manifest's `greybox` style as its seed) and code models `shared/sketch-*`: block buildings, cone and blob trees, low-poly rocks, bridges, stairs with treads, walls, fences, arena cover, zipline posts, grey creature, NPC and boss stand-ins (greyBlob-style, the rig contract's clip names) [C5], and a generic prop block for a quest prop [R4-B10]. The spec → grey world builder is T17 [R2-C1] | a fixture scene of every piece; the grey boss stand-in runs its phases | todo |
| E9 | **Traversal toys into the kit** [C4]: the zipline and the rope bridge move from Driftwood's shard code into `#kit` (the pilot is the second user); and the **non-walk leg contract** every typed leg uses: a leg `{ kind, launch, target, radius, exit }` and the headless runner `scripts/worldclaw/leg-test.mjs` (launch → landing inside the target's radius → a clear exit), the kit zipline its first test [R4-B9] | Driftwood identical; in the lab shard a fixture zipline passes `leg-test.mjs` and a fixture bridge the walk test | todo |
| E9b | **A moved toy** (R13), only when the picked pitch takes one: the grapple or riding moves from its shard into `#kit` (the rule of two), with the other-shards proof; + N days in the pitch [R2-C12] | the toy's home shard identical; the toy works in the pilot's playground | todo |
| E10 | **Hidden shards for WorldClaw** (R22, R33): manifest flags `bakeWhileHidden: true` (the navmesh, KTX2, pack and unused-assets bakers include the hidden shard) and `gateExempt: true` (`scripts/gpu-gate/matrix.mjs` skips the manifest until P16 removes the flag); and **the hidden lab shard `worldclaw-lab`** (from the template, kept for good: R33) that X1, E9's fixtures and P3's mini-X1 use [R2-B4, R3-B1, R3-B15, R3-C3, R4-B5] **[TOOLS]** the lifecycle gains **draft** (data only) before `hidden`: P0 creates the draft on the drafts site; the manifest arrives at P7 / P8. | the lab shard gets its four bakes while hidden and no gate job; the shipped shards' bakes byte-identical | todo |

### T: the tools (`scripts/worldclaw/`)

| Row | What | Done when | State |
|---|---|---|---|
| T1 | **The twins** (D87: the formats are row L1, done; the checks are this row): over L1's `design.md` template (its machine block, R15) and `spec.json` schema. `spec-check.mjs` enforces [06](../design/worldclaw/06-shard-flow.md) §10.2's rules: the required roles, "discovery place" = a place with a map pin and a discovery event, `catalogMode ∈ { kit, generated, mixed }`, `heightRange` from the extent, the summed triangle and GPU-MB estimate within the budget gate (R28), `scatter-sources.json` obeyed, id prefixes. `twin-check.mjs` compares the machine block with `spec.json`, ids and values. **`--scope slice`** (a director's shard, 06 §10.2): ids, heights, the slice's places inside the shard, routes as typed legs, happening signals and approach views stay on; the 8–12 places, the required roles, the entry roads, the estimate and the region rules are off. twin-check is skipped, and logged, on a single stage whose design has no machine block [A3, B19, B30, B43, C13, R4-B8, R4-C10] | fixtures: a valid pair passes; one fixture per rule fails with its message; "a trader in design.md, none in spec.json" fails; a slice fixture passes `--scope slice` and fails the full scope | todo |
| T2 | **Schematic + illustrated map**: spec → a 512² schematic (square, roads, places, routes, sightlines, happening spots; `worldclaw@0825a9f5:prototypes/worldclaw/schematic.py` is the reference); the illustrated map is T19's top-down blockout render painted over by codex (D68), with **labels composited by code** over it. It is review art only, not the in-game map [B28] | pixel checks on the schematic; a label sheet over a fixture map | todo |
| T3 | **Mask score + bake** (§10 PA): the gate is places-in-region 100 % + every route on walkable ground + roads untouched; palette fidelity is reported (PA measured 94.9–97.9 %); specks too small to hold a place merge into their neighbour (PB1's spikes). **When all three maps fail, stamp each place's region disc (its radius) from the schematic over the best variant, and log it** [C47]. `--bake` writes the region weights as world data. **Freshness by the normalized bake's output-byte comparison**, not a source hash [A2] | three fixture maps ranked right; a changed region cell or pad makes the bake check name the stale output; a no-op source edit re-bakes nothing | todo |
| T4 | **Terrain operators** (Eq. 6): fbm, ridged, billow, voronoi F1/F2, warped; peak, crater, ridge, dune, terrace, mesa, basin, carve; `layoutLandscape(spec, regions)` over `heightRange`. High-base regions ramp in by distance to their edge (§10 PB1) **[TOOLS]** isomorphic ESM (no node imports), so Map Lab runs it in a worker (WORLDCLAW-TOOLS WT6). | deterministic per seed; each op tested; its cost per sample reported; PB1's fixture (a small rock blob in a snowfield) no longer spikes | todo |
| T5 | **Reach, sightlines, bands, legs, cameras**: reach = the baked navmesh + tested traversal links (R25) for every place, slot and happening from spawn, with a slope map. Sightline rays. The **polish bands** along every enabled movement mode's eye path (R11; `worldclaw@0825a9f5:prototypes/worldclaw/terrain_vis.py`). The route graph is **partitioned by mode**: the `walk` legs (critical path, routes, stairs, interiors, every 10 m) go into the walk script's route file; every other leg runs its verb's test through E9's `leg-test.mjs` (the kit zipline; a new verb's test from P7) [R4-B9]. It picks the **route-leg cameras** at crests and turns on every seen band, the close band first (D60), and at P16 marks the pilot's 3 `gate` legs (R33). An unknown shard or zero walk legs is an error [A13, B17, C44, R2-A8, R2-C24, R3-A6, R3-B12] **[TOOLS]** also writes `design/coverage.png` + `coverage.json` (band per 2 m cell, viewpoints) for Map Lab and the Coverage Explorer. | Nalati's numbers unchanged; a blocked sightline fails; the fjord fixture (`worldclaw@0cc81155:prototypes/worldclaw/out/fixture-layout-c-512.png`) bands within 2 points of §10 PB2; a ledge reached only by a kit zipline link | todo |
| T6 | (helpers from E406: `scripts/worldclaw/capture-front.sh`, World Explorer views through the harness params; `spec-map.py`, a plan map from `spec.json`) · **Capture**: player-view poses at eye height with the HUD (harness `x`, `z`, `yaw`, `pitch`; 402×874 at 3×); World Explorer poses (`explore=world&cam=…`) for elevated concept views; `cam.json` = position, yaw, pitch, **vertical FOV and aspect** (codex returns other pixel sizes, §10 PC1); route-walk frame strips (a frame every 10 m) for the judges; channels via `debugSettings` (E5); at P16, the pilot's gate poses in the shard's `capturePoses()`, which `scripts/parity/poses.mjs` walks (R33, MC50) [R4-B5] | `cam.json` re-projects a known point within 2 px at any output size | todo |
| T7 | **Model emitter**: a GLB list → `defineModel` files with pipeline, category, colliders, LODs, **texture caps by size class** (R28), provenance (E3), and the Explorers' **phone copies** (`public/assets/explore/<slug>/…`, 06 §10.1) [R3-B15] | 3 emitted fixture models pass every gate | todo |
| T8 | **Placement solver** (R3): `objects.json` (label, bbox, contact pixel, facing, size class, `on`) + `cam.json` → placements in the world data, using rays through the physics query layer and the baked sampler (`worldclaw@0825a9f5:prototypes/worldclaw/place_solve.py` is the math). No hit, an obscured contact or several floors → the object is flagged, never dropped onto the terrain below **[TOOLS]** also writes `design/objects/<place>.placed.json` (placed contact, projected error, flag) for the Composition Explorer. | a known pixel → a known point within 0.25 m on Nalati's baked terrain; a barrel on a bridge deck and on the upper of two floors at one x, z | todo |
| T9 | **Sits-right and play checks**: footprint ground spread; overlap; the scale table by category; colliders; clear zones; **pads off route corridors** (R5); **traversal approach / activation views and clear cones** (R25); every happening's signal seen from its `seenFrom` samples; scatter against its exclusions; **sketch pieces replaced by final code models with the same footprint and colliders** [B33] (a required slot's logged rung-5 stand-in, on the gap list, is exempt [R4-B10]); D25's musts present | one fixture per failure; a shipped building passes | todo |
| T10 | **Budget census** on the phone tier at given poses: triangles, draws, programs and GPU MB against R28's gate, and the frame time per pose (the parity pose sampler, `scripts/parity/poses.mjs`, which walks the shard's `capturePoses()`: the place's cameras go in there; a Mac headless reading, reported, no baseline recorded while the shard is exempt; MC38, MC50) **[TOOLS]** also writes `design/budgets.json` (census per pose) for the Coverage Explorer. | Nine Dragon's mockup poses reproduce its numbers within 2 % | todo |
| T11 | **Boards, clips, strips**: portrait boards of **≤ 4 images each** (several boards under one AskUserQuestion) [C21]; clips via `canvas.captureStream` + MediaRecorder for Jake, small enough for SendUserFile (its 30 MiB cap and 30 s upload timeout on this uplink); contact-sheet frame strips for the judges | a 4-image board, a 60 s clip that SendUserFile delivers, a frame strip | todo |
| T12 | **Judges** (R6): the J1 / J3 brief, the J2 runner (`codex exec -i`), the merge. **Rubrics** for pitches, art directions, concepts, maps, mockups and targets, the level rubric (L1–L9) and the look and slop rubric, all reading F1 [B8]. **The batched per-asset style check** with its fix ladder ([06](../design/worldclaw/06-shard-flow.md) §10.4) [C50] | a dry run on fixtures returns per-option tables and a merged verdict; a pick split ≥ 1 calls J3 (a gate line split ≥ 3); an off-style fixture model fails | todo |
| T13 | **Recording and delivery** (R19): progress cameras after every step (a P-row, or a place inside P12) into `~/.cache/wildshard-worldclaw/<slug>/frames/` with a caption bar; milestone clips, a daily summary, the final time-lapse (within SendUserFile's 30 MiB cap and 30 s upload timeout), each sent only when follow-along allows | a dry run **across two sessions**: frames from both, recorded with delivery off; a time-lapse made later from them, labelled with its coverage | todo |
| T14 | **Visdev runners** (D46, D50): **adds `--max-parallel N` and a per-job timeout to `scripts/horizon-matte/run_codex.py`** (today it launches every job, times the whole batch, and ignores unknown flags) and uses AGENTS.md ▸ Mockups' 4–6 at once; Qwen exploration through `scripts/mockup-local.sh` with a neutral grey reference (it needs `--ref`) [B39]; per-kind engines from [06](../design/worldclaw/06-shard-flow.md) §10.6; stand- and look-dome 3×3 grids [R2-B3, R3-C12] | a dry run: more queued codex jobs than `--max-parallel`, never more than it live; an unknown flag exits 2; 6 Qwen explorations, 1 mockup, 2 grids | todo |
| T15 | **The live page** (R20), **superseded by [WORLDCLAW-TOOLS](WORLDCLAW-TOOLS.md)** (D64, D65: Draft mode and the Shard Atlas on the drafts site, verdicts in chat; review pages are read-only, one page per plan). Kept here only as the fallback when the tools rows have not landed: one read-only Artifact per run | the run's pages update at every step boundary | superseded |
| T16 | **The slice runner** [C9]: drives `spec.json`'s critical path, the slice and the quest steps headless through the allowlisted harness params (`chunk`, `quest`, `questflags`, `boss`, `bossGod`, `elite`, `x`, `z`, `skipintro`). The pilot reads them through the engine's quest and encounter services (N0 checks; where they are per-shard code today, T16 adds the generic hook in `#engine` with the other-shards proof). **The boss is beaten by real strike inputs** under `bossGod`, every phase logged, defeat firing the quest step and reward, its time reported; a debug kill doesn't count [R2-B13, R2-C15] | the fixture slice runs end to end with a timed log; a removed quest step fails it; the grey boss falls to real strikes | todo |
| T17 | **The grey builder** [R2-C1]: `spec.json` → a grey world in the sketch look and kit (E8a): T4 terrain, T3 region weights, water bodies, graded routes, place pads, stand-ins at footprints, gameplay structures, content rows. A **content-only** mode keeps a director shard's existing terrain (06 §10.2's single stage) [R3-B10, R3-C15] | a fixture spec builds grey (its time reported); walk legs 0 stuck; content-only on Nalati's terrain leaves its bake byte-identical | todo |
| T18 | **The zero-shot launcher** `scripts/worldclaw/zero-shot.sh "<invocation>" <slug>` ([06](../design/worldclaw/06-shard-flow.md) §8) [R4-C8, R4-K2, R4-K3]: a shell loop, not an agent, so no agent waits. The launcher session (one without `WORLDCLAW_WORKER=1`) starts it and runs nothing itself. It runs each worker as `env -u HERDR_PANE_ID WORLDCLAW_WORKER=1 claude -p --permission-mode bypassPermissions "<invocation>"`, then reads the shard's §run `stop`: `continue` → relaunch `/worldclaw-auto resume <slug>`; `quota(<reset>)` → sleep to the reset, then relaunch; `done` or `blocked` → stop and report; two exits at the same `step` → stop and report; no §run (the worker stopped before it made one, e.g. a shipped slug) → stop and report (MC49). Its log is `~/.cache/wildshard-worldclaw/<slug>/launcher.log` | a dry run with a stub worker: a progressing unfinished worker is relaunched until done; done stops; blocked stops; quota sleeps to a fake reset; two exits without progress stop | todo |
| T19 | **The blockout and the world views** (D66, D68, D69; prototype `worldclaw@54613cb5:prototypes/worldclaw/front/{blockout_data.py,blockout.py,cam_pick.py,minimap.py,label_map.py,title_strip.py}`): spec + region weights → a smooth Blender blockout that encodes what a painter must not misread (dead-flat ice with flag- and lantern-marked lanes, open water, the landform's identity, pits as negatives, a glacier tongue, the spawn beacon, the four edge gates, a hub's street plan); renders the top view, the World Explorer angles and every place's eye-level camera (the camera picker: a clear line of sight, walkable ground); the paint-over runner (the blockout as a layout guide only, the approved views as the fidelity target; a revision = a new map + one 3-in-1 image); the numbered map labels, the title strips and the HUD minimap composited by code | a fixture spec's map, 3 views and 11 cameras render (their time reported); every place gets a camera with a clear line of sight; the minimap shows the camera's spot and heading | todo |
| T20 | **The content boards** (D70, D71, D73; prototype `…/front/{content_c.py,compose_steps.py,journey.py,mkjobs_steps.py}`): the journey overview on the map (stages, lanes, numbered steps), the quest chain, side content and the slice; one 2x2 board per quest step (slot 1 the map leg A → B by code with why / what / gets and the step's **mechanics, NEW = engine work**; slots 2–4 wildcard moments and model sheets by codex, with the code minimap) | a fixture 12-step quest composes 12 boards + the overview (its codex time reported) | todo |

### P: the pilot (guided mode; D14; Jake at P0–P9 and P16–P17, notes any time)

| Row | What | Done when | State |
|---|---|---|---|
| P0 | **Start questions** (one AskUserQuestion): follow-along (D16, D35); run scope (R17). The mode comes from the skill and the invocation (R18, D62) **[TOOLS]** P0 creates the draft and its Atlas on the drafts site, and the draft's COMING SOON card in the game's deck (WORLDCLAW-TOOLS W13, J16, J19). | answers in the ask file and `design.md` §run | todo |
| P1 | **Vision intake** (D47): Jake's sentence, references and voice notes → `design.md` §vision, verbatim | Jake has nothing to add | todo |
| P2 | **Three pitches** (D11, D53, D34): each has a sentence, three pillars, the verb (existing / a toy moved from another shard + N days / new + N days), **the weapon** (a kit family or custom + N days), **the enemy roster and its density** (kit species or new + N days each; a shard may be sparse: D73), **the boss and the antagonist**, 8–12 places with roles (D25), beats, 2–4 happenings, **the journey structure** (A / B / C, e.g. a loop, hub and keys, stages that open: D70), and one key-art concept (Qwen explore → codex final). A new HUD control is shown as its own HUD board here (AGENTS.md ▸ HUD) [C3, C42] | Jake's pick | todo |
| P3 | **Art direction** (D12, D32, D48): three directions on the pick's key views. No direction may reuse a shipped shard's look; a photoreal one must differ from Pine Hollow's in palette and light [B29, C22]. The pick becomes the style bible **[TOOLS]** Jake may PUBLISH the teaser's shots from here (J11, J13); the card itself is in the game from P0 (J19). | Jake's pick; the bible committed | todo |
| P4 | **Concept art**: key art, one concept per place, the reveals, the boss, the creatures, the NPCs and the weapon, all in the bible | Jake approves the set | todo |
| P5 | **The map, wave 1** (R15, D66, D67, D68, D69; 04 §2–§4): `design.md` + spec (beats, happenings, the critical path, routes, sightlines); the schematic and 3 painted maps (T3) as **different layouts**; per variant the numbered illustrated map + 3 World Explorer views from T19's blockout, sent together; every map shows the **four edge exits** and a **spawn on land**, and the boss sits behind a summon (D67); a revision is a new map + one 3-in-1. Inspirational, not pixel-exact (D72) | `spec-check` + `twin-check` clean; Jake approves the map | todo |
| P5b | **The content boards** (D70, D71, D73; T20): the journey structure (A / B / C) drawn on the approved map; one 2x2 board per quest step with its mechanics (NEW = engine work, priced per pitch); side quests, feats, secrets, happenings and enemy pockets; the session slice. Iterated like the art (revise a step or a slot) | Jake approves the content (or "go with gaps") | todo |
| P6 | **First-person views, wave 2** (R27, D66): one portrait view per place from T19's camera on the approved map (each prompt lists what that camera sees), with the baseline HUD and the code minimap, titled, sent as one set with the map | Jake says go (≤ 2 revise loops; then "go with gaps" or stop) | todo |
| P7 | **Verb gate** (R13), only for a new verb or a moved toy, **after the mockups** (D57; after E9b for a moved toy): the verb in grey in the pilot's playground (`ctx.playground`), mapped onto `verb.1` / `verb.2`, **with its leg test written to E9's leg contract** (`leg-test.mjs`); Jake reaches it by R22's taps. A no returns to P2; a second "dull" cuts the verb. Jake's answer goes into the verdict log [R3-B12, R3-C16, R4-B9] | Jake plays it and says yes; the leg test runs headless | todo |
| P8 | **Grey world + grey content**: T17 builds it in the sketch look and kit (E8a); terrain on the extent, water bodies, graded routes, place pads (R5), the weapon live, kit SFX cues; enemies, elites and the boss as grey rows (brains, strikes, phases); quest steps; happenings; the slice; bakes via E10 | 0 stuck on the walk legs and every non-walk leg's test passes; reach clean; every place's pad walkable (R5) and its gentle-ground share reported; T16 passes the slice and beats the boss by real strikes **when the run scope holds the boss** [R3-C11]; the judges' pass mark on L1–L9 from the strips; phone-tier fps reported | todo |
| P9 | **The session-slice gate** (D41): Jake plays a 10–15 min slice on his phone, delivered by R22; his answer goes into the verdict log [R3-C16] **[TOOLS]** or the Atlas's PLAY chip. | Jake's yes + one note (a no follows [06](../design/worldclaw/06-shard-flow.md) §10.3; ≤ 2 nos, then the kill rule) | todo |
| P9b | **Re-target onto the grey world** [C6, B12]: capture the grey world at every place's planned camera **and at T5's route-leg cameras** (`design/cams/leg-<id>.json`) (T6); codex re-edits each place capture to its approved P6 mockup (the mockup as the second input), and each route-leg capture to the bible with the nearest place's mockup as the second input [R4-B6, R4-C7]; a stand-dome and a look-dome 3×3 grid per hero view [C20]; phone copies for the Explorers. These are the build's targets (E4). The judges check fidelity (R6 pass mark); no new Jake decision | every place and every seen-band route leg (the close band first) has a target at its real camera; every hero view has two grids | todo |
| P10 | **Look** (R29): the bible as shard data, including the kit's look (E6); LOOK-LOOP against the targets on every seen band, the close band first (D60); two domes; a 12-frame orbit strip | each target's ΔE00 reported; the judges sign off | todo |
| P11 | **Catalog** per place by `catalogMode` (D18): scatter by `scatter-sources.json`; the bible's anchor models first; texture caps (R28); every asset passes the style check (fix ladder); provenance; walk-inside buildings as code (R26) | every model passes the style check and its review | todo |
| P12 | **Places by paint-then-lift** (D19) on **every seen band, the close band first** (D60), per place and per **route leg** at crests and turns [C14]; in `worldclaw-interactive` each place is a **checkpoint** (§2b: Frame · Form · Play · Pin, as many boards as needed; D63, D78), pinned and deployed hidden (D79) before the next place, which Jake picks along the golden path (D83); each composition is a codex edit of the capture **with the P9b target as the second input** [R2-C21]; gameplay structures from the spec as code; sketch pieces replaced (T9); placements by T8; object pads (R5); T9; Sets with targets (E4) | T9 clean; judges' must-fix empty (a must-fix that stays climbs 06 §10.4's ladder) | todo |
| P13 | **Content and audio to final**: creature, NPC and boss models (mockup-to-model §2–§7, rigs), arena and happening dressing, signals, quest props, the weapon's final model and moves, **the score (MiniMax Music 3), ambience, SFX (MOSS + Stable Audio 3, the better take, `sfx_merge.py`), the in-game credits**, and the card art from P4's key art [C3, B27] | T16 plays the golden path and the slice end to end in the final look | todo |
| P14 | **Budgets**: T10 at every place's 9 cameras and every 10 m of every route; a Simulator memory **pre-check** (R28) | every pose within the gate; Simulator ≤ 1.8 / 1.0 GB (a pre-check only) | todo |
| P15 | **Final judges** vs F1, L1–L9, the look and slop rubric, on the final strips | no must-fix | todo |
| P16 | **The final board** (every "decided for you"; every blocked branch as one question with a recommended answer and its cost, applied before P17 by R16), the time-lapse, the gap list; the exit from the gate exemption once no blocked branch is open (R33); and the **physical-iPhone reading** by [06](../design/worldclaw/06-shard-flow.md) §7's recipe: `scripts/webkit-mem-reading.mjs --url=<prod>/?chunk=<slug>` over the Web Inspector bridge (`scripts/iphone-mem-reading.sh` reads Nalati only; it shows how to start the bridge), recorded like `docs/audits/physical-shard-memory-baseline-2026-09-28.json` [R2-C22, R3-B6, R4-A3, R4-B1, R4-C1, R4-C2, R4-C11] | delivered; every blocked branch answered and applied; the reading recorded; the pilot's first gate baseline | todo |
| P17 | **Jake's first walk** (the director loop's arc gate): notes through the in-game inbox, drained one ask each (drain-inbox), linked from the run's ask (which E359 links); his words into the verdict log; each note sized with a reason, then the baseline freezes (R32); an over-limit physical reading reopens P14; S / M notes fixed; **the status becomes `experimental` on Jake's word** | the score and the reading recorded; Done-when 1 rechecked | todo |
| P18 | **The clean-room check**: the main agent launches it per [06](../design/worldclaw/06-shard-flow.md) §8 through T18 (`/worldclaw-auto zero-shot <a sentence> as <slug> until P5`) on a second sentence the judges pick from three; it runs from the skills alone [C30, R2-C14, R3-B8, R4-B7] | a valid design.md + spec + map, judged and logged, no help | todo |
| P19 | **The zero-shot dry run** (D51, R18): P18's shard continues through T18 with `/worldclaw-auto zero-shot <slug> until P8`: the grey world and content, T16's slice, a partial board | a judged front log and a P8-clean grey shard; Jake sees only the board; then P18's shard is deleted (R33) | todo |

### L: the merge (D77–D91)

| Row | What | Done when | State |
|---|---|---|---|
| L0 | **The merge** (D77–D91): SHARD-CHECKPOINTS into this plan (§2b), the skill fold (D80), the archive | the council's rounds close (D88) | done (E406: four rounds, `docs/plans/worldclaw/reviews/merge/`) |
| L1 | **T1's formats**: the `design.md` template with its machine block (R15) and the `spec.json` schema, drawn from Thin Ice's dry-run pair | a schema file and a template; Thin Ice's dry-run pair converted as the first fixture | done (`f9afe2aa6`: `scripts/worldclaw/spec.ts`, `design-template.md`, the Thin Ice fixture) |

### S: the skills

| Row | What | Done when | State |
|---|---|---|---|
| S1 | **The three skills** (D62) from draft to final after the pilot: `worldclaw-interactive` (guided: the front, the play gates, a checkpoint per place, polish with Jake; it absorbs the old visdev and iterative drafts and, D80, `shard-checkpoints`: the checkpoint chapter; new shards only, D90) and `worldclaw-auto` (zero-shot: the same steps, the judges decide, the T18 launcher) | P18 and P19 pass | todo |
| S2 | (absorbed into `worldclaw-interactive`, D62: the iterative flow is its polish rounds after P17) | — | merged |
| S3 | `worldclaw-sketch`: an outline (D4); its look and kit are E8a, its builder T17 | — | outline |

### C: the council (now; §8)

| Row | What | State |
|---|---|---|
| C1–C4 | Up to four rounds (D29): seats A (Codex), B (Claude coverage + code audit), C (Claude red team); the register; the battery; stop early after a clean round | C1 done (119); C2 done (61); C3 done (42: A 2/4/0, B 2/11/3, C 4/12/4; all fixed); C4 done (36: A 4/1/0, B 1/11/3, C 2/10/4; all fixed; the cap of four); the scoped check after the cap (R4-K1–K3, fixed); register |

## 5. Order, prerequisites and size

**Now:** C1 … C4 → Jake's go. L0 (the merge and its council) and L1 (T1's formats) are done; T1's checks stay at step 5. Existing shards are out of scope (D90), except a director's single stage (D91).

**After GAME-NORMALIZATION is archived**, in this order. A stage starts only when its prerequisites in the
[stage-entry table](../design/worldclaw/06-shard-flow.md#102-stage-entry-table) are done [A1, B1, C1, A12, C51, R2-C5]:

1. N0 → F1 (Jake).
2. E3 → T7, then T10, T11, T6, T12, T13, T14, then WORLDCLAW-TOOLS' before-P0 rows (W16, W15, W1–W5, W8, W9, W17, W13; they replace T15) (the provenance API before the emitter; the capture, board, judge, recording and visdev tools, the drafts site) [R3-A1, R3-C2].
3. E10 (with the lab shard) → X1 (Jake, in the lab shard).
4. E1, E2, then E4–E9 and E8a in parallel on disjoint files.
5. T1, T2, T3, T4, T5, T19, T20 (the twins, the maps, the terrain operators and bands Map Lab runs, the blockout and views, the content boards); WORLDCLAW-TOOLS W6 (Map Lab) before P5.
6. P0 → P1 → P2 → P3 (Jake). For the pilot, Thin Ice's dry-run front is the starting point (D74).
7. P4 → P5 (the map, wave 1) → P5b (the content boards) → P6 (first-person views, wave 2) (Jake).
8. [E9b if a moved toy] → [P7 if a new verb or a moved toy (Jake plays): after the mockups, D57].
9. T8, T9, T16, T17 (T8 before WORLDCLAW-TOOLS W10, which P9b uses).
10. P8 → P9 (Jake plays) → P9b.
11. (T8 moved to step 9.)
12. P10 → P15.
13. P16 → P17 (Jake walks).
14. T18, then S1, P18, P19.

**Estimate** (agent-days; a base plus per-pitch adds [C40]):

| Part | Rows | Days |
|---|---|---|
| Re-ground, fun rules, scatter demo | N0, F1, X1 | ~2 |
| Engine and Explorer | E1–E10 (+ E8a) | ~9–11 (E1 ~2, E2 ~1.5, E7 ~2, E10 ~0.5) |
| Tools | T1–T20 | ~9–10 (T16's engine hook ~0.5, T17 ~1, T18 ~0.5, T19 ~1.5, T20 ~1) |
| Front (with Jake's turnaround) | P0–P6 | ~4–5 (map waves, the content boards in two rounds; the pilot starts from the dry run) |
| Grey gates + re-target | P8–P9b | ~2–3 |
| Build | P10–P15 | ~8–12 (every seen band polished, D60; a checkpoint per place in interactive, D63) |
| Hand-back + first-walk fixes | P16–P17 | ~3–6 (P17's S / M fixes ~2–5) |
| Checks + skills | P18, P19, S1 | ~4 (P19 is a front + a grey shard again) |
| X1 at its real size | (in the first line) | +~1 |
| **Base** | | **~42–54** (the sum of the lines above) [R4-B13] |
| Per pitch | a new verb +3–10; a moved toy (E9b) +1–2; each new species +1–2; a new boss +2–3; a custom weapon +2–4; a new HUD control +1–2; **each NEW mechanic on the quest boards +0.5–2** (D73; Thin Ice's ~11 non-content mechanics ≈ +8–14) | |
| Per answer | each P9 no ~1 (P8 rework + T16 + redeploy); a P7 "dull" ~1; a re-look note after P9b ~2; a place moved after P8 ~1; a P3 mini-X1 ~0.5; a blocked branch answered at P16 ~0.5–1 [R2-C19, R3-C13, R4-C11] | |

- **Images:** ~400–600 codex images (the map waves and two content rounds add ~90–130) + ~200 Qwen explorations [C19]. The per-kind count is in
  [06](../design/worldclaw/06-shard-flow.md) §10.6.
- **Judges:** ~150–250 judge runs, batched.
- **Model lock:** ~4–6 h.
- **Waits:** Jake's turnaround at thirteen touchpoints (fourteen with P7): F1, X1, P0, P1, P2, P3, P4, P5, P5b, P6, [P7], P9,
  the P16 reading and P17; in `worldclaw-interactive` also one checkpoint per place in P12.

## 6. Risks

| Risk | Mitigation |
|---|---|
| A diorama, not a level | `design.md` and D25's musts; the play gates before any art (D41); judged by playing |
| Slop: things don't sit right | T8 support binding; T9 every place; pads off routes; the close-up loop |
| Slop: no composition | targets re-made at real cameras (P9b); paint-then-lift on the close band; two domes |
| Slop: style drift | the style bible; the per-asset style check with a ladder; one post recipe; the kit in the look (E6) |
| The polish area is too large | every seen band gets full polish, the close band first (D60); never-seen ground gets nothing; Coverage tracks it |
| Content arrives late or doesn't fit | content and world designed together (D37); P8 builds real grey content; T16 proves it |
| The normalized code differs from the spec cited | N0 first (R8) |
| Codex quota or uplink | Qwen explores; 4–6 codex runs at once (AGENTS.md); the run pauses rather than shipping Qwen references; resume (R23) |
| The model lock is busy | queued batches; the main agent waits in the background |
| Jake's notes thrash the run | step boundaries; the invalidation table (R21); gate-reopening notes hold only their places |
| Jake is away for days | resume (R23); non-dependent rows continue; re-send once at 48 h |
| Judges agree on a bad call | F1's fun rules as rubric; J3 on splits; every gap on the final board; the first walk is the real score |
| The Simulator passes and the iPhone fails | P14 is a pre-check; Done-when needs the physical reading; an over-limit reading reopens P14 |

## 7. Questions for Jake

All answered by Jake on 2026-10-01:
1. **The verb-gate order:** after the mockups (D57).
2. **Where the director's design lives:** the shard folder, linked from SHARDS.md (D58).
3. **E1 and Nine Dragon's P2-E1:** one shared row, whichever plan reaches it first (D59).
4. **Where the content boards sit:** P5b, after the map (wave 1) and before the first-person views (wave 2) (D75).

Still open:
5. **Jake's go** on the plan (D61: the dry run's front and content round 2 are reviewed). Jake (2026-10-01): "Not yet,
   I'll review the pages"; "I'll re-review all three plans".
6. **A check after the fold:** done 2026-10-01 after the merge (Jake: "Merge then check"): one Codex-only check found 21
   contradictions (the read-only pages vs R20, T15 still in the order, T4 / T5 / T8 too late, Thin Ice's missing P7 and
   grey content, R24, banded polish, D65, D72, R14, T2, the route-leg cameras, T12's split, stale paths); all fixed
   ([reviews/post-fold-check.md](worldclaw/reviews/post-fold-check.md)).

(Answered by the council: the pilot can't be GAME-NORMALIZATION's Z3 shard 5, which forbids engine and `scripts` edits.
It is a separate shard after Z3 [B22, C31].)

## 8. The council (D7, D29)

The same protocol as GAME-NORMALIZATION 12 §1, scaled:
- **The ledger:** §0.2 D1–D56 (superseded rows excepted) and §0.3 R1–R33 are settled. A finding reopens one only with
  new evidence.
- **The bar:** a finding counts only if an executing agent would fail, do the wrong thing, or have to guess. It needs a
  location, evidence and a concrete fix. Grades: `must-fix` / `should-fix` / `nit`.
- **One register:** [worldclaw/reviews/register.md](worldclaw/reviews/register.md).
- **Seats per round** (each a fresh agent):
  - A: Codex, architecture + the battery;
  - B: Claude, coverage + a code-grounded audit against the `pre-normalization` tree and the normalization spec;
  - C: Claude, red-team execution.
- **The battery:** [worldclaw/reviews/battery.md](worldclaw/reviews/battery.md), only grows.
- **Rounds: 4 at most**, stopping early after a clean round. Round 1 reviews everything; rounds 2–4 review the diff
  plus the battery. After the last round, what is open goes to Jake as decisions, one recommended answer each.

## 9. Re-grounding log (N0 fills it)

| Path or API in this plan | On `main` after normalization | Changed in |
|---|---|---|

## 10. Prototype evidence (D56)

Throwaway prototypes, kept off `main` (D76) at the local tag `worldclaw-archive` (`1436c063`, shared by every checkout on this machine): `git show worldclaw-archive:prototypes/worldclaw/<path>`. A commit cited as `worldclaw@<sha>` is in that tag's history. Their images are in `art/worldclaw/round-1-prototypes/`.
Each row: the question, what was built, the measured answer, what it changed in this plan.

| # | Question | Result | Changed |
|---|---|---|---|
| PA | Can codex paint a usable semantic layout map from our schematic? (R1, T3) | Battery scenario 1's fjord: 11 places, 7 routes, a 9-colour palette. **3 of 3 codex variants put 11 / 11 places in their region**, kept every path where drawn, and agreed with each other on the composition; **palette fidelity 94.9 %, 97.1 %, 97.9 %** (anti-aliased edges are the loss); **~110 s each**, all three in parallel. Files: `worldclaw@0825a9f5:prototypes/worldclaw/{fjord-spec.json,schematic.py,mkjobs_layout.py}`; the maps as 512² fixtures at `worldclaw@0cc81155:prototypes/worldclaw/out/fixture-layout-{a,b,c}-512.png` [R2-C20] | T3's gate is **places-in-region 100 % + every route on walkable ground**; palette fidelity is a warning below **94 %**, not a 97 % gate. Three variants stay (they cost one wall-clock run) |
| PB1 | Does Eq. 6 over a painted map give walkable terrain on our 256² / 500 m grid? (T4, P8) | Slab (−10..+40 m): **84–91 % of land walkable** (≤ 40°), 77–84 % gentle (≤ 30°); places on gentle ground 32–100 %. **Cube** (heights to 144 m): walkable **68 %**, and some places drop to **4–18 %** gentle ground. **Defect found:** small rock islands painted inside snowfields become **70 m spikes** in the cube, because a region's base height applies at full strength whatever the blob's size. The bake + Eq. 6 + slope + render run in ~1 s in Python | T3 merges specks under ~600 m² into their neighbour; T4 ramps a high-base region's height in from its edge (a **distance-transform ramp**, ~20–40 m), not by blur alone; P8 adds a **pad for every place** (walkable inside its radius), not only under buildings |
| PB2 | How much of the 250,000 m² does a player see, and how close? (D43, R11) | Viewpoints every 5 m along every route plus each place's centre and rim (eye 1.7 m, 720 rays, 320 m): **close ≤ 30 m: 34–38 %; mid 30–80 m: 32–36 %; far > 80 m: 20–24 %; never seen: 3–9 %**, on all four maps. A 500 m shard with a route network sees nearly all of itself | (Superseded by D60: every seen band gets full polish, close first.) R11 became **banded polish**: close band = full polish (paint-then-lift, LOOK-LOOP cameras); mid band = composition and silhouettes only; far band = silhouettes and scatter only; never-seen = nothing. Full polish drops from 250,000 m² to **~90,000 m²**. The spec gets a **route-length budget** (the close band is about route length × 60 m) as a level-design lever |
| PC1 | Does paint-then-lift's composition step work on a real game frame? (D19, P12) | A live World Explorer capture of Nalati's horse plains at a recorded camera (`?explore=world&cam=65,55,110,0,-0.36`, vfov 72°, 402×874 at 3×). Two codex compositions of "a herders' waystation" (two yurts, a watch platform, a corral, a cart, hay bales, a campfire), **92 s and 124 s**. Both kept **the camera, terrain, mountains, sky and every HUD element** exactly, matched the painterly look, grounded every object with contact shadows, and kept the requested path clear. Version A composed a coherent camp; B a sparser one along the far track. Output came back at 851×1849 (the input's aspect, smaller) | The in-engine mockups (P6) and compositions (P12) can be edits of real captures with confidence. `cam.json` must store the **aspect and FOV**, not pixels, because codex returns a different resolution (T6, T8) |
| PC2 | Does ray placement from the recorded camera land objects at sane positions and sizes? (R3, T8) | The camera model (three.js Euler YXZ, vertical FOV 72°) reproduced the game exactly: the frame's centre pixel hit (65, 27.2, 36.2), Nalati's horse plains at its bowl floor. Eleven contact pixels picked from composition A landed in a ~25 m camp on the plain. **Implied heights against the prompt's sizes:** yurts 4.2 / 3.9 m (asked ~4), platform 6.8 m (~6), cart 2.0 m, hay 1.6 m, a horse 1.4 m, a person 1.4 m at 101 m; the corral 8.4 m across (asked 12). **Size error ±20–30 %**, worse for small and far objects (1 px ≈ 8 cm at 85 m) | Confirms R3: **position and yaw from the composition, size from the size class**. The implied size is only a check (flag > 30 % off). T8's test adds "a known pixel → a known point within 0.25 m" on Nalati's baked terrain (the prototype hit it exactly) |
| PC3 | Is a codex re-draw, isolated on white, a faithful image-to-3D reference for an object in a composition? (R2) | The left yurt of composition A (a ~100 × 100 px crop) re-drawn "this same yurt, alone, whole, on white, three-quarter view" in **72 s**: the same felt panels, red pattern band, roof ribs, doorway and proportions, clean edges, no ground. Better than a mask could give: the crop is blurry and partly occluded by the platform | Confirms R2. P12 step 3's re-draw takes the crop **plus the full composition** as inputs (the prototype did), so codex keeps the object's identity and the scene's look |
| PC4 | What does image-to-3D make of that reference, and how fast? (P11) | Hunyuan3D-2 turbo under the model lock (it queued behind another agent's job): **load 30 s, shape 6.7 s, paint 16.7 s, 40k faces, 17 GB peak**. A recognizable yurt from front and back: the right silhouette, roof ribs and red band, but **the band's pattern softens into a blur** and there is **a small hole at the doorway's base**. 40k faces is 4–10× a building's budget | Generated buildings suit the **mid and far bands** (R11) after decimation; a **close-band** hero gets the post recipe + the 4-view review, or a **code model** when its shape is parametric (Nalati's shipped yurt is code: Jake picked it over the Hunyuan and Blender yurts). The per-asset style check (T12) must catch softened patterns (style drift, D39). One Hunyuan load serves a batch: ~23 s per object after the first |
