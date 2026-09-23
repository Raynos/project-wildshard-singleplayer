# Handoff — creatures (B4), riding (B7), taming (B8)

Written 2026-09-23 by the creature / ride agent at wrap-up. The code is all on branch `nalati-grasslands`. Riding and
taming run fully in the dev harness `dev/nalati-ride.html`, but **they are not wired into the shard yet** (see "Glue
left to do" — about ten lines in `src/nalati/index.ts` and `src/main.ts`).

## Done

| piece | files | state |
|---|---|---|
| wolves + pack AI | `src/entities/species/wolf.ts`, `src/entities/Pack.ts` | in the shard (Wildlife). Pack roles are alpha / flankers / lunger / scout; phases are roam → shadow → encircle → lunge → howl regroup → break. A pack may hunt a foal |
| horses + herd AI | `src/entities/species/horse.ts`, `src/entities/Herd.ts` | in the shard. Lead mare, boids, flight / stampede, stallion guard states. Hooks: `trust`, `alert` / `alertOwned`, `onBeaten`, `leadAway`, `releaseStallion`, `setRidden` |
| sheep + sheepdog, marmots | `src/entities/Flock.ts`, `species/sheep.ts`, `species/sheepdog.ts`, `src/entities/Marmots.ts` | in the shard |
| placement + env | `src/entities/Wildlife.ts` (`NALATI_WILDLIFE`, two saddled camp horses at `HITCH_HORSE_SPOTS`), `src/entities/wildEnv.ts` | in the shard |
| painterly animal style | `AnimalFactory.ts` (`'painterly'`: one draw per animal), `src/entities/painterlyAnimals.ts`, `creatureKit.ts` (tufts, locks, wrapPatch), `loft.ts` `setShapeFn` | in the shard |
| riding | `src/player/Mount.ts` (+ the `Player.ride` hook in `Player.ts`) | harness only |
| taming | `src/game/Taming.ts` | harness only |
| riding / taming HUD | `src/ui/RideHUD.ts` + `src/ui/styles/ride.css` | harness only |
| wiring helper | `src/nalati/ride.ts` — `wireRide()` builds the Mount, the camp horses as mountables, RideHUD and Taming, plus ONE interactable (`ride.interactable`) that is always the nearest horse action | harness only |
| dev harnesses | `dev/nalati-creatures.html` (`&scene=lineup / pack / herd / flock / crowd / all`), `dev/nalati-ride.html` (`&mount=1`, `&camp=1`, `&herd=1`, `&break=1`, `&gallop=1`, `&touch=1&tier=phone`, `&nohmr=1`) | — |

The riding and taming rules and numbers are in the file headers of `Mount.ts` and `Taming.ts`. They follow the
design and NALATI.md's decisions:

- **Controls:** GALLOP is a hold (Shift or the disc). Keyboard W is a trot that becomes a canter after 0.9 s; touch
  sets the gait from the stick. While DRAW is latched the horse holds its heading, and the rider can look ±170° off
  it. The rider leans low automatically at full gallop, and the horse jumps low obstacles and ditches on its own at a
  canter or faster.
- **STEED:** −12 per second while galloping. When it runs out the horse is winded and can't gallop again until STEED
  is back to 25.
- **Water:** the horse fords the river and brook at a walk. In deep water it swims and the rider's eye stays above the
  surface. It can walk on the bridge deck.
- **Can't die:** at 20 % hp the horse throws you (10 damage), bolts to the hitching rail and rests for 3 minutes.
- **Whistle:** X, or the HORSE tab on touch. Only a bonded horse answers.
- **Taming:** TRUST and ALERT as in the design table. OFFER is G, or the disc on touch. The stallion gives a MOUNT
  prompt once TRUST is 100 within 3 m, or once he is beaten. Then 5 bucking rounds on the HOLD ON gauge, with
  LEAN L / LEAN R on A / D or the discs.
- **TULPAR:** the tamed horse, saddled. He is saved in localStorage (`ws.nalati.tulpar`) and waits at the camp's
  hitching rail on the next load.

## Glue left to do (the integrator's files)

1. **`src/nalati/index.ts`** — add a creatures / riding section:
   ```ts
   import { wireRide, type Ride } from './ride';
   let ride: Ride | null = null;
   // in attachAnimals(animals), after `wildlife = w`:
   ride = wireRide({ player, forest: ctx.forest, animals, wildlife: w, camera: game.camera }); nalati.ride = ride;
   // in bindPlay(p):
   ride?.bind({ kit: p.kit, toast: p.toast });   // hurt goes through animals.onCharge (main's damage path)
   // in the per-frame update that feeds Wildlife (and the B9 Stealth `isMounted`):
   extra.mounted = ride?.mounted ?? false;       // B9: "mounting stands you up"; packs get two tokens; a gallop stampedes the herd
   ride?.update(dt);
   // in onImpact (an arrow / javelin landed): ride?.noteShot(point.x, point.z);   (−30 TRUST near the stallion)
   ```
   Also add `ride: Ride | null` to the `Nalati` interface.
2. **`src/main.ts`:**
   - after `attachAnimals`: `interactables.push(nalati.ride.interactable)`. This one prompt is always the nearest horse
     action: "Mount Camp horse", "Mount Tulpar", "Dismount" or "Mount the stallion". The E key and the touch USE button
     then work through main's existing path.
   - `elites.bind({ …, taming: nalatiNow()?.ride?.taming ?? null, … })`. This is what hands Argymaq to taming once he
     is BROKEN.
   - holster the weapon while he bucks: `ride.taming.onBreaking = (on) => { weapons.visible = !on; weapons.setEnabled(!on); }`
3. **One-horse rule vs Argymaq.** Not done. Taming bonds whichever stallion you break and calls it Tulpar. When
   Argymaq is won, the elites code should call `mount.removeMountable(oldTulpar)` and hide the old horse, then
   `mount.addMountable(argymaq, 'Argymaq')` with `mem.whistle = 1`. `Taming.tulpar` is public for this.

## Open

- **Camp horses to the 9-angle targets** (`art/nalati-grasslands/round-4-camp-9angle/README.md` item 10). Partly done
  in `e0c54fd`: fuller mane and tail that lift in the wind, a bigger ornamented blanket with tassels and brass studs,
  rim 0.8, a sky-lit back. Still open:
  - The black camp horse still reads as a near-silhouette against grass. It wants a stronger coat sheen / rim; that
    may be a shader request to the look-director.
  - The mane locks are stiff ribbons: more bones or a vertex sway would help.
  - The blanket's ornament is only legible from about 3 m.
  - No reins in the rider's hands, and no first-person close-up head mesh; the real horse head is used.
- **Wind in `wildEnv.wind`.** The mane / tail sway uses its strength. This needs Wind set every frame, which
  `index.ts` already does.
- **Tests.** `pnpm test` has one failure: `test/progress.test.ts` — the achievement `argymaq` names a species
  `argymaq` that isn't registered (the elites agent's). The species-test rule was fixed in `0b9ccb8`.
- **Bow tuning from the saddle.** `Bow.setMount` (the bow agent's file) *assigns* `drawSpeedScale`. The Golden Bow's
  draw bonus is therefore lost while riding. The boss agent asked for it to be multiplicative.
- **Not built:**
  - sheep raids at dusk, the mounted shepherd
  - panic from wolf bites and lightning (STEED −15, rider thrown at panic 100)
  - riding with the stampede
  - a rename at the hitching rail
- **Measured cost on the phone tier:** the full creature set costs +24 draw calls and +318k triangles, at 60 fps.
