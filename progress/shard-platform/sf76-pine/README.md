# Pine move-back (G303, G306, G307)

Raw shader rows moved from `data/` to `runtime/looks/`, with the same
GLSL and values. Runtime type imports use the game defining modules.

Capture pin: `6d0ddab468024667271c7088443f07ee66e07724`.
- Clean build and standalone boot passed.
- Two independent physics captures matched; every gameplay field equals
  the previous bake (164 actors, 918 trees, 2,078 solid colliders).
- Map image is byte-identical, SHA-256 `e7cc19e10f905c377c9b0a61e64aec5d95dff3eff504198b877b3f058b3dea09`.
- Focused shader, shelter, physics, King-table and map checks: 24 passed.
- Root strict TypeScript and touched type-aware lint passed.

Forest edit rows also moved unchanged to `runtime/looks/forestLook.ts`.
Capture pin: `f63d57011c9cfbd01da3af6db24be0e822a0dfd7`.
Two actual page physics captures match the prior gameplay payload exactly;
the map image retains the same hash above. Root strict, touched lint and
three tree/undergrowth checks pass.

Weapon/viewmodel copies remain verbatim. The SF76 exact-source transfer
guard now supports their 92 existing runtime-performance occurrences.
The item classes additionally expose SF2 inheritance counts (8 -> 11,
Weapon 1 -> 4), which require the corresponding move-only provenance rule.

The glove-hands and stave-bow implementations now live verbatim in
`runtime/viewmodel/`; their SDK facades are deleted. Two dependent rows
move with their trusted runtime types. Pin `2841ba47cd1c3c9d2d2afc8188e1ec4529ce5396`:
actual physics payload and map image remain exact. Seventeen focused
weapon/cache/loadout checks, root strict and touched lint pass; 46 existing
performance-debt occurrences transfer through immutable source hashes.

Five Pine-only kit implementations return verbatim to `runtime/kit/`;
the five SDK facades are deleted. Pin `00cf64f3aaf131943711ecddcab22921a7dd1b66`
keeps the actual physics gameplay payload and map pixels byte-identical.
Ten crag checks, root strict and touched lint pass. Thirty-one existing
performance sites transfer by source hash; one existing sandbox site
(`heldTool.ts`) is listed in the coordinator approval rows.

Eleven Pine-only look implementations and the LOD-glTF helper return
verbatim to `runtime/looks/` and `runtime/kit/`; eleven SDK facades are
deleted. Dependent trusted rows move with their defining types. Capture
pin `aa791f664eefe46463f79d4c1db3e7176daf2bb4`: physics gameplay payload
and map pixels are exact. The map stamp additionally includes HEAD’s
documentation-only coat-table update. Twenty-six focused checks, root
strict and touched lint pass; 166 existing performance sites transfer by
source hash. Newly exposed import debt is in the coordinator approval file.

Pine’s trophy-wall view and NPC dialogue continuation now live verbatim
in `runtime/compendium/` and `runtime/quest/`. The trophy SDK facade is
deleted. Five dialogue/continuation checks, root strict and touched lint
pass; 29 existing performance sites transfer by source hash. This group
changes no collider, clip, placement or map input.
