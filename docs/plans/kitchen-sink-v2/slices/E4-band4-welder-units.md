# E4: band 4: Welder Units (energy damage, the flame cone, slag hazards, a weak spot)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs band 4 of **EB1 / EB3 / EB4**,
**LS2 / LS4** for L10–12, the band-4 economy rows (Scrip 9, the Nozzle, the contract, chests) and the world-hazard half
of **W11**'s `arenaFire` hazards (slag puddles outside a boss arena). The Training Vault's portal sits in this band
(E10a). Quest: none new (tier 2's Keycard is E5b, Training Vault E10d).

## 1. The showcase piece

Band 4: **5 packs × 2 Welders + 1 Mite, L10–12, ~15 live**. The Welder: a stocky biped with a torch arm and a back
tank, 2.0 m, 2,200 / 1,600 / 500 tris. Torch blue → orange 0.8 s with a cone decal → a 6 m **flame cone** (energy:
your MDEF resists it, burn on you, E0g); it leaves **slag puddles** that burn for 6 s; the **back tank** takes ×1.5.
Welders feed the pitch bolts at the BENCH (3 Nozzles → 10 pitch bolts, W2b).

## 2. Engine / game / host work, just in time

Research:

- Strike shapes include `wedge` (`{ length, halfAngle }`, `src/format/creatures.ts:160`): the flame cone is a wedge.
  No strike declares a damage type; E0b adds `damageType` on the request and E0a's kinds carry MDEF.
- **Hazards exist only inside Nalati's arena**: `src/game/boss/arenaFire.ts` (100 lines, "client-only instanced arena
  flames, smoke and whirlwinds. No fight decisions or hazard ownership") over `ArenaFireRows` in
  `src/format/encounterRows.ts`; the fire's damage is the boss's `burnSeconds` / `fireDps`
  (`src/format/bossProfiles.ts:292`).
- Weak spots: only the headshot (`DamageRequest.headshot`, `Actor.isHeadshot`, `TargetAnimal.damageFor(headshot)`,
  `pipeline.ts`, `combat/types.ts`). E2 adds a rear hit zone; E4 generalises it.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| energy strikes | strike `damageType: 'energy'` → the request's type; the stat stage uses MDEF | format + game (E0b's stage) |
| world hazards | `combat/hazards: [{ id, shape: circle, seconds, onTouch: { effect: 'effect.burn' }, look }]`, spawned by a strike's `leaves: { hazard, at: 'impact' }`; capped per area | format (new rows) + game host over the engine effect service; the look reuses `arenaFire`'s instanced flames (moved out of `game/boss/`) |
| hit zones | species `zones: [{ id, part, mul, facing?: 'rear' }]`, read by the levels stage (and today's `headshot` as the built-in head zone) | format `creatures.ts` + game |

Host bar: hazards get two users (the showcase's slag, Nalati's arena fire once E12c re-homes it; until then a G595
pending row). Guards: `engine-words`. Tests: new `world-hazards.test.ts` (6 s burn, refresh not stack, at most N per
area), `hit-zones.test.ts`; Nalati's arena tests untouched here.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Nalati | `arenaFire.ts` draws the Storm Titan's phase-3 fire | the drawing code moves to a shared hazard view; the fight still owns its fire until E12c | Nalati arena goldens (phase 3, Opus) pixel-identical; `test/` arena tests | none |
| every shard | `headshot` | read as the built-in head zone; byte-identical | parity test | none |

## 4. Done when, hours, blockers

**Done when:** Welders cone, burn you through MDEF, leave 6 s slag; the back tank takes ×1.5; the BENCH turns Nozzles
into pitch bolts that burn Riveters (E5a); Nalati's phase-3 fire looks the same.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex rows; Opus 4 h for the hazard look) | 4 h | 18 h (Opus: the Welder 10 h, band 6 h, rows 2 h) | **36 h** |

**Blockers:** E1c, E0g (burn on actors), E0b (damage types).

## 5. Risks

- Slag puddles as transparent instanced flames over a band of 15 robots: one instanced mesh per hazard kind, capped at
  12 live, measured with the frame floor in E17.

## 6. Questions for Jake

1. **Slag lights the night.** (a) slag glows (an emissive decal, no real light) so band 4 reads at night; (b) dark
   decals only. **Recommended (a):** it is how Hot Mess (E8c) "lights the dark", and an emissive decal costs no light.
