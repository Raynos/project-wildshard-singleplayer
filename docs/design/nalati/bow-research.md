# The Nalati bow: research and the chosen flow (N18, NALATI-MERGE H4)

The user's ask (N18, 2026-09-24): *"I don't think you should be able to quick fire a bow like you can quick fire a
crossbow or a gun. The bow should always be drawn … tap and hold to draw. If you don't hold it long enough until the draw
completes, then it cancels. If you let go, it shoots the arrow. Aim shouldn't be draw. Aim should be about looking down
the sight — the zoom effect … aiming just changes the perspective of that draw. Research Skyrim bow combat."*

The user's pick for touch (wave 3): hold the big FIRE disc to draw (the ring fills), release to loose; release before full
= the arrow is let down, no shot. AIM is a toggle disc: tap to zoom down the arrow, tap again to come out. Drag anywhere to
aim while drawing. Desktop: LMB hold / release, RMB toggles AIM. Mounted archery keeps working.

## 1. Skyrim's bow flow (vanilla TES V / SE)

Numbers first. The sources are UESP unless marked otherwise.

| Stage (60 fps frames) | Time | Notes |
|---|---|---|
| Nock | 48 f = 0.80 s | Bow Speed has no effect; Quick Shot → 25 f (0.42 s) |
| Minimal draw | 12 f = 0.20 s | |
| Full draw | 40 f = 0.67 s | ÷ the bow's Speed (Long 1.0 … Daedric 0.5) |
| Idle at full | unlimited | no stamina, no sway, no time limit in vanilla |
| Release | 38 f = 0.63 s | |
| Back to rest | 22 f = 0.37 s | |

- **Input.** Hold attack to nock and draw, release to fire. A whole shot cycle is `1.433 + 0.867 / Speed` s: about 2.3 s
  with a longbow and 3.2 s with a Daedric bow. Quick Shot ("30 % faster") makes it `1.05 + 0.667 / Speed`.
  [Archery](https://en.uesp.net/wiki/Skyrim:Archery), [Bows](https://en.uesp.net/wiki/Skyrim:Bows)
- **Early release fires a weak arrow; it never cancels.**
  - Before the minimal draw: 35 % damage.
  - During the full-draw stage: 50 → 100 % damage, linear.
  - The part-drawn arrow also flies shorter.
  - To cancel a drawn arrow you press *Sheathe*. Block does nothing without the perk below.
  - [Archery](https://en.uesp.net/wiki/Skyrim:Archery)
- **Aim / zoom is a perk, not the draw.**
  - *Eagle Eye*: press Block while drawn to zoom. It drains 10 stamina/s, so the zoom can't be held forever. UESP gives no
    FOV for it. [Eagle Eye](https://en.uesp.net/wiki/Skyrim:Eagle_Eye)
  - *Steady Hand*: time slows while zoomed. The perk text says 25 / 50 %; the game really does 50 / 75 %.
    [Steady Hand](https://en.uesp.net/wiki/Skyrim:Steady_Hand)
  - A plain draw has no zoom. The crosshair shows in both 1st and 3rd person.
- **Flight.** The Ancient Nord arrow flies at 3600 units/s (about 51 m/s) with gravity 0.35. Every arrow launches with a
  2° loft (`f1PArrowTiltUpAngle`). [Arrows](https://en.uesp.net/wiki/Skyrim:Arrows)
- **Holding costs nothing in vanilla.** The popular overhaul mods add a tremble that grows as stamina drains, a stamina
  drain, and a forced let-down at 0 stamina. That they exist at all says players felt the hold was too free.
  [AGO](https://www.nexusmods.com/skyrimspecialedition/mods/24296),
  [Immersive Archery](https://www.nexusmods.com/skyrim/mods/46073),
  [Stamina of Shooting](https://www.nexusmods.com/skyrimspecialedition/mods/105814)
- **Mounted archery (1.6 / SE).** Draw and release work as on foot. Vertical aim is limited and arrows drift off the
  crosshair, and mods exist to fix both. [Horses](https://en.uesp.net/wiki/Skyrim:Horses)

**Why Skyrim feels good.** Every shot is a committed draw: nock, pull, the idle at the anchor, the release. Zoom is a
separate, deliberate act layered on a draw that is already happening, and it is never what starts the draw. That is
exactly the user's "aim just changes the perspective of that draw".

## 2. The other references (one line each)

- **Kingdom Come: Deliverance.** Drawing costs stamina, and the longer you hold, the more the aim sways. Right-click lets
  the arrow down. [KCD wiki](https://kingdomcomedeliverance.wiki.gg/wiki/Bow)
- **Red Dead Redemption 2.** Hold until the bow is fully drawn, then release. A long hold drains stamina and the aim
  wobbles; the base hold is about 22 s. [Red Dead wiki](https://reddead.fandom.com/wiki/Bow)
- **Tomb Raider (2013).** Hold Aim, then hold Fire to draw. Hold too long and the arm tires, the aim shakes and Lara is
  forced to fire. Releasing Aim lets the arrow down. [TR controls](https://tombraiders.net/stella/walks/controls/TR9controls.html)
- **Horizon Zero Dawn.** Hold to draw and release to fire. Concentration slows time for about 6 s.
  [Concentration](https://horizon.fandom.com/wiki/Concentration)

## 3. The Wildshard design (built, H4)

The user asked for something Skyrim does not do: a release before full draw **lets the arrow down, no shot**. That is the
KCD / Tomb Raider cancel, applied to the release itself. The rest follows Skyrim's shape: hold to draw, the arrow held at
the anchor, AIM as a separate zoom layered on the draw, plus the tremble on a long hold that the Skyrim mods and KCD /
RDR2 add.

| | Wildshard (Nalati bow) | Skyrim for comparison |
|---|---|---|
| Draw | Hold FIRE (touch) / LMB. 0.75 s to full on foot, 0.9 s in the saddle (1.1 s for a rear / Parthian shot), 0.625 s with the Golden Bow. Ease-out: fast at first, heavy toward the anchor. The FIRE disc's ring fills and glows at full | 0.2 + 0.67 s, plus a 0.8 s nock |
| Release at full | The loose. It is the only way an arrow leaves: full power (30 + 28 m/s, gravity 5), 0.3° cone | full-damage shot |
| Release early | **Let-down**: no arrow and nothing spent. The string eases forward over 0.4 s, the ring unwinds and the disc gives a small dim shake | weak shot (35–100 %) |
| Quick-fire | none. A tap is a let-down. The old snap shot (F / a LOOK tap) is gone | none |
| After a loose | 0.62 s re-nock: the hand follows through, drops to the quiver and comes back up. A finger pressed again starts the next draw once 40 % of the re-nock is left | 0.8 s nock |
| Held at full | Steady for 3 s, then a tremble that grows to ± 1.5° by 8 s. At 8 s the arms give out: the arrow is let down, 1.1 s rest, and you lift and press again | unlimited, no sway |
| AIM | A **toggle** (the AIM disc / RMB) that zooms down the arrow: 2× (FOV 72° → 40° landscape, 94° → 56° portrait Hor+). The bow comes in toward the centre line with the fist below the crosshair, and the arrow rises to cross it about 7–8 m out. The crosshair stays up. The viewmodel keeps its size on screen (only the world magnifies). Look speed ÷ 2, tremble × 0.5, cone × 0.5. It never draws | Eagle Eye: Block while drawn, drains stamina |
| Cancel a held draw | Sprinting on foot, swimming, or a weapon swap lets it down (lift and press again). On desktop, losing the pointer lock mid-draw lets it down | Sheathe |
| Mounted | The same flow while galloping. The horse's gallop no longer blocks the draw (it set `sprinting`). The free look holds while drawing or aimed. Horse speed is added to the arrow | same as on foot |
| Hunter's eye | The dotted arc now always shows the full-draw path (the only path an arrow can fly) and fades in with the draw | none |

Why not stamina? Nalati's STEED stamina belongs to the horse and there is no player stamina bar. The tremble and the tired
let-down give the same "don't hold forever" pressure without a new meter.

Sounds: the loose's twang (`audio.bowTwang`) is wired; the draw creak, the full-draw click and the let-down have hooks
(`onDrawStart`, `onFullDraw`, `onLetDown`) but no sounds yet. New sounds go through the two-model SFX pipeline (MOSS v2 +
Stable Audio 3 Medium, the better take ships), which is its own task.

Code: `src/player/bowDraw.ts` (the state machine, unit-tested in `test/bow-draw.test.ts`), `src/player/Bow.ts` (input,
the AIM zoom and pose, the loose), `src/player/TouchControls.ts` + `src/ui/styles/touch.css` (FIRE = hold to draw with
the ring, "HOLD = DRAW"; AIM stays AIM, a toggle). Evidence: `progress/nalati-merge/h4/sheet.jpg`
(`scripts/nalati-bow-capture.mjs`).
