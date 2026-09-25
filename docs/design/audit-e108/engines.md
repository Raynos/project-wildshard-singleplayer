# Free JS game engines — and how to get Wildshard to feel finished (E108)

*Research 2026-09-24; versions from the npm registry that day. Updates the E45 audit (`docs/plans/ENGINE-FIT.md`, 2026-09-23).*

## (a) The answer

**Don't switch engines. The chaos isn't coming from the renderer, and no free engine would remove it.** The game is 90.7k lines across 394 files; 246 of them import three.js directly and 39 patch its shaders by hand. Moving to Babylon.js or PlayCanvas would mean rewriting almost everything for months, and what you'd mostly gain is an inspector, an editor and an audio mixer. Godot, Bevy, Wonderland and Cocos fit worse: a bigger download, weaker iPhone Safari support, royalties, or a visual editor that AI agents can't drive well.

The E45 audit was right about the foundation, and three of its five "engine parts" are now built:
- E1: one world registry (`src/world/registry.ts`)
- E2: frame phases with a fixed 60 Hz step (`Game.onFixed`)
- E3: one shared character controller (`src/physics/CharacterMotor.ts`)

What "a lot of pieces, a lot of chaos" actually describes is too many things in flight and too little automatic checking:
- **Scope:** 3 shards, 12+ weapon files, a horse, taming, bosses, Explore mode.
- **Load:** 9 live plans, 19 open asks, about 870 commits in 7 days.
- **No safety net:** nothing plays the game in a browser before a deploy.
- **Loose foundations:** input is wired separately in 26 files with no gamepad support, and there is no shared kit for how a hit feels.

Polish comes from four things:
1. Fewer things in flight.
2. An automatic playtest that must pass before any deploy.
3. One input layer and one kit for hit feel.
4. A time-boxed "feel pass" with a clear list of what done means.

## (b) Engine comparison

"AI" = how well coding agents work with it: API familiarity, text files that diff cleanly, no required editor. "Migration" = the cost of moving this game.

| Engine (Sep 2026) | Licence | WebGPU | iPhone Safari | Physics | Editor | AI | Migration | Verdict |
|---|---|---|---|---|---|---|---|---|
| **three.js r186** (0.186.1; r187 in progress) | MIT | Yes: WebGPURenderer, falls back to WebGL2; TSL shaders also run on WebGL | Good (WebGL2 everywhere; WebGPU since iOS 26) | Bring your own (we use Rapier 0.20) | None (code only) | **Best**: 12M downloads a week, has llms.txt | none | **Keep** |
| R3F 9.8 / Threlte 8.6 | MIT | Via three (R3F v10 alpha is WebGPU-first) | Via three | @react-three/rapier | Triplex (R3F) | Good | L: everything rewritten as React/Svelte components | No |
| **Babylon.js 9.28** (9.0 released 2026-03-26) | Apache-2.0 | Mature | Good | Havok built in, with a character controller | Inspector v2, node editors, frame graph | Good, TS-native | **L+**: full rewrite, and the Rapier work is lost | Best "real engine", but not worth a rewrite |
| **PlayCanvas 2.22** | MIT (engine and editor) | Mature, with compute | Strong on mobile | ammo.js (Rapier/Jolt hook is alpha) | Cloud editor with an MCP; React / web components | Mid: the editor owns the scenes | **L+** | No |
| Needle 5.1 (6.0 in alpha) | Commercial use is paid (from €49 per seat per month) | Via three | Via three | Rapier | Exports from Unity / Blender | Good (MCP) | M–L: ships its own older copy of three | No; its dev Inspector is useful |
| Godot 4.7.2 | MIT | **Not on the web** (web builds are WebGL2 only) | Weak: an open 4.5-dev issue reports iOS audio crashes | Godot / Jolt | Full desktop editor | Mid: GDScript, scenes live in the editor | **XL**: new language, and C# can't build for the web | No |
| Bevy 0.19 (2026-06-19) | MIT/Apache | Yes | So-so: large WebAssembly download | Avian / Rapier (Rust) | Editor is a preview | Low: Rust, API changes every release | **XL** | No |
| Wonderland 1.6 | Free up to $120k/yr revenue, then a **10% royalty** | — | Good on mobile | PhysX | Required | Low | XL | No |
| Cocos Creator 4.0 (3.8 LTS) | MIT | Partial / unclear | Good (mini-games) | Bullet / PhysX | Required | Low | XL | No |
| IWSDK 1.0-rc (Meta, new) | MIT | Via three | Built for VR first | Havok | None; ships an MCP with 32 tools for agents | High | L: its own copy of three | Borrow its agent-tooling idea |
| Unity 6 Web / Unreal | Proprietary | Unity: experimental | Heavy: Poki measures an empty Unity project at ~11 MB; Unreal has no web export | — | — | — | XL | Listed for contrast only |

**Why not borrow one piece of Babylon or PlayCanvas?** Two renderers can't share one canvas, and their physics, audio and inspector are tied to their own scene objects. The ideas carry over; the code doesn't.

**WebGPU:** iPhones support it now, but it is not a road to polish. Our post-processing (`postprocessing`, `n8ao`) and the 39 shader patches are written for three's WebGL renderer. The WebGPU route means porting all of them to TSL, which `src/gpu/` has started for Driftwood only. Keep shipping WebGL2 and keep WebGPU opt-in until it measurably wins on a phone. (Not re-checked: whether `postprocessing` 6.x has a WebGPU build.)

## (c) Libraries worth adopting

| Library (version, date) | For | Size | Take? |
|---|---|---|---|
| **three-mesh-bvh** 0.9.15 (Sep 2026, MIT) | Fast ray and shape tests against meshes: melee arcs, keeping the camera out of walls, foot placement, Explore picking | ~30 KB gz | **Yes**, behind `src/physics/query.ts` so the physics rule still holds |
| **three Inspector** (`three/addons/inspector`, since r181) | GPU frame timings, memory, a timeline | dev only | Yes, on the WebGPU path (stats-gl stopped working there in r181) |
| **Needle Inspector** (Chrome extension + MCP) | Lets agents look at and edit the live scene of any three.js page | dev only | Yes, free |
| **Playwright** (already installed) | Headless playtests, screenshot comparison with `toHaveScreenshot` | dev only | **Yes, as a CI gate** (R1) |
| **glTF-Transform** 4.5 + meshopt + KTX2 (already installed) | Offline model and texture compression | build time | Keep; make KTX2 the default everywhere |
| **koota** 0.6.6 (pmndrs, Sep 2026) | An ECS, just for crowds: animals, projectiles, pickups | 12 KB gz | Later, if creature counts keep growing. Not for the whole game |
| **XState** 5.33 | Game flow: menus, quests, the pause/dialog stack | ~15 KB gz | Maybe. For per-frame combat and animation states, a small typed state machine is better |
| **three.quarks** 0.17 | Batched particles: sparks, trails | 39 KB gz | Later, during a feel pass |
| Howler 2.2.4 | Audio | — | **No**: last updated 2023, and we already use Web Audio directly |
| Babylon audio v2 | A mixer with buses | — | **No**: it needs @babylonjs/core. Copy its bus layout instead (master / music / sfx / voice / ui) |
| theatre.js, three-inspect, r3f-perf, becsy | — | — | No: not updated since 2024–25, or needs React |

## (d) The polish checklist

Drawn from Celeste's "forgiveness" write-up, the Dead Cells GDC 2019 postmortem, "Juice it or lose it", "The Art of Screenshake", and shipped browser games (Shell Shockers on Babylon, Venge.io and Mini Royale on PlayCanvas, Bruno Simon's 2025 folio on three.js with WebGPU and Rapier). Dead Cells: *"Most reviews talk about controls before gameplay"* and *"never blame the game for poor controls."*

**Engine-level controls**
- [ ] **Input buffer** of 100–150 ms: a press shortly before an action becomes possible still counts. Sword combos queue already; dodge, jump, bow and interact don't.
- [ ] **Coyote time** of ~100 ms: you can still jump just after walking off a ledge. *Not in the code.*
- [ ] **Cancel windows**: a dodge can cut short the end of an attack.
- [ ] **One input layer** with actions and contexts (walk / ride / menu / explore / dialog), plus gamepad support and rebinding (E4).
- [ ] **Aim assist and intent reading**: lock-on and aim assist exist; apply them the same way to every weapon.

**When a hit lands**
- [ ] Hit-stop (exists).
- [ ] Camera shake that builds up and fades out, with a cap.
- [ ] A brief white flash on the target, plus knockback.
- [ ] Layered sound: swish, impact, reaction.
- [ ] Haptics on phones.
- [ ] All of this in **one data table per weapon**: 12 rows, not 12 files that each do it their own way.

**Enemies**
- [ ] A readable wind-up before every attack.
- [ ] Only one or two enemies attack at once.
- [ ] Hit reactions, and deaths that settle into ragdolls.

**Camera**
- [ ] Smoothed, and never clips through walls (three-mesh-bvh).
- [ ] A small FOV kick when sprinting.
- [ ] Subtle head-bob, with a reduce-motion option.

**Performance**
- [ ] A steady frame rate with no shader-compile hitches.
- [ ] Frame-time budgets checked for each device tier.
- [ ] Poki's targets: **≤5 MB to start playing, ≤8 MB in total**. Pine Hollow was 10.6 MB.

**Finish**
- [ ] Short loops: from death back to playing in a few seconds.
- [ ] Menus, pause, and resume after an app switch are reliable.
- [ ] One art direction per shard, applied everywhere in it.

**Stability**
- [ ] Runtime errors get reported back to you. Today they only show in a local modal (`src/ui/ErrorModal.ts`).
- [ ] A playtest must pass before every deploy.

## (e) Ranked recommendation (S ≈ a day of agent time, M = 2–5 days, L = weeks)

1. **R1: a golden-path playtest that must pass before every deploy (M).**
   - Playwright boots each shard, walks for 10 s, swings, shoots, mounts the horse (Nalati), then pauses and resumes.
   - The deploy fails on a console error, a NaN or black frame, a frame-time budget miss, or a screenshot that drifts past tolerance.
   - CI runs unit tests today but never *plays* the game. This is the single biggest bug-reducer.
2. **R2: report runtime errors (S).** Send uncaught errors and unhandled promise rejections to the existing `api/inbox`, tagged with the build id, shard, URL and device tier. Surface them in the session brief.
3. **R3: a "showrunner" rule (S, process).**
   - At most 3 live plans at a time.
   - No new features until the vertical slice is done.
   - Then a feel-and-bug pass that ends when the checklist in (d) is ticked.
   - As the Dead Cells team put it: "You're a showrunner!"
4. **R4: E4, an input layer (M).**
   - Actions and contexts, an input buffer, coyote time, gamepad support and rebinding.
   - Replaces the listeners spread across 26 files and the fake key events injected into the player.
5. **R5: one weapon-feel kit (M).**
   - A data-driven `WeaponDef`, a per-hit feedback stack (shake, flash, knockback, sound layers, haptics) and cancel windows.
   - Then cut or merge down to a core set of weapons that each feel great.
6. **R6: E5, one module per shard (M–L).** Removes the ~55 `style`/`ocean` checks and 15 slug checks scattered through shared code.
7. **R7: a game probe for agents (S–M).** A dev-only `window.__ws` that reports state: player pose, fps, errors, entity counts, the current input context. R1 and agents both use it, the way IWSDK and PlayCanvas give agents an MCP.
8. **R8: three-mesh-bvh for melee and camera queries (S), plus three's Inspector for WebGPU profiling (S).**
9. **Later:** koota for crowds, three.quarks for effects, KTX2 everywhere.
10. **Avoid:**
    - switching engines
    - rewriting in R3F or Threlte
    - Needle's engine (the licence, and its own copy of three)
    - Godot, Bevy, Wonderland or Cocos for the web
    - Howler
    - chasing WebGPU for its own sake
    - rewriting the whole game as an ECS

## (f) Sources (accessed 2026-09-24)

**Versions:** npm registry (`npm view`, 2026-09-24) — three 0.186.1, @babylonjs/core 9.28.0, playcanvas 2.22.4, @needle-tools/engine 6.0.0-alpha.3, @react-three/fiber 9.8.1, @threlte/core 8.6.1, koota 0.6.6, xstate 5.33.2, howler 2.2.4 (2023), three-mesh-bvh 0.9.15, @iwsdk/core 1.0.0-rc.2, @wonderlandengine/api 1.6.1, r3f-perf / three-inspect (2024).

**three.js and WebGPU**
- three.js in 2026 (Utsubo, updated 2026-09-24): https://www.utsubo.com/blog/threejs-2026-what-changed
- three.js r187 milestone PR #34610 (2026-09-20): https://github.com/mrdoob/three.js/pull/34610
- stats-gl no longer works with WebGPU as of r181; use the three Inspector: https://discourse.threejs.org/t/webgpu-r181-fyi-stats-gl-no-longer-compatible-with-webgpu/87944
- WebKit, WebGPU in Safari 26: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/

**Babylon.js**
- Babylon.js 9.0 (2026-03-26): https://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0/
- Babylon 8 audio v2 and Havok character controller (2025-03-31): https://blogs.windows.com/windowsdeveloper/2025/03/31/part-2-babylon-js-8-0-audio-gaussian-splat-and-physics-updates/

**PlayCanvas**
- Engine: https://github.com/playcanvas/engine
- Editor: https://playcanvas.com/products/editor
- Physics alternatives to ammo.js: https://developer.playcanvas.com/user-manual/physics/ammo-alternatives/

**Needle**
- Pricing: https://needle.tools/pricing/
- Needle Inspector: https://needle.tools/needle-inspector-devtools-for-threejs

**Godot**
- Godot 4.7 web, WebGL2 only / wasm64 (2026-06-19): https://app.cinevva.com/news/2026-06-19-godot-4-7-released
- iOS audio crash issue: https://github.com/godotengine/godot/issues/107390
- C# on the web: https://forum.godotengine.org/t/is-there-an-update-on-exporting-c-projects-to-web/128821

**Other engines**
- Bevy news: https://bevy.org/news/
- Wonderland pricing: https://wonderlandengine.com/pricing/
- Cocos Creator 4.0 manual: https://docs.cocos.com/creator/4.0/manual/en/
- IWSDK AI tooling: https://iwsdk.dev/ai/
- Viverse engine overview (2026-06-30): https://news.viverse.com/post/which-game-engine-web-games-2026

**Browser games**
- Poki engine guide and size targets: https://developers.poki.com/guide/web-engine
- Shell Shockers deep dive (2023-01-30): https://newsletter.gamediscover.co/p/deep-dive-shell-shockers-multi-million
- Venge.io showcase: https://forum.playcanvas.com/t/showcase-venge-io/13609
- Bruno Simon folio-2025: https://deepwiki.com/brunosimon/folio-2025

**Game feel**
- Celeste & Forgiveness (2020): https://www.maddymakesgames.com/articles/celeste_and_forgiveness/index.html
- Dead Cells GDC 2019: https://media.gdcvault.com/gdc2019/presentations/Benard-Sebastian-DeepCells.pdf
- Deepnight game-feel demo (2024): https://deepnight.net/games/game-feel/
- Juice / screenshake talks (Kenney's list): https://kenney.nl/knowledge-base/learning/must-see-videos-for-indie-developers
- Input buffering: https://barbariangrunge.com/game-feel-input-buffering/

**Libraries**
- koota with vanilla three.js (2026-02): https://github.com/ibabkov/threejs-koota-ecs-example

**Not verified as current**
- Whether the Godot iOS audio issue is fixed in 4.7.
- Cocos 4.0's WebGPU status and release date.
- Whether `postprocessing` 6.x has a WebGPU build.
- Poki's empty-project size figures (the page is undated).
