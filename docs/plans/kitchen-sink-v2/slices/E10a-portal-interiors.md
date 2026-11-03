# E10a: portal interiors (a walk-in portal into an interior region inside the cube)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the portal half of the old
**W15** ("a generic `world/interior`"; the cave half was W9a), **M6.4**'s Nalati arena room and Nine portal parts,
**H110**'s room lifecycle (the fight half is E12c) and what round 5 asks of the platform ("the walk-in portal ride into
an interior region of the same shard … its own sky and light; the surface's near tiles stay resident; the two
interiors never load together"). The cube rule itself is W0e.

## 1. The showcase piece

The **Training Vault portal** in band 4 (round 5: the interior at x 151…221, z −99…−29, y −40…−30): a walk-in arch
with a plate ("4 ROOMS · BOSS · ~10 MIN", best time from W3a's records), locked until the Keycard (E5b). Walking in fades
to the Vault's **entry hall** (one room for now; E10b–E10d add the rest), with its own light and room tone; an exit
portal fades you back to the arch. The Titan arena (E12g) reuses this host.

## 2. Engine / game / host work, just in time

Research:

- **Two portal hosts, neither general.** (1) `src/game/shardfile/walkInPortalRide.ts` (160 lines): a renderer-free
  walk-in ring state machine over declared links (`src/format/portalLink.ts`, `portalLinkAssets`), returning hold /
  transfer commands; it imports `DirectorStageLane` from the plugin director (`:6`). User: Nine (`nine.portal-ride`
  director, `out/nine-dragon-stack/sections/quests/directors.json`). It moves you between places; it has no interior.
  (2) Nalati's arena room: `src/game/boss/arenaRoom.ts` (1,641 lines) with `ArenaPortalLaw` (`arenaPortal.ts`, 63):
  "client-only entry/exit lifecycle … the host owns fades, isolation, movement and the single ordered boss/room update"
  (`arenaRoom.ts:92-94`), baked private scenes, its own spare light (`:581-586`, G808's LightPool rule). It is an
  interior, but welded to one boss fight.
- Cube bounds: `CELL_BELOW = 250` (`src/engine/core/config.ts:18`); W0e validates declared volumes, portal destinations
  and overlaps.

Work:

| Row / host | Shape | Layer |
|---|---|---|
| `world/interiors` section | `[{ id, volume: box, scene: <baked scene ids>, light: { sky, ambient, fog }, ambience?, entries: [{ portal, at, yaw }], exits: [{ portal, to: <surface portal> }], resident: 'surface-near' }]` | format (new section; volumes feed W0e's rule) |
| interior host | entry fade (`RideFade`), load the interior's scene behind it, isolate (the surface's far tiles may stream out, the near tiles stay), swap light and ambience, exit fade; one interior loaded at a time | game `src/game/world/interiors.ts` (new), lifted from `arenaRoom.ts`'s lifecycle (fades, isolation, light pool) |
| portal | `walkInPortalRide` drives entry and exit rings; `requires` gates the ring (the keycard flag) | game (the ride stays renderer-free) |
| arena room | Nalati's arena room keeps its fight but uses the interior host for enter / leave | game `boss/arenaRoom.ts` |

Host bar: interiors get Nalati (arena room) and the showcase (Vault, Titan arena); the portal ride gets Nine and the
showcase. Guards: the cube rule (W0e), `layer`, `shard-game-plugins` (the ride's plugin import goes in E11a). Tests:
`test/arena-portal.test.ts`, `test/declared-portal-entry.test.ts`; new `interior-host.test.ts` (one interior at a time,
light swapped back on exit, the keycard gate).

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Nalati | the Storm Titan's arena room enters and leaves through its own lifecycle | the lifecycle moves to the interior host; the fight is untouched | arena goldens on entry, inside and exit (Opus); `test/arena-portal.test.ts`; enter and leave in game | low: entry state is per session; a save inside the arena restores at the entrance as today |
| Nine Dragon | `nine.portal-ride` walk-in ring | none (the ride gains a second user, no change) | `test/declared-portal-entry.test.ts`; ride the portal in game | none |

## 4. Done when, hours, blockers

**Done when:** with the keycard, walking into the arch fades into the Vault's entry hall with its own light and sound;
the exit returns you to the arch; memory with the interior loaded is read on a Simulator sample (numbers in the
commit); Nalati's arena looks and plays the same.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 16 h (Codex host; Opus 4 h for light and fades) | 10 h | 4 h (the arch, the entry hall) | **30 h** |

**Blockers:** W0e (the cube rule), E5b (the keycard), W9a (the cave host's volume rows, for one shape of volume).

## 5. Risks

- `arenaRoom.ts` is the second-biggest boss file (H110); lifting only its lifecycle without touching the fight is the
  point. Two commits: the interior host with Nalati's room on it (goldens green), then the Vault.

## 6. Questions for Jake

1. **What stays loaded while you're inside.** (a) the surface's near tiles stay resident so the exit is instant (round
   5's proposal); (b) the surface unloads fully and the exit reloads it. **Recommended (a):** a 1–2 s exit fade with no
   reload; the Simulator reading decides if (b) is needed for memory.
