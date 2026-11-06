# Pine Hollow round 33 · E350 F-X3 · Ranger Hale's forearm

A bug fix, not a pick. When Hale raised his right arm (his point), a grey sheet stretched from his sleeve and his lantern
down to his coat (E322's `round-21-e322-npc-rig/board.jpg`, row 1).

`board.jpg`: the real build, iPhone 16 Pro portrait, phone tier, midday. A is HEAD 9118e71 (before), B is the fix
(build 6d36adf0). Columns: standing from the front, standing from his right, the point, the point zoomed.
Captured with `scripts/e350-hale-capture.mjs`.

## Cause

The Hunyuan3D-2 hull fused each hanging forearm, and Hale's lantern under his right hand, to the coat beside it.
Rig B's weights are built at load (`src/pinehollow/quest/npcRig.ts` `rigLegs`). They put one corner of those triangles
on the forearm chain (twist · elbow · hand) and another on the body (hips · spine · chest · legs). The phone file has
135 such triangles, the desktop file 191. At rest they span 6–14 cm; the lantern's span 0.2–0.4 m. Hale's point
stretched them to 0.4–1.4 m.

## Fix: at load, for every file and every tier

`splitWebs` runs in `rigLegs`, so it fixes whatever GLB is loaded. That includes the KTX2 stand-ins, which are stale
(see below).

- **A thin web** (every edge under 0.2 m) is split at the seam into two copies:
  - one rides the arm: its other corners are duplicated with the weights of the nearest forearm vertex;
  - one stays on the coat: its other corners take the nearest body vertex's weights.
- **A long web** (the lantern's) keeps only its coat copy. An arm copy would hang off the lantern as a fin. Dropping it
  instead opened a notch in the coat's side.

In the hang, both copies sit exactly where the web was, so standing Hale draws what he drew before.

Measured by `scripts/e350-hale-web.mjs` on all three people × both tiers:

| | Before | After |
|---|---|---|
| Triangles stretched past 0.3 m and 2.5× in Hale's point | 92 (phone) / 137 (desktop) | 0 / 0 |
| Worst edge | 1.39 m | none |

Trader: 0. Miller: at most 1 sliver, on an elbow he never raises.

`test/pine-npc-rig.test.ts` checks this on every file: no triangle joins a forearm to the body, and Hale's point
stretches nothing.

What is left: in the point, the lantern web's coat copy shows as a dark flap of coat below his hand. It is small next
to the sheet, and it is what keeps standing Hale unchanged.

## KTX2

The GLBs were not re-exported, so there is no KTX2 re-bake. The KTX2 stand-ins under
`public/assets/gpu/pine-hollow/npcs/` (ranger / trader / miller, both tiers) date from 09-25 / 09-26, which is before
E304 / E343 replaced the GLBs on 09-30. They are still stale: a KTX2 page gets the old heads. The load-time split
applies to them too.
