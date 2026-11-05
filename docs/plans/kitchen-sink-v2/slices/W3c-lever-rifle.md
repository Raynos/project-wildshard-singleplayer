# W3c: the lever rifle out of the plugin, the rifle lane

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the firearm part of the old
**W6** (`heldFirearm` out of the plugin), the `heldFirearm.ts` slice of SHARD-PLATFORM-NEXT **N2/N5** (owned there,
run here) and **M3.1**'s rifle half.

## 1. The showcase piece

- The **rifle lane**: steel plates at 25, 50 and 75 m that ring and swing on a hit; drill "Rifle" (10 rounds, hits and
  time) with a PB on the range board.
- The showcase's **lever rifle** as a firearm row (data): model parts, lever cycle, sights, brass, sounds.

## 2. Engine / game / host work, just in time

Research:

- `src/game/client/plugin/heldFirearm.ts` (391 lines) is the held-firearm host (H3): rows for parts, materials, pose,
  playback, hands, brass and tracers. Its own doc lists **owner paths the rows read on `weapon`** ("a data contract:
  move the JSON paths with any rename": `time`, `player`, `feel`, … `anchors.<id>`), i.e. reflection (test 6 fail). It
  lives in `game/plugin/`, the migration scaffolding N5 deletes (HOST-BAR "The plugin system is migration scaffolding").
- Importers: `src/game/server/combat/roamingSession.ts`, `src/game/client/weapons/heldLauncher.ts`, `src/game/client/loadout/rangedPage.ts`,
  `claims.ts`, `held.ts`. It is not in `lint/platform-pending-users.json` (0 rows).
- The lever rows are literally Pine's: `src/format/heldEquipment.ts` "The lever-action's rows on the held-firearm host
  (data/leverDetails.json)". `Owned.ts:24` even lists `lever-rifle` as a Pine owned id (moved to rows in W2a).
- Engine side is fine: `src/engine/shared/combat/Firearm.ts` (`RangedAction.Cycle` for a lever), `view/hitscan`, `view/brass`.

Work: move the host to `src/game/weapons/heldFirearm.ts` (a game host), replace the owner-path reads with named
channels the host itself owns (the same values, now addressed by channel id), keep the rows byte-compatible where
possible, add a `swing` reaction row for steel plates (`world/targets` effect `{ kind: 'swing' }`). Layer: game (a
Wildshard weapon), engine untouched. Guards: the plugin-layer lint (`shard-game-plugins` ratchet), `host-callbacks`,
`engine-words` (rifle). Tests: `test/held-firearm-rows.test.ts`, `test/mounted-firearm-admission.test.ts`,
`test/held-claims-entry.test.ts`, `test/golden-held-residency.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Parity proof | Save risk |
|---|---|---|---|---|
| Pine Hollow | lever-action via `held.ranged-page`, `leverDetails.json` | rows renamed to channels; host import path changes | held-pose goldens with the rifle up (Opus); lever cycle and brass timing equal in `test/held-firearm-rows.test.ts`; fire a full tube in game | low (rounds in the loadout save) |
| Nalati (roaming / mounted firearm) | `roamingSession.ts`, `mounted-firearm-admission` | import path, channel names | `test/mounted-firearm-admission.test.ts` | low |

## 4. Done when, hours, blockers

**Done when:** `game/client/plugin/heldFirearm.ts` is deleted; the showcase rifle cycles, aims and hits the three plates; the
rifle drill writes a PB; Pine's rifle looks and times identically (goldens + tests).

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 16 h (Codex move; Opus goldens) | 10 h | 4 h | **30 h** |

**Blockers:** W3a. Independent of W3b (can run beside it in another lane).

## 5. Risks

- The owner-path contract is undocumented beyond that comment; every path the JSON names must map to a channel or a
  pose breaks silently. A test that lists every path in Pine's rows and asserts a channel exists for each lands first.

## 6. Questions for Jake

1. **Rifle lane targets.** (a) swinging steel plates with a ring sound; (b) paper targets with scored rings like the bow
   lanes. **Recommended (a):** a rifle at 75 m reads best as a clang and a swing; rings at that range are unreadable on a
   phone.
