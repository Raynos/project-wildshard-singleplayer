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

| L1 | Load **5× faster on the iPhone**; the shaders step sat at "140 / 142" for 10–53 s | **in flight** (load-speed agent) | `5651fde` perflog · `d584095` precompile everything before the first frame (scene + shadow-depth + sky box + post chain, issued at once, parallel link with a live count; r186 PCFSoft→PCF recompile found and settled) · `3996b33` LINK_STATUS resolve phase. Desktop tier=phone: shaders 3.5 s → 0.11 s, first frame 1.86 s → 0.25 s, 0 programs compiled after the step. Phone reading pending. |
| L2 | Loading bar is **not continuous — arbitrary chunks** | **done** | `da7c9c3` — steps weighted by the previous run's wall ms (localStorage per tier/cores), running step = max(sub-progress, elapsed/expected) < 1, republished every frame; 100 only at done(). Desktop trace: 232 paints / 1.2 s, 0 regressions, longest gap 214 ms. |
| L3 | **Pre-bake at deploy time** (terrain, placements, sky) so the phone does no maths at launch | **done** (terrain) / open (placements, sky, cards) | `937c76d` scripts/bake-chunk.mjs → public/assets/baked/pine-hollow/terrain.bin, Heightfield lookups: desktop terrain 249 → 86 ms, grass 210 → 75. `5c6b8ef` textures uploaded in the shaders step (first frame 733–1468 → ~110 ms). `5681ad4` splat arrays copied on the GPU, no getImageData. Phone reading pending. |
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
| 49 | (parent's item) `setAimTargets(animals.animals)` is **not wired in main.ts** — aim assist is inert in production until it is | **open** | prototype 1 (main.ts): one import + one line after `animals` exists |

