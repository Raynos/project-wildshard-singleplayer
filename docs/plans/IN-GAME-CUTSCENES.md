# Plan: IN-GAME-CUTSCENES — real cutscenes in the shards, in engine and generated (E475)

**State:** `draft` 2026-10-10 — written; waits on Jake's go and the three picks in §7. Nothing is built from a draft.
Live status moves to [in-game-cutscenes/STATE.md](in-game-cutscenes/STATE.md) once the plan starts.

## 0. Why

Jake (E475, 2026-10-10): *"make a new plan called in-game cutscenes. Each shard has stories, quests, and they even have
mini cutscenes. Like there was camera direction happening. I've seen it happen, especially for some bosses, some other
stuff. Let's have a brand new plan that's talking about how to incorporate real cutscenes. And since we generated these
videos, we can generate real cutscenes. Now, I have no idea how you do in-engine cutscenes versus generated cutscenes.
Yeah, the player character, you know, he has outfits and stuff, and he has like customized looks. Whatever, that's a
problem for the future. We can just have a generic character. We can just have the best cutscenes we can have, even
though the player character is not going to have their currently equipped outfit in them. That's a complete separate
problem."*

What sparked it, a friend: incorporating high-quality cutscenes into the game means the cinematic trailers
(TRAILERS Part D) aren't false advertising. The techniques are in [docs/process/CINEMATICS.md](../process/CINEMATICS.md);
its first rule applies here too: **promise only what the game can ship.**

## 1. What exists (the code, 2026-10-10)

Every camera moment in the game today is **first person**: something eases the player's own yaw and pitch, or carries
the player. There is no shot system, no camera other than the player's, and **no player body** (the game is first
person; worn cosmetics show only in the shadow: `src/game/cosmetics/cosmetics.ts`, the Wardrobe's `visible` mode is the
future hook for a third-person shot).

**The shared pieces**

| Piece | File | What it does |
|---|---|---|
| Boss intro state | `src/engine/ai/BossBrain.ts` (`intro` state, `SKIP_HOLD = 0.6`) | locks input, asks the script's `intro(t, short)` for a focus point each frame, HOLD TO SKIP, a short intro on every retry |
| Boss camera ease | `src/game/Boss.ts` `faceToward` | eases player yaw / pitch toward the focus (k = 1 − e^(−3.2 dt)); stays first person |
| Letterbox + name card | `src/engine/ui/BossBar.ts` (`showNameCard`, `setSkip`, `fade`) | letterbox bands, the engraved name card, the skip ring, a black fade |
| Platform bosses | `src/sdk/phasedBoss.ts`, `src/sdk/markedBoss.ts` → `src/game/plugin/bossPhase.ts`, `src/game/shardfile/markedBoss.ts` | boss rows as data; `intro` / `introShort` seconds are data |
| Quest reward view | `src/game/quest/reward.ts` `QuestRewardBeat` + `rewardMotion.ts` | carries the player, 2.5 s camera ease to an authored pose, 3.5 s clock ease (to golden hour), 7 s hold, caption, HUD hidden, weapon away |
| Dialogue | `src/engine/quest/view/ui.ts` `DialogueBox`, `src/engine/quest/dialogueClock.ts` | NPC lines typed out, tap to advance (the quest-giver panel) |
| Shard director | `src/sdk/director.ts` → `src/game/shardfile/director.ts` | bounded numeric events between a shard script and the host (Driftwood's finale `reward.start` / `reward.finish`) |
| Explore hub orbit | `src/engine/explore/Explore.ts` ~l. 582 | a slow orbit of the island behind the hub cards (the one non-player camera) |

**Per shard**

| Shard | Story / quest | Boss and its intro | Other camera direction |
|---|---|---|---|
| Driftwood Isle | Wendell's quest line (`quest/questLine.ts`: "Who lit the fire?") | the Drowned Captain (`combat/captain.ts`): intro 0 s, no camera | **the finale's reward view** (`runtime/finale.ts`, `runtime/reward.ts`): eases to face the planet, clock to golden, then the ShardComplete card (`quest/Complete.ts`) with the world frozen |
| Nalati Grasslands | quest chain (`runtime/quests.ts`) | **the Golden King** (4.2 s / 1.4 s: the lid opens, he rises, the light shaft pulses, already timed as data in `combat/goldenKingRow.ts` `intro`) and **the Storm Titan** (3.6 s / 1.3 s; rises, kneels, eyes ignite, the first bolt hits the meadow: `combat/stormTitan.ts` `intro`) | the boss intro locks the horse's reins (`runtime/rideReins.ts`) |
| Pine Hollow | quest director (`runtime/questDirector.ts`) | **the Antler King** (`runtime/antlerKing.ts`: the camera eases to his ribcage) | the zipline and the ferry carry the player (`quest/rides.ts`; the wire rolls the camera) |
| Sky Reach | keeper → roost → vanes → winch (`quest/install.ts`) | **the Storm Roc** (`data/rocFight.ts`: 1.5 s / 0.3 s; `combat/stormRoc.ts` **snaps** the yaw, no ease) | — |
| Signal Dunes (`sunscar-dunes`) | quest with places and a coin reward (`quest/install.ts`) | **the Dune Matriarch** rises from the basin (`data/matriarchFight.ts`, a marked boss) | — |
| Nine Dragon Stack | none (a prototype fragment) | none | — |
| Template, Pastel Plain, Ink & Cel | the hut-door quest | a template boss (intro 1 s) | — |

So Jake's "mini cutscenes" are the boss intros (five bosses, all first-person eases with the letterbox and name card) and
Driftwood's reward view. None cuts, moves the camera off the player, shows the boss from a chosen angle or plays a line.

## 2. In engine vs generated

| | **In engine** (a camera timeline, rendered live) | **Generated** (a pre-rendered video clip) |
|---|---|---|
| What it is | shots as data: camera keys, cuts, letterbox, lines, sound cues, played by the engine on the real world | an MP4 made off-line (keyframes → LTX-2.5 → cut + score), played over the game |
| Quality ceiling | the game's own look, which is the honest one; motion limited to what our models can do (boss poses, rises, VFX); no faces, no player body | cinematic motion (a gallop, a fall, a giant rising) the engine can't animate; AI tells (CINEMATICS §5), drift after ~2 s, faces and limbs smear |
| Cost to make | the system once (IC1–IC4), then hours of authoring per cutscene, no model time | per 10 s clip: ~3 keyframes (~3 min each), ~3 shots (5–8 min each under the model lock) + two re-rolls, a score; ~1–2 h of lock |
| Bytes on the phone | a few KB of data; uses the world already in memory (shots stay inside the loaded cells) | 720 × 1280 HEVC at ~2 Mb/s ≈ 2.5 MB per 10 s; 1080 × 1920 at ~4.5 Mb/s ≈ 5.6 MB per 10 s; streamed, never in the playable closure (SHARDS.md counts 1 MB/s to playable) |
| Memory | ~0 extra | a hardware-decoded `<video>` over a paused canvas: unmeasured (estimate 30–60 MB of decode buffers at 1080p); a physical-device reading before it ships (AGENTS.md, Rendering) |
| Portrait phone | renders at the phone's portrait aspect and 2× scale, like play | must be made **portrait** (LTX at 704 × 1280); a 16:9 clip on a portrait iPhone is a 221 pt strip |
| Live world | always matches: the time of day, the boss's real model, what you broke | frozen: can't show the weather, the day, the boss's state; must hand off to the live game cleanly (§4) |
| Shard platform (UGC) | **pure data** an author declares, validated like encounter and director rows, runs headless, costs nothing to admit | a binary asset an author needs a GPU and LTX to make; admitted only with caps and an in-engine fallback (IC11) |
| The player character | v1 keeps the hero off camera: shots of the boss, the NPCs, the place, or the hero's own view | one **generic hero** from one character sheet, seen from behind (the WoW pose, CINEMATICS §2) |

**Decision D1: hybrid, in engine first.** The engine timeline carries every cutscene by default (boss intros, quest
beats, arrivals, the reward view); generated video is reserved for **one or two hero moments per shard** where the
motion is beyond the engine (a giant rising, an arrival from the sky), and every video has an in-engine fallback. Why:
the engine's version is honest by construction (Jake's newest steer), costs nothing on the phone, works for every
author, and five intros already exist to build on; video is the ceiling-raiser the trailers proved, but only where it
earns its bytes.

**D2: the player character.** v1: no hero on screen in engine shots; one generic hero in generated clips (Jake: *"We
can just have a generic character"*). Equipped outfits in cutscenes are **out of scope** (Jake: *"a complete separate
problem"*); the Wardrobe's `visible` mode is where it would plug in. A third-person hero model for engine shots is
built only if a picked cutscene needs one (then it becomes a row, via mockup-to-model).

**D3: Developer and Debug.** Every new cutscene ships behind **Developer** (off = today's intro); a comparison is one
A / B / C row in pause ▸ Settings ▸ Debug (*today · in engine · video*), deleted with the losing code when Jake picks.
No URL switch, ever. Jake sees each one as a portrait clip, never as a toggle chore.

## 3. The engine API

**Layers (AGENTS.md, ENGINE.md):** the engine knows cameras, timelines, letterbox, captions and video playback in
general; the game knows bosses, quests and saves; a shard supplies cutscenes as data.

- **`src/engine/cinematic/`** (new): `Timeline` (a fixed-step clock with a snapshot / restore like `BossBrain`'s
  continuation), tracks:
  - **camera**: `pov` (today's eased look-at, `Boss.faceToward` moved here), `rig` (position + look-at keys on a
    spline, fov, ease), `orbit`, `hold`; a **cut** is a key with no blend. One camera owner at a time (player or
    timeline); the timeline borrows the camera the way `player.carried` does today and always hands it back.
  - **letterbox**: lifted out of `BossBar` into a shared `Letterbox` (BossBar keeps the name card and uses it).
  - **caption**: timed subtitle lines in the `DialogueBox` style, strings from the owner's `strings.ts`.
  - **cue**: music and SFX events (today's `music('intro')`) on the timeline's clock.
  - **video**: a streamed clip in a DOM `<video>` (muted, `playsinline`) over the frozen canvas, its sound through the
    engine's already-unlocked audio bus (iOS won't autoplay a video with sound outside a tap); preload when its trigger
    arms; poster frame; on any failure, the in-engine fallback plays.
  - **control**: input lock, HUD and viewmodel hidden, world live or frozen (Driftwood's `frameGate` pattern), skip
    (hold, `SKIP_HOLD`), once-per-save vs short-on-retry.
- **`src/game/cutscene/`**: binds the triggers (boss intro, quest step, reward, shard arrival, place entered), the seen
  flags in the shard's save, and ports `BossBrain`'s intro and `QuestRewardBeat` onto the timeline (IC2: no visible
  change).
- **`@wildshard/sdk/cutscenes`**: `cutscene(data)` validated with valibot (bounded shots, finite numbers, string keys),
  a `cutscenes` table in the shardfile, a boss row's `intro` naming a cutscene id. Lands through SHARD-PLATFORM's
  shardfile route (its coordinator owns the SDK and the schema); ENGINE.md and SHARDS.md sections in the same rows.

## 4. The generated pipeline for cutscene video

The trailer pipeline (CINEMATICS §3), changed for the game:

1. **Start from the game, not concept art.** The keyframe is an **in-engine capture** of the cutscene's place (portrait,
   the phone's view, HUD off), lightly polished with OpenAI Image 2.5 using the shard's style refs and the generic
   hero's sheet. Gate: it must still read as our game (same models, palette, light); a frame that looks AAA is rejected.
2. **Shots:** LTX-2.5 image-to-video at **704 × 1280** (portrait; IC7 proves it), 3–5 s each, one motion per shot,
   one take + two re-rolls by failure kind; the first 2–3 s of each take.
3. **The hand-off to the live game:** the first shot starts from the capture of the player's actual view at the
   trigger (seamless in); the clip ends on a cut to the live game, which takes over on the name card, letterbox and
   score (a style match never needs a morph: CINEMATICS §2, "a style change is a cut").
4. **Cut and sound:** MiniMax Music 3 sting (or the shard's boss cue), Stable Audio 3 / MOSS hits, the cut on its
   onsets (`scripts/steam-trailer/p15/assemble.py` adapted). No corner tag: it is in the game.
5. **Encode:** `scripts/cutscenes/encode.sh`: HEVC (`hvc1`) and H.264 at 720 × 1280 (~2 Mb/s) and 1080 × 1920
   (~4.5 Mb/s), 30 fps (the phone's Low Power cap), audio as a separate AAC / Opus cue for the audio bus, a WebP
   poster; uploaded to Blob like `site/media.json`, a manifest per shard. ≤ 15 s and ≤ 6 MB per clip.

## 5. First cutscenes

| # | Moment | Kind | Why it goes first |
|---|---|---|---|
| A | **Nalati · the Golden King's intro** | in engine | the most direction today, its beats already data (lid, rise, shaft pulse; name card, reins lock); a wide shot of the kurgan, a low shot as he rises, back to your view on the card |
| B | **Pine Hollow · the Antler King's intro** | generated + in-engine fallback | the P15 Party trailer already pitched this moment (*"the Antler King rises out of it, colossal"*): the game delivering the trailer's promise |
| C | **Driftwood · the finale** | in engine | the one story ending that exists: the reward view becomes three shots with Wendell's lines as captions, then the ShardComplete card |

## 6. Rows

| # | What | Done when | Owner |
|---|---|---|---|
| IC0 | **Inventory at HEAD**: a portrait clip of each moment in §1 (five boss intros, Driftwood's finale, the Pine rides), a labelled board; §1 corrected | the board and clips are in `progress/cutscenes/ic0/`; §1 matches them | cutscene lane |
| IC1 | **Engine timeline core**: `src/engine/cinematic/` Timeline, camera owner, `pov` / `rig` / `hold` / cut, letterbox lifted from BossBar, control track (input lock, HUD hide, skip), snapshot / restore; unit tests on the clock; ENGINE.md section | the tests pass; no shard uses it yet; the guards are green | cutscene lane |
| IC2 | **Port today's moments** onto the timeline: `BossBrain` intro and `QuestRewardBeat` | the five intros and the finale look as in IC0's clips (side-by-side frames) | cutscene lane |
| IC3 | **SDK data**: `@wildshard/sdk/cutscenes`, the shardfile `cutscenes` table, a boss row's `intro` naming a cutscene; the template's example; SHARDS.md section | the template builds and validates a cutscene from data alone; SHARD-PLATFORM's coordinator signs off the schema | cutscene lane + SHARD-PLATFORM |
| IC4 | **Caption and cue tracks**: timed lines in the dialogue style, music / SFX events on the timeline clock | a test cutscene on the template plays two lines and a sting | cutscene lane |
| IC5 | **First in-engine cutscene, A**: the Golden King, 3–4 shots, behind Developer; Debug row *intro: today · in engine* | a portrait clip sent to Jake; physics walk unaffected (no colliders change) | cutscene lane |
| IC6 | **Video track**: the `<video>` overlay, muted with sound on the audio bus, preload on arm, poster, fallback; memory read on the Simulator (`scripts/sim-lane.sh`) | plays a test clip on the template; default-off behind a Debug row until a physical-device memory reading (AGENTS.md, Rendering) | cutscene lane |
| IC7 | **Portrait generation test**: one LTX-2.5 shot at 704 × 1280 from an in-engine capture of the Antler King's arena; `scripts/cutscenes/encode.sh`; sizes and a contact sheet | a 4 s portrait shot passes the CINEMATICS gate; the encode's MB per 10 s recorded here | cutscene lane |
| IC8 | **Generic hero sheet**: one hero in each shard's style, seen from behind, identity anchors (CINEMATICS §2), from in-engine-faithful refs | a labelled sheet in `art/cutscenes/round-1-hero/` | cutscene lane |
| IC9 | **First generated cutscene, B**: the Antler King, ~8–10 s, in from the live view, out on the name card; in-engine fallback; Developer + the Debug row *today · in engine · video* | a portrait clip sent to Jake; the clip ≤ 6 MB on Blob | cutscene lane |
| IC10 | **Story beat, C**: Driftwood's finale as an in-engine cutscene with Wendell's lines, then the ShardComplete card; behind Developer | a portrait clip sent to Jake | cutscene lane |
| IC11 | **Video in a shard**: a `video` asset kind in shardfile admission (MP4 only, ≤ 15 s, ≤ 1080 × 1920, ≤ 6 MB, streamed outside the playable closure, an in-engine fallback required) | the template admits a clip and refuses an oversize one with a REFUSAL line | cutscene lane + SHARD-PLATFORM |
| IC12 | **Jake's picks** on A, B, C: the winner ships (Developer off when he says it's ready), the Debug row and the losing code go in one commit | each moment has one version left | Jake, then cutscene lane |
| IC13 | **The rest of the intros** on the picked format: the Storm Roc (today's yaw snap), the Storm Titan, the Matriarch | each has a clip sent to Jake | cutscene lane |

Order: IC0 → IC1 → IC2 → (IC3, IC4) → IC5 → IC6 → IC7 → IC8 → IC9 → IC10 → IC11 → IC12 → IC13. IC7 and IC8 need no
engine code and can run beside IC1–IC4 (they hold the model lock, not the tree). Heavy proofs per milestone, not per
row: the boss smoke and memory reads at IC5, IC9 and IC12.

## 7. Picks for Jake (asked with the question tool when he gives the go)

**Jake's answers (question tool, 2026-10-10):**
1. *"Hybrid but I do think the pre rendered cutscenes are the most interesting to me"* — hybrid stands; the generated
   (pre-rendered) track gets equal weight with the engine timeline, not a token "1–2 hero moments" afterthought.
2. *"Those three plus extra driftwood content at least 3 driftwood cutscenes"* — Golden King (engine), Antler King
   (generated), Driftwood finale (engine), **plus Driftwood gets at least three cutscenes in total** (rows to add).
3. *"Generic hero, from behind"* — as recommended.

The original questions, for the record:

1. **Hybrid, in engine first** (D1)? Recommended: yes.
2. **First three moments** (§5: Golden King in engine, Antler King generated, Driftwood finale)? Recommended: yes.
3. **Generated clips use one generic hero, seen from behind; no hero on screen in engine shots for v1** (D2)?
   Recommended: yes.

## 8. Not in this plan

Equipped outfits or the player's own look in cutscenes (Jake's "separate problem"); voice acting; NPC facial
animation; cutscenes in the marketing trailers (TRAILERS); multiplayer-synced cutscenes.
