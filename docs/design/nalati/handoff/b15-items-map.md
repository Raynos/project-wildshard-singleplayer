# B15 handoff — Nalati items, achievements + titles, skins, map (melee agent, 2026-09-23)

Stopped on the user's WRAP UP (token usage). Plan row: `docs/plans/NALATI.md` B15.

## Done

- **Items** (`src/game/Inventory.ts`): `wolf-pelt`, `wolf-fang`, `horsehair`, `stone-shard`, `grave-dust`, `marmot-fur`
  added to `ITEMS`. `harvestOf` now yields for `wolf` (pelt + fang; the alpha two fangs), `horse` (horsehair), `balbal`
  (stone shard), `ghost-rider` (grave dust), `marmot` (fur). The elite trophies (`leopard-pelt`, `grey-mother-pelt`,
  `eagle-feather`, `captain-standard`, `mane-braid`) and the Golden King's `gold-plaque` already existed (B12 / B13).
  main.ts's harvest path (`[E] Harvest …` → `harvestOf(kind, variant)`) picks these up with no wiring.
- **Achievements** (`src/game/achievements.ts`, NALATI table): WOLFBANE (5 wolves → "Pack Leader (Self-Appointed)"),
  THE BIG BAD (25 → "Not Afraid Of The Big Bad Anything"), ALPHA MALE SEMINAR (a pack alpha → "Sigma Grindset
  Survivor"), ROCK BOTTOM (5 balbals → "Licensed Stonemason"), NIGHT WATCH (10 ghost riders → "Ghost Rider (No
  Relation)"), on top of the existing Golden King + five elite rows. `progress.recordKill(kind, variant)` in main's
  onKill feeds them already.

## Left (nothing started)

1. **Achievements still missing:** tame any horse / TULPAR (needs a `record('tame', …)` call from `src/game/Taming.ts`,
   like elites.ts does for Argymaq); the Storm Titan (B14, kind/variant from its boss module); maybe "sneak-shot kill"
   (stealth: `nalati.stealth.state === 'hidden'` at the kill).
2. **Wearable elite skins.** The elites own them (`NalatiElites.skins`, ids `irbis-sabre`, `sky-wolf-bow`,
   `storm-wing-arrows`, `night-rider-mount`, `argymaq`; defs in `ELITE_DEFS[*].drop`), nothing wears them.
   Plan: a small `src/player/nalatiSkins.ts` (not Skins.ts — that one is crossbow/rifle material-name tables) that
   recolours the painterly viewmodels by vertex-colour tint / material uniform: sabre (`Sabre` rig — the steel extras
   material from `meleeGeo.steelMaterial` + the painterly one), bow (see `GoldenBow.recolour` for the pattern),
   arrows (Projectiles' instanced mesh colour), the mount (Mount.ts horse material). Then the menu Inventory tab
   (`src/ui/Menu.ts renderInventory`, `kit()` in main.ts) lists owned skins per weapon with a WEAR toggle, persisted
   like `SkinLocker`.
3. **Map / minimap for Nalati** (`src/ui/Minimap.ts`, `src/ui/Map.ts`): painterly ground colours (sample
   `terrainSurface` / the grass height for gold-green, the river from `src/nalati/wet.ts` / the chunk def's RIVER),
   and POI labels from map-01: NOMAD CAMP, KUNES RIVER, BRIDGE, SPRUCE FOREST, SKY GRASSLAND, KURGAN FIELD, BALBAL
   CIRCLE, HORSE PLAINS, SHEEP PASTURE, THE CRAGS, EAGLE ROCK (coordinates: `docs/design/nalati/geography-and-map.md`
   §3 and `src/world/nalati/layout.ts`). Elite skulls already exist.
4. **Cheap stealth extras (from B9):** wolves with `mem.hidden === 1` (Pack.ts: in grass ≥ 0.8 m, > 10 m away) off the
   minimap (Minimap.update's animal loop) and out of aim assist (AimAssist target filter); tracks (a wolf crossing a
   fresh trample gets +0.3 awareness — `trample.amountAt` in Pack's senses).
5. Screenshots of the menu tabs + map on the phone (none taken).
