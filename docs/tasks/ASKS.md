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
| 24 | **No world / no sounds / no fps meter on the main menu**; hero images only | **in flight** | prototype 1 owns main.ts (world paused + muted while the intro is up); Pine Hollow heroes: this session (#31) |
| 25 | **CSS sculpted per page** — unique class names per screen, fix it permanently | **done** | `087a862` `f80893d`: `hud.css` → `src/ui/styles/{base,game,menu,pause,touch,update}.css`, one prefix per screen, `scripts/check-css.mjs` on prebuild (fails on collisions; loading/perf warn-only until prototype 1 renames `ws-tagline`/`ws-fps`); also fixed the compass letters picking up the deck's `.ws-card` |
| 26 | **Tap the look pad to fire**, remove the FIRE button | **done** | `df60e4c` (tap < 12 px / < 300 ms in the LOOK pad fires) |
| 27 | **Aim is a toggle**, not a hold | **done** | `df60e4c` (AIM latches, cyan while on) |
| 28 | **Aim = iron sights**, not a zoom: no crosshair, crossbow centred; **3 codex mockups** → user picked **A** | **done** | `859379d` (bolt tip on the aim line, FOV 72 both ways, crosshair fades; portrait limbs 72 %) — `art/ads-A-centred-low.png`, `ads-B-eye-level.png`, `ads-C-peep-sight.png` sent (B's HUD was redrawn by codex — judge the pose only) |
| 29 | Exit to main menu **bumps to the loading screen** — should go to the chunk selector | **in flight** | = #33 flow |
| 30 | **Loading screen gone** (blank, build `b-mu6ezhob`) | **done** | prototype 1: `.ws-load` root rules restored in loading.css; live `b-mu6f75ka` |
| 31 | **Codex hero image for Pine Hollow** so the menu never shows the live world at 29 fps | **done** | `815d8e6` `art/hero-pine-hollow-{portrait,landscape}.png` → `src/chunks/thumbs/`, `heroPortrait/heroLandscape` on the ChunkDef; the menu shows it once #33 lands |
| 32 | **Show me the three (iron-sights) mockups** / **what's the current progress** | **done** | sent 22:46 |
| 33 | **The flow**: startup/reload → loading (always) → main menu = chunk selection → Enter → Pause → Exit → chunk selection **without** reload or loading screen | **in flight** | prototype 1: world pause/mute + `hud.onExitToMenu`; this session: HUD re-shows the intro, never reloads |
| 34 | Port trials-gauntlet's **asks process** so chat asks persist durably | **done** | this file; `AGENTS.md` bullet; `.claude/hooks/session-brief.sh` + `.claude/settings.json` SessionStart |
| 35 | "Current build is pretty badly damaged, I'll wait for a deploy" | **done** | `b-mu6f75ka` (loading fix + perf) then `b-mu6fmkqb` (CSS split, tap-to-fire, AIM toggle, 2× speed, Pine Hollow heroes on the def) |
| 36 | **Iron sights rebuilt to match mockup A** — 859379d rejected ("does nothing about aiming down the iron sights"): camera must look down the bolt axis, tip just below centre, string at the bottom, limbs mid-height | **in flight** | this session: ADS pose solved at runtime from the bolt/nut geometry + FOV per aspect (`src/player/Crossbow.ts`) |

| K2 | One HOLO SURVEY HUD edit of base-phone; save art/hud-K2-holosurvey.png | **done** | art/hud-K2-holosurvey.png; built-in imagegen single generation |

| K3 | One built-in image edit: Cartographer HUD on base-phone; save art/hud-K3-cartographer.png | **done** | art/hud-K3-cartographer.png; single built-in imagegen edit |

| K1 | One Staging Glass HUD edit of base-phone; save art/hud-K1-stagingglass.png | **done** | art/hud-K1-stagingglass.png; one built-in imagegen edit |

| N2 | One built-in image edit: CONSOLE BAR on base-phone; save art/hud-N2-consolebar.png | **done** | art/hud-N2-consolebar.png; single built-in imagegen edit |

| N3 | One built-in HOLO BAR edit of base-phone; save art/hud-N3-holobar.png | **done** | art/hud-N3-holobar.png; one built-in imagegen edit |

| N1 | One built-in image edit: GRIP BAR HUD on base-phone; save art/hud-N1-gripbar.png | **done** | art/hud-N2-consolebar.png; single built-in imagegen edit |

| P1 | One built-in EDGES HUD edit of base-phone; save art/hud-P1-baredges.png | **in flight** | Codex; single generation |

| P2 | One built-in TOP CORNERS HUD edit; save art/hud-P2-barcorners.png | **in flight** | Codex; single generation |
