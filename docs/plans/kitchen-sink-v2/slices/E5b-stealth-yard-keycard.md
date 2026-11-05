# E5b: the stealth yard and the Keycard (stealth beyond tall grass: lamp cones and cover)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the stealth part of **W10**
(grapple, stealth approvals: "showcase as second user"), the lamp cones of the enemies plan (Riveter patrols), and the
tier-2 set-piece quest **Keycard** (L10: steal the keycard unseen; opens the Training Vault).

## 1. The showcase piece

The **stealth yard** doubles as band 5 (19u): container rows, shadow pools, four Riveter **patrols** with lamp-plate
cones on loops. Crouch in shadow or behind cover to stay hidden; a cone that holds you for its notice time raises the
alarm (the pack engages, the yard's gate shuts for 20 s). The **Keycard** sits on a desk in the foreman's hut; taking it
unseen completes the step; being seen while carrying it resets it to the desk. The keycard opens the Vault portal
(E10a). Storm hour (E9) darkens the yard.

## 2. Engine / game / host work, just in time

Research:

- **Stealth is a game host with one user and an approval**: `src/game/shared/stealth/stealthLaw.ts` + `controller.ts` (235
  lines), approved as `stealth-and-detection` (G478, `lint/platform-pending-users.json:2247-2255`). Nalati ships its
  rows as `player/stealth.json` (the crouch disc, "Tall grass" hint, detected / hidden icons).
- **Its sources are Nalati-shaped**: `StealthObservation { grass, mounted, forced, threats }` and owners `population
  (packs, herds)`, `riding (mounted, taming trust)`, `grass.grassStandingAt(x, z)` (`stealthLaw.ts:10-20`). No lamp,
  no shadow, no cover, no item-carried rule.
- Creature senses exist: sight cone and range per species (`sightRange`, `sightCone`, `noticeRate`, `forgetRate`,
  `alertAt` in `src/format/speciesPrograms.ts:95` tuning; the doc in `AnimalManager.ts:66`).

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| concealment sources | `stealth.cover: [{ kind: 'grass' \| 'shadow' \| 'volume', … }]`: Nalati's grass is one kind; `shadow` boxes and `volume` cover boxes are rows; the law reads "how hidden am I" from whichever applies | format `stealth.ts`, game `stealthLaw.ts` (no "grass" in the law: the grass reader becomes one provider) |
| watcher sources | threats from any species with `sight` rows (already), plus a patrol's **lamp cone** (`sight: { cone, range, lamp: true }`): drawn as an additive cone, no real light | game + data |
| alarm | a stealth `alarm` row: `{ on: 'seen', set: flag, seconds }` the director or quest reads (the gate shuts) | format + game |
| carried item | the keycard is a carried quest item (Nalati's `carried` rows exist, `src/game/client/quest/carriedProp.ts`); `onSeen: 'return'` sends it home | format quests + game |

Host bar: stealth gets its second real user, test 2 fixed (no grass/riding nouns in the law). Guards: `engine-words`,
`shard-names`. Tests: Nalati's stealth tests (grep `test/*stealth*`), new `stealth-cover-sources.test.ts` (shadow and
volume cover, lamp cone notice, alarm flag).

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Nalati | grass + mounted + taming stealth vs wildlife packs | its grass and riding readers become providers; rows unchanged | the stealth observation log identical for a scripted crouch-walk through tall grass past a wolf pack; HUD icons DOM snapshot | none (stealth state is per session) |

## 4. Done when, hours, blockers

**Done when:** you can cross the yard unseen in shadow, a lamp cone that holds you raises the alarm, the keycard
returns if you're seen carrying it, the Keycard quest opens the Vault portal; Nalati's grass stealth reads identically.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Codex law; Opus 4 h for lamp cones and shadow reads) | 8 h | 12 h (the yard: containers, hut, shadow pools, patrol routes) | **34 h** |

**Blockers:** E5a (Riveters), W1b (quest steps), E1g.

## 5. Risks

- Stealth on a phone in daylight: shadow pools must read without a dynamic shadow map (baked dark decals, a "hidden"
  HUD icon from Nalati's set).

## 6. Questions for Jake

1. **What being seen costs.** (a) the pack engages and the yard's gate shuts for 20 s, the keycard returns to the desk;
   (b) seen = the quest fails and restarts from the gate. **Recommended (a):** a fight you can win or flee, no hard
   reset; the keycard returning is the stealth penalty.
