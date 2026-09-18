# The user's asks — one ledger, every request, its status, its evidence

Kept current by the parent at every commit and every time the user asks for something. Newest at the bottom;
a row never leaves — it moves from **open** to **done** (with the commit / evidence) or **dropped** (with the
user's words). If it is not in here, it was not asked, or the parent forgot — say so.

Status: **open** (nobody on it) · **in flight** (owner named) · **needs pick** (waiting on the user) · **done** · **dropped**.

Two Claude sessions work this checkout (herdr panes "Wildshard prototype 1" = load/boot/perf, "prototype 2" = phone UI/controls/menu). Each adds its own rows; prefix the ask # with the pane number when it matters.

## 2026-09-17 (evening, phone playtest)

| # | ask (the user's words, shortened) | status | owner / evidence |
|---|---|---|---|
| 1 | Main screen for the pine chunk is **not mobile friendly** | **done** | live build was stale (`5cc42cc`, no `@media`); redeployed HEAD; phone layout `98abf69` |
| 2 | Move the **reload/build pill top-right**, 3× smaller | **done** | `01cbb04` |
| 3 | Background world animation on the phone "looks broken"; **freeze it** | **done** | prototype 1 `d1ede6f` (attract camera frozen on the phone tier); superseded by #34 (menu shows hero stills, no world) |
| 4 | Menu takes too much space; **no chunk metadata**, just an Enter World button; shard list way smaller | **done** | `98abf69` phone intro; then replaced by the deck menu (#16) |
| 5 | **Kill double-tap zoom and text selection** (Safari) | **done** | `98abf69` viewport + touch-action; `0a2455f` touchmove/gesture block |
| 6 | **Mobile-friendly first-person view, fix the FOV** | **done** | `98abf69` Hor+ FOV (72° → ~94° vertical on portrait); crossbow pose/scale `881cc19` |
| 7 | **Touch controls** (there were only desktop controls) | **done** | `src/player/TouchControls.ts` `98abf69`, wired by prototype 1 `81c41e9` |
| 8 | Loading screen **bumps down on double-tap** | **done** | `0a2455f` (rubber-band blocked); `position:fixed` part reverted in `5b3d92d` (left a dead band under the bar in PWA mode) |
| 9 | Crossbow takes 100 % of the width — **whole crossbow in ~60 %** | **done** | `881cc19` (~64 %) |
| 10 | **Control bar** bottom 15 %: twin-stick, left move / right look; the four buttons just above it | **done** | `881cc19` |
| 11 | Three **codex mockups of the main menu** | **done** | `art/menu-A-cinematic.png`, `menu-B-list.png`, `menu-C-cards.png`; sent; user picked **C** |
| 12 | **Look UI needs to be faster** | **done** | `e852116` (0.54°/px, ×1.6 in the pad) |
| 13 | Move/look **only inside the bar** | **done** | `0c8dccb` |
| 14 | Crossbow "spazzed out" | **done** | `881cc19` — viewmodel lag spring diverged below ~15 fps (explicit Euler, k·dt² > 1); substepped |
| 15 | Need a **pause menu** + pause button + **Exit to main menu** | **done** (see #33) | `5b3d92d`; exit currently reloads → the user wants no reload (#33) |
| 16 | Build menu **C** in a subagent; carousel changes the hero image; placeholders: **Nalati grasslands** (coming soon), **Wind Waker–style low-poly island** (coming soon); only Pine Hollow enterable | **done** | `8db9a2c` (subagent); heroes `art/hero-*.png`; `src/chunks/placeholders.ts` |
| 17 | Carousel not snappy — **paginate**, always centred, never half-way | **done** | `5b3d92d` JS-driven track, one card per swipe |
| 18 | **Movement speed** triple → then "triple was silly, **double**" | **done** | 3× `5b3d92d`; 2× in the next commit (`Player.ts` 8.6 / 14.4 / 4.4 m/s) |
| 19 | Bottom bar **not touching the bottom** in PWA mode | **done** | `5b3d92d` — dropped `position: fixed` on html/body; confirmed gone in the 22:33 screenshot |
| 20 | Dynamic run speed not working — past the ring it **drops to walking** | **done** | `e13157d` — direction was divided by the unclamped finger distance |
| 21 | Stick ring **centred in the bar** | **done** | `e13157d` |
| 22 | "NEW BUILD · TAP TO UPDATE" **off the game view** — menu only | **done** | `e13157d` |
| 23 | Loading screen **regression** (bars gone, text misaligned) | **done** | `a0d1641` — carousel `.ws-track` collided with Loading.ts's `.ws-track` |
| 24 | **No world / no sounds / no fps meter on the main menu**; hero images only | **done** | prototype 1 owns main.ts (world paused + muted while the intro is up); Pine Hollow heroes: this session (#31) |
| 25 | **CSS sculpted per page** — unique class names per screen, fix it permanently | **done** | `087a862` `f80893d`: `hud.css` → `src/ui/styles/{base,game,menu,pause,touch,update}.css`, one prefix per screen, `scripts/check-css.mjs` on prebuild (fails on collisions; loading/perf warn-only until prototype 1 renames `ws-tagline`/`ws-fps`); also fixed the compass letters picking up the deck's `.ws-card` |
| 26 | **Tap the look pad to fire**, remove the FIRE button | **done** | `df60e4c` (tap < 12 px / < 300 ms in the LOOK pad fires) |
| 27 | **Aim is a toggle**, not a hold | **done** | `df60e4c` (AIM latches, cyan while on) |
| 28 | **Aim = iron sights**, not a zoom: no crosshair, crossbow centred; **3 codex mockups** → user picked **A** | **done** | `859379d` (bolt tip on the aim line, FOV 72 both ways, crosshair fades; portrait limbs 72 %) — `art/ads-A-centred-low.png`, `ads-B-eye-level.png`, `ads-C-peep-sight.png` sent (B's HUD was redrawn by codex — judge the pose only) |
| 29 | Exit to main menu **bumps to the loading screen** — should go to the chunk selector | **done** | `fd5d8de` (HUD re-shows the deck, no reload) + prototype 1 `9bda267` (world frozen + muted under it) |
| 30 | **Loading screen gone** (blank, build `b-mu6ezhob`) | **done** | prototype 1: `.ws-load` root rules restored in loading.css; live `b-mu6f75ka` |
| 31 | **Codex hero image for Pine Hollow** so the menu never shows the live world at 29 fps | **done** | `815d8e6` `art/hero-pine-hollow-{portrait,landscape}.png` → `src/chunks/thumbs/`, `heroPortrait/heroLandscape` on the ChunkDef; the menu shows it once #33 lands |
| 32 | **Show me the three (iron-sights) mockups** / **what's the current progress** | **done** | sent 22:46 |
| 33 | **The flow**: startup/reload → loading (always) → main menu = chunk selection → Enter → Pause → Exit → chunk selection **without** reload or loading screen | **done** | prototype 1: world pause/mute + `hud.onExitToMenu`; this session: HUD re-shows the intro, never reloads |
| 34 | Port trials-gauntlet's **asks process** so chat asks persist durably | **done** | this file; `AGENTS.md` bullet; `.claude/hooks/session-brief.sh` + `.claude/settings.json` SessionStart |
| 35 | "Current build is pretty badly damaged, I'll wait for a deploy" | **done** | `b-mu6f75ka` (loading fix + perf) then `b-mu6fmkqb` (CSS split, tap-to-fire, AIM toggle, 2× speed, Pine Hollow heroes on the def) |
| 36 | **Iron sights rebuilt to match mockup A** — 859379d rejected ("does nothing about aiming down the iron sights"): camera must look down the bolt axis, tip just below centre, string at the bottom, limbs mid-height | **done** | `9597753` — ADS pose solved at runtime from the bolt/nut geometry + FOV per aspect (`src/player/Crossbow.ts`, rotation 0, tip at NDC (0, −0.12), nut just in front of the near plane; limbs ±0.63 desktop, edge to edge portrait; bolts fly the eye→tip ray so the impact projects on the tip) |
| 37 | **Hoverboard mode + toggle button; walk speed back to 1×** ("double run speed feels silly now") | **done** | `c3632f2` (landed inside that commit — its message says iron sights; the hoverboard diff is in it): `Player.ts` 2.2 / 7.2 / 4.3 m/s again; hover = `H` / HOVER touch button (latched), 14 m/s cruise, 0.45 m ride height, ≤ 6° roll; `src/player/Hoverboard.ts` viewmodel |
| 38 | **New HUD from approved mockups K1 + P2** — compass band with cabin/animal markers + CABIN · 180 m readout (desktop + touch), round AIM / JUMP discs, vitals + bolts inside the control bar corners, no RELOAD button | **done** | `5d4b82a` compass band (HUD.ts + game.css; `hud.setAnimals()` / `HUDState.nearest` feed the paw — main.ts not yet wired, so no paw in play) · `cc1ad79` P2 touch layout (bar strips, discs, HOVER disc kept, PAUSE under the compass) |
| 39 | **Tracer bolts + bolts stay stuck in trees (debugging the sights)** — "a massive glowing red tracer" to see where the bolt goes; bolts stick in trees permanently for target practice | **done** | `03d00ac` — `TRACER_ON` in `src/player/Crossbow.ts` (`?tracer=0` off): red glow on the flying bolt, 8 px solid-red trail of the whole flight (no depth test, 6 s then fades), distance-scaled red ring at the impact; stuck bolts never despawn (cap 200), head 8 cm into the drawn bark, red nock dot; trunk hit test = full padded radius over the full trunk |
| 40 | **Rear peep sight for ADS** (mockup `art/ads-C-peep-sight.png`): a round iron sight the bolt goes through the middle of — "then I know exactly that the bolt should be going into the middle of this round iron sight" | **done** | `bc41246` — ring on a post in front of the nut, centre solved onto the eye→tip line (`adsPose.peepY/peepR`); ring vs tip within 0.003 NDC desktop + phone; tracer impact lands in the ring. Tracer is now a runtime setting: `getSetting('tracers')` (`src/ui/Settings.ts`, localStorage `ws.settings.v1`) read per shot, `?tracer=0/1` writes it once at load |

| K2 | One HOLO SURVEY HUD edit of base-phone; save art/hud-K2-holosurvey.png | **done** | art/hud-K2-holosurvey.png; built-in imagegen single generation |

| K3 | One built-in image edit: Cartographer HUD on base-phone; save art/hud-K3-cartographer.png | **done** | art/hud-K3-cartographer.png; single built-in imagegen edit |

| K1 | One Staging Glass HUD edit of base-phone; save art/hud-K1-stagingglass.png | **done** | art/hud-K1-stagingglass.png; one built-in imagegen edit |

| N2 | One built-in image edit: CONSOLE BAR on base-phone; save art/hud-N2-consolebar.png | **done** | art/hud-N2-consolebar.png; single built-in imagegen edit |

| N3 | One built-in HOLO BAR edit of base-phone; save art/hud-N3-holobar.png | **done** | art/hud-N3-holobar.png; one built-in imagegen edit |

| N1 | One built-in image edit: GRIP BAR HUD on base-phone; save art/hud-N1-gripbar.png | **done** | art/hud-N2-consolebar.png; single built-in imagegen edit |

| P1 | One built-in EDGES HUD edit of base-phone; save art/hud-P1-baredges.png | **done** | art/hud-P1-baredges.png; single built-in generation; outer-edge vitals/ammo |

| P2 | One built-in TOP CORNERS HUD edit; save art/hud-P2-barcorners.png | **done** | art/hud-P2-barcorners.png; single built-in generation |

| MB | One built-in terrain minimap screenshot edit; save art/minimap-B-terrain.png | **done** | art/minimap-B-terrain.png; single built-in imagegen edit |

| MINIMAP-A | One built-in radar minimap screenshot edit; save art/minimap-A-radar.png | **done** | art/minimap-A-radar.png; single built-in imagegen edit |

| MC | One built-in screenshot edit: holo ring minimap; save art/minimap-C-holo.png | **done** | art/minimap-C-holo.png; single built-in generation |

| MK1B | One built-in terrain minimap edit of K1 screenshot; save art/minimap-k1-B-terrain.png | **done** | art/minimap-k1-A-radar.png; single built-in imagegen edit |

| MK1A | One built-in edit of K1: circular radar minimap; save art/minimap-k1-A-radar.png | **done** | art/minimap-k1-A-radar.png; single built-in imagegen edit |

| MK1C | One built-in K1 screenshot edit: holo ring minimap; save art/minimap-k1-C-holo.png | **done** | art/minimap-k1-A-radar.png; single built-in imagegen edit |

| L1 | Load **5× faster on the iPhone**; the shaders step sat at "140 / 142" for 10–53 s; "the load time of all these shaders and programs is really bad" | **in flight** (load-speed agent; phone reading pending) | Round 1: `d584095` precompile everything (scene + shadow-depth + sky box + post chain, parallel link, live count; r186 PCFSoft→PCF recompile settled) · `3996b33` LINK_STATUS resolve · `5c6b8ef` textures uploaded in the step. Round 2: programs 103 → 75 (`d4c9657` `0b731ef` `114b4b3` `c4287fd` `05980ed` `714b6c2`), 0 at first frame; `9f6c3e2` SW static-cache migration (the 16 s cabins run was a cache wipe: +1 asset deploy now costs 0.83 MB not 33 MB). Desktop fresh context: shaders 3.5 s → 0.28 s, first frame 1.86 s → 0.07 s. |
| L2 | Loading bar is **not continuous — arbitrary chunks** | **done** | `da7c9c3` — steps weighted by the previous run's wall ms (localStorage per tier/cores), running step = max(sub-progress, elapsed/expected) < 1, republished every frame; 100 only at done(). Desktop trace: 232 paints / 1.2 s, 0 regressions, longest gap 214 ms. |
| L3 | **Pre-bake at deploy time** so the phone does no maths at launch | **done** (terrain, cards, clouds/planet/fur textures, sun/horizon) / open (PMREM, cabin geometry, KTX2) | `937c76d` terrain.bin (Heightfield lookups) · `0ad009e` branch cards headless (`scripts/bake-cards.mjs`) · `2bb4d4c` procedural textures (`bakedTexture()`, `scripts/bake-textures.mjs`) · `5519871` sky.json. Desktop fresh context per step: sky 89 · terrain 82 · cards 68 · grass 65 · cabins 94 · herds 16 (was 105) · shaders 277 · first frame 72; 2.4 s to the world incl. browser start. |
| MM1 | **Top-down circular minimap (B)** with red/yellow animal dots — art/minimap-k1-B-terrain.png | **done** | `b3b6568` src/ui/Minimap.ts + minimap.css (north-up, scrolls, fog of war, deer yellow / boar red + charge pulse); main.ts wiring (`new Minimap()` + `minimap.update(...)`) owned by the HUD session |

| BUTTONS-C | One built-in screenshot edit: lower crossbow and corner discs; save art/buttons-C-lowered.png | **done** | art/buttons-C-lowered.png; single built-in imagegen edit |

| BUTTONS-A | One built-in screenshot edit: edge-docked AIM/JUMP discs and right-edge HOVER pill; save art/buttons-A-edges.png | **done** | art/buttons-B-inbar.png; single built-in imagegen edit |

| BUTTONS-B | One built-in screenshot edit: compact AIM / HOVER / JUMP pills inside control bar; save art/buttons-B-inbar.png | **done** | art/buttons-B-inbar.png; single built-in imagegen edit |
| 40 | **Hunting feel** — "deer run away very fast and are very easy to scare, I just can't shoot them"; health bars above the deer; MMO-style MISS / damage numbers when I shoot at something | **done** (hunting-feel agent; main.ts wiring = `new Combat(game, animals, crossbow, game.camera)` + the 2-line Crossbow damage hook, see report) | `696f89b` — `DEER_TUNING` / `BOAR_TUNING` in `src/entities/AnimalManager.ts`: sight cone ±75° (52 m head-up / 26 m grazing) + hearing 5/11/26/48 m by player speed feed an awareness meter; alert = head up + 1.8–3.2 s freeze (the shot window), then bolt at 8.6 m/s only to 65–90 m, trot, look back, graze; hit → bolt at once; boar charges when hit ≤ 25 m or you ≤ 10 m; a bolting animal takes its herd (15 m). `src/ui/Combat.ts` + `combat.css`: pooled `ws-combat-hp` bars (≤ 6 on phone, within 60 m, hit < 4 s ago or under the crosshair), `ws-combat-float` numbers / HEADSHOT / KILL / MISS. Deer 60 hp, boar 100, body 32–40 (falloff past 40 m), head ×2.5. progress/071–073 |
| 41 | **Aim assist (touch) + pause-menu toggles** — "like PS4 Call of Duty / GTA 5 with a controller — it helps, it snaps, some stickiness … but don't make it trivial"; AIM ASSIST and TRACER BOLTS as toggles on the pause menu | **done** (aim-assist agent; main.ts wiring = `setAimTargets(animals.animals)` from `./player/AimTargets`, Crossbow should read `getSetting('tracers')`) | `4961546` + follow-up — `src/player/AimAssist.ts` (touch only, from `player.preUpdate`): friction ×0.6 hip / ×0.45 ADS inside a screen-space bubble (animal radius + 0.8 / 1.2 m ≈ 4.5° / 5.5° at 20 m, → ×1 at the edge), 180 ms ease-out snap onto the upper body when AIM latches (≤ 5.2° at 20 m, lands 0.4° short, not during a > 200 px/s flick), 65 % bearing-rate tracking inside 2.6° (≤ 45°/s, released by a drag away). Measured: 4.0° → 0.41° in 180 ms; 0.87°/px → 0.54°/px at the centre; walking deer 5.7°/s → sight follows 3.7°/s; switch off = 0.000° moved. `src/ui/Settings.ts` (localStorage ws.settings.v1), pause SETTINGS pills in `HUD.ts` / `pause.css`. progress/075–076 |
| 42 | **Hoverboard jump needs oomph**; **double jump** when walking | **done** | `66342aa` — 9.5 m/s ballistic launch, nose kick, landing compression; edge-triggered double jump |
| 43 | **Iron sights: add the round peep sight** (mockup C ring) so the bolt visibly goes through its centre | **done** | `bc41246` — ring solved onto the eye→tip line; impact lands in the ring |
| 44 | **Buttons mess up the FOV with the crossbow** — 3 codex mockups → user picked **A** (edge docks) | **done** | `art/buttons-{A,B,C}-*.png`; layout A `9c732fa` |
| 45 | **PAUSE and fps counter pushed to the very top** (×3) | **done** | `530bb35`, prototype 1 `da8384a` — both in the status-bar band |
| 46 | **HP/vitals out of the black bar** (thumbs cover it) → then "**half above, bolts back inside**" | **done** | `0673608` then `4615043` |
| 47 | **Crossbow bolts iron, not wood** | **done** | `4615043` — iron shaft in the bolt atlas |
| 48 | **Minimap 33 % bigger, compass two-thirds width floating left, minimap beside it** → then "**compass a bit lower and 25 % thinner**" | **done** | `4615043`, `62becba` |
| 49 | (parent's item) `setAimTargets(animals.animals)` is **not wired in main.ts** — aim assist is inert in production until it is | **done** | prototype 1 (main.ts): one import + one line after `animals` exists |


## 2026-09-18 (Driftwood Isle)

| # | ask (the user's words, shortened) | status | owner / evidence |
|---|---|---|---|
| D1 | "We are building Driftwood Island" — the low-poly Wind Waker–style island shard, currently a "not yet playable" teaser | **open** | this session; mockups first (D2–D4) |
| D2 | **Mockups via parallel codex agents: the spawn point in three different low-poly art styles** | **done** | art/driftwood-spawn-{A-toon,B-faceted,C-painterly}.png (third-person round) — user: **B is closest**; Claude: B is also by far the easiest (no textures, flat-shaded procedural geometry, no outline pass) |
| D3 | **Mockups of two or three points of interest** | **done** | art/driftwood-poi-{1-lookout,2-wreck-cove,3-shrine}.png — user: "the points of interest are amazing" |
| D4 | Island gameplay is **different from Pine Hollow** — "more like Zelda Wind Waker"; then: **"this game engine is still first person"**, same player/HUD code as Pine Hollow | **done** | first round was third-person (wrong); second round regenerated first-person |
| D8 | **Portrait**, with the **same HUD as Pine Hollow** (PAUSE top, minimap, black touch bar at the bottom, no ammo counter) — user sent the real phone capture as the reference | **done** | art/driftwood-fp-{spawn,poi-1-lookout,poi-2-wreck-cove,poi-3-shrine,sword-wooden,sword-iron}.png (1024×1536, style B, HUD copied from the capture, no bolt counter) |
| D9 | **Full top-down map of the island** as a codex render (what the minimap zooms out to), POIs on it | **done** | art/driftwood-map-topdown.png (1254², north up, 5 labelled POIs, 4 edge jetties) |
| D5 | Equipment: **mockups of a basic low-poly wooden sword and a basic low-poly iron sword**; one swing animation each (no shoot/reload); **first implementation = wooden sword only** | **done** (mockups) | art/driftwood-fp-sword-{wooden,iron}.png; implementation open under D1 |
| D6 | Where does **equipment / inventory** go in the UI — "forget about equipment … I'll deal with inventory and equipment later" | **dropped** (deferred by the user) | — |
| D7 | "We already implemented the boar — do the same boar in the low-poly art style, and start there" | **open** | first engine step after the mockups |

| P1 | **DPR 1.5 + AA on by default on phones** ("game changer for the crossbow") | **done** | `b-mu6i9vn4`; user confirmed 1.5 + AA stays the phone default |
| P2 | **Deer less skittish** — "I need to be able to get close and shoot them" | **done** | `6bd73ad` / `b-mu6iff3u`: sight 30/14 m, hears a walker at 12 m, 4–7 s freeze, run 6.0 (< sprint 7.2), stops at 35–50 m |
| P3 | Crossbow shader programs 8 → 4 with the look unchanged (load agent's patch) | **open** | blocked on Crossbow.ts being free of the HUD session's edits; prod anisotropy must stay |
| P4 | Remove the DBG pill (tier / dpr / aa / meter) once the graphics defaults are settled | **open** | src/ui/Debug.ts + one line in main.ts + tier.ts overrides |
| P5 | Cold first-launch bytes 30 MB → ~10 MB (baked PMREM instead of the 4 MB HDR, model textures to the phone tier, KTX2 for GPU memory) | **open** | docs/plans/LOAD-PERF.md §P1; the SW cache migration (9f6c3e2) already makes it a one-time cost |
| P6 | Shard 3 biome (shard 2 = Driftwood Isle, D1) | **open** | user: "I'll tell later" |
| X1 | Black screen on iOS app switch | **closed — accepted** | iOS restores a suspended standalone app before any JS runs; overlay / mirror / hidden canvas / manifest colour / wake lock / keep-alive audio made no difference; modal removed in `fa47487` |
| X2 | 30 fps in Low Power Mode | **closed — accepted** | iOS caps rAF and timers at 30 Hz; `?loop=timer` tried and removed |
| V1 | **Deer/boar variants + rarity** — "white deer; black boar with bigger tusks; mix up sizes — bigger boars, smaller and bigger deer; a rarity system with rarer boars and rarer deer — choose some fun stuff" | **done** | `78c0afa` — species registry (`src/entities/species/{registry,loft,deer,boar}.ts`, AnimalFactory globs the folder; bear/elk = one new file). Deer: hind, stag, **white hind/stag** (8 %), **Great stag** ×1.25 90 hp (8 %), **Piebald** rare (3 %), **Ghost stag** legendary ×1.35 130 hp cyan glow (1 %). Boar: boar, **sow** ×0.85 70 hp, **Black boar** tusks ×1.6 (10 %), **Big boar** ×1.25 140 hp (8 %), **Scarback** rare ×1.3 tusks ×1.8 180 hp (3 %), **Old Ironhide** legendary ×1.5 tusks ×2.2 300 hp, 40 % less body damage, relentless (1 %). One legendary alive per kind. Health bar shows the variant name; rare/legendary = white ring on the minimap; Pine Hollow gets a black/scarback sounder deep under the canopy. DEER_TUNING untouched (multipliers only) |
| V2 | **Bears: black + brown, aggressive** — "black bear and brown bear — aggressive enemies, they will come for you" | **done** | `ea10b2b` — `src/entities/species/bear.ts` (registry): **Black bear** common 220 hp ×0.95–1.05 (a third with a cream chest blaze), **Brown bear** uncommon 320 hp ×1.15–1.3 shoulder hump, body damage ×0.85, **Old Blackpaw** rare ×1.25 330 hp, **Grizzled Sow** rare ×1.45 480 hp. Walk 1.0 · stalk 2.5 · charge **9 m/s** (you sprint 7.2 — only the hoverboard outruns one); charge damage 35 / 45 / 42 / 55. HUNTERS (`HuntTuning.stalk`, new `stalk` AI state in AnimalManager): inside 40 m (or a bolt landing within 80 m) → alert 1–2 s → stalk toward you huffing → charge from 14 m; after a hit or a timed-out charge it keeps pressing (re-charge 1.5 s) until you are 60 m away; a hit makes it charge from anywhere, never flee (a black bear under 20 % may break off 50 %; brown / olds never). Pine Hollow: a black den (2) NW corner + a brown den (1) NE, far off the trails. Sounds bear_growl / bear_roar / bear_hurt; red pulsing minimap dot. Verified: onCharge 35 every ~2 s, vitals 100 → 65 → 30. progress/090–094 |
| D10 | **"Go ahead and implement the whole thing, incrementally, screenshots along the way; get me walking around quickly"** — world first | **in flight** | parent + agents below |
| D11 | **One subagent each: boar (low-poly), sword (wooden), world** | **in flight** | boar-agent, sword-agent, world-agent (parent wires main.ts) |
| D12 | World order: **fill the world with water + just the pier** → then **a little boat by the pier** → then **the beach** (what you see from the pier) → then the rest of the island piece by piece | **in flight** | world-agent |
| D13 | **Swimming mechanism** (subagent) — it's all water | **in flight** | swim-agent |
| D14 | **Diving** (second subagent, after swimming): in water JUMP becomes **DIVE**; holding DIVE goes down, a **SURFACE** button appears beside it that goes up; no other vertical control for now | **open** | starts when D13 lands |

| M1 | **Full map**: tap the minimap → whole chunk, drag to pan, pinch/wheel zoom, fog of war, cabins + pond as POIs, no animal markers; CLOSE / Esc / M | **done** | `019d9b9` + phone tap fix `232547a`; user: "map works" |
| D15 | "Race to the fastest checkpoint: **sword + pier**, even half broken; mark the world **super experimental**"; then keep building everything | **in flight** | parent: main.ts ocean/pier wiring; deploy once HEAD builds |
| D16 | "What else should we be building?" — Claude's list from the mockups: **gulls**, **ringed planet**, **palms**, **thatched hut**, fences/steps/signposts, **lookout + rope bridge**, **wreck cove** (glow inside → iron sword pickup), **ring shrine**, full-map screen with POI labels, boar hit-stun for melee, boar senses retuned for open beach, something to dive for, ocean-edge boundary, hero/thumbnail in style B, island audio (waves/gulls/planks/sand/splash) | **open** | rows to be split out as they start |
| D17 | **Swimming = no weapon, hands only**; simple swim-stroke hand animation; **different hand styles per shard** (Pine Hollow PBR vs Driftwood low-poly); **white gloves at all times** to dodge hand-rendering difficulty | **in flight** | swim-agent (src/player/Hands.ts); parent hides the weapon while `player.swimming` |

## 2026-09-18 (Pine Hollow gameplay: one menu, four tabs, shard achievements)

| # | ask (the user's words, shortened) | status | owner / evidence |
|---|---|---|---|
| G1 | "I need some kind of gameplay in Pine Hollow — we hunt, but there's no achievements, no progression, no quests" → **shard-specific achievements with shard-specific (funny) titles** | **open** | this session; mockups first (G3) |
| G2 | **Pause menu becomes just "Menu"** with four tabs: **Map · Inventory · Achievements · Settings**. Tapping the minimap opens the menu on the **Map** tab; the pause button opens it on the **Settings** tab (Resume / Exit / switches live there) | **open** | design → implement after the mockups are picked |
| G3 | **Mockups of all four tabs** (portrait phone, the glass HUD identity) | **done** | art/menu-tab-{map,inventory,achievements,settings}.png (1024×1536, four parallel codex runs) |
| G4 | Achievement list: **kill 5 deer, 5 boar, 3 elk, 2 bear**; reward = a **funny title** each. Titles would show under the name in multiplayer; single-player only shows them on the Achievements tab | **open** | note: **elk and bear do not exist in Pine Hollow yet** — two new species files (registry supports it, V1) |
| G5 | **Ghost stag drops a skinned crossbow, Old Ironhide drops a skinned AR-15**; picking it up just swaps the skin for now. **Mockups of what "cool" means** → then: "**implement them all** — rifle A and crossbow A are the skins that drop; the other two live in the code, no enemy drops them" | **in flight** | mockups done: art/skin-crossbow-{A-ghoststag,B-hollowash}.png, art/skin-rifle-{A-ironhide,B-scarbackfurnace}.png; code next (src/player/Skins.ts) |
| G6 | The legendary drop is **not the carcass-harvest UI** — "a sexy unique item drops on the floor, big, and you walk over it to get it" (the floating-pickup presentation) | **open** | after G2 lands; reuses WeaponPickup (the AR-15 cabin pickup) |
| W1 | **AR-15 rifle + weapon swap** — a second weapon, semi-auto, iron sights like the crossbow; `1` / `2` / `Q`, touch SWAP pill; then: the player does **not** start with it — "you gotta find it": a floating orb pickup in a cabin (art/pickup-A-bubble.png; blue orb = items, purple = rare skins) | **done** (rifle agent) | `b4edc3b` — src/player/Rifle.ts (one lit program, hitscan, damageFor × 0.55, 30 + 90, 1.6 s reload, flash / brass / kick / tracer), Weapons.ts (kit manager, holster blend, lock / unlock), WeaponPickup.ts (`ItemPickup`, tier colour, Fresnel orb + motes + light pool; cabin 1 by the door wall, `[E] Take AR-15`), HUD ammo strip generic (ROUNDS 27 / 30 + 60 + weapon tag), rifle / reload / swap sounds; `?weapon=rifle` unlocks at load. Screenshots: scratchpad rifle-*.png (hip, ADS, burst 25 / 30, reload 30 / 30 + 85, phone SWAP, pickup orb, pickup burst) |
| G2 | (update) user: "those mockups look great — **implement that**" | **done** | `8a6defc` (+ `e1c3636` build fix) — src/ui/Menu.ts + gmenu.css, src/game/{achievements,Progress,Inventory}.ts, Map.ts embedded, HUD pause → menu; progress/098-menu-*-tab.png; live |
| G7 | "Use herdr — the agent on the new island does the deploy" | **done** | handed to wildshard-proto-3 via `herdr agent prompt` (deploy from a clean `git archive HEAD` export) |
| D18 | **Plan doc in docs/plans** with everything decided: gulls, planet, sailboat, palms, hut, fences, steps, signpost, rope bridge, wreck cove + ring shrine ("go nuts"), sword combo (2–3 swings, three-hit combo, no block/dodge — strafe or eat it), iron sword hovering pickup, diving decorative only, swim forever / no drowning, same chunk-edge force field underwater, style-B hero art, loading screen, audio, SUPER EXPERIMENTAL tag; "build the whole plan overnight" | **done** (doc) / **in flight** (build) | docs/plans/DRIFTWOOD.md |

| PICKUP-A | One built-in cabin screenshot edit: holo-bubble AR-15 pickup; save art/pickup-A-bubble.png | **done** | art/pickup-A-bubble.png; single built-in imagegen edit |

| PICKUP-B | Single built-in image edit: cabin AR-15 sigil-ring pickup; save art/pickup-B-ring.png | **done** | art/pickup-B-ring.png; one built-in generation |

| PICKUP-C | One built-in cabin screenshot edit: diegetic AR-15 on crate, ammo and lantern; save art/pickup-C-diegetic.png | **done** | art/pickup-C-diegetic.png; single built-in generation |
| D19 | "**LET ME IN**" — deploy checkpoint C0/C1 | **done** | `4a7c034` built from a clean export, live at https://wildshard-singleplayer.vercel.app (build b-mu6lg86q): ocean + pier + wooden sword + swimming |
| D20 | World/sword agents as **checkpoint agents** (world v0.0.1 / sword v0.1: commit the minimal, deploy, then keep building) | **done** | both committed WIP on request; world-agent continues boat → beach → island |
| D21 | Use **herdr** to see what the other two sessions are doing (menus, floor pickups + pickup mockups, enemy variants / new enemy types) and reuse: floor-pickup for the iron sword; **low-poly bears** on the island; **add three new enemy types** that fit the style to the plan (+ mockups) — "go nuts" | **open** | |
| D22 | "**It's stuck loading**" on the iPhone (step 6, download frozen) → "deploy the error state", "**add an uncaught exception modal**", "need source maps?" | **done** | `c985098` src/ui/ErrorModal.ts (message, stack, build/URL/UA, RELOAD / COPY / DISMISS) + BOOT FAILED foot line; the modal caught it: `e[0].index` = `mergeGeometries([])` — the SW served a stale same-size `terrain.bin` bake (flat sea floor → nothing above water → empty palm merge) → `37c27ce` never migrate /assets/baked/**, esbuild keepNames + hidden source maps; `5b798c8` purge cached bakes on activate + network-first. Live b-mu6nepgr |
| D23 | "Aiming the sword doesn't make sense — top 3 melee ideas for the AIM button" → Claude: HEAVY (hold-charge overhead), KICK/SHOVE stagger, LOCK-ON; recommended HEAVY | **in flight** | combo-agent builds HEAVY on the AIM disc + the three-hit combo + boar hit-stun |
| D24 | Deploys 2–5: boat, beach, boulders, hut, palms, island minimap, hands, sword sounds (b-mu6m6qsv, b-mu6mg7yl); lookout + wreck + error modal (b-mu6mvkt2); shrine, jetties, bushes (b-mu6n8rri); SW purge (b-mu6nepgr) | **done** | `8c8e8b6` `b13ccf0` `c985098` `37c27ce` `5b798c8` — three restores after sibling sessions committed stale shared-index blobs (0181106, 2109f7e, 96f0272); parent now commits only via a private index |
| D25 | "**You can't just walk up a cliff** — the hoverboard can glide up, but cliffs/rocks/terrain must stop you running up arbitrary walls or inclines" | **in flight** | dive-agent (Player.ts): walkable-slope limit, slide on too-steep, hoverboard exempt, water skipped |
| D26 | **Three new enemy types** that fit the style (+ mockups) → Claude's picks: Reef Crab (tidepools, sidesteps), Coconut Monkey (palm troops, throws coconuts), Drowned Sailor (rises in the wreck at night, guards the iron sword); plus low-poly boar (done) and low-poly bear (loot-agent) | **in flight** | art/driftwood-enemy-{1-crab,2-monkey,3-wreckghost}.png; plan row C16 |
| D27 | Readable crash stacks on the phone → `b1ba49a` minifyIdentifiers off + real build id in the modal | **done** | live b-mu6nlj77 |
