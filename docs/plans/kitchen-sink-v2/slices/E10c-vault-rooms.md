# E10c: the Training Vault's rooms 1–3 (puzzle, fight, climb)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the room half of **K5** (the
Training Vault built on DG1–DG4) and the mini-dungeon plan's run steps 2–4. Opus for the look (G848); the Vault
interior is an original design (Jake 11-03: the Vault shots are original mockups, no blockout of it).

## 1. The showcase piece

Inside the Vault (x 151…221, z −99…−29, y −40…−30), each room its own checkpoint:

| Room | What | Rows (from west and east hosts) |
|---|---|---|
| 1 Puzzle | two pressure plates, a crate to push, a door that opens while both plates are held | W4a plates, `pushable.as`, door `opensWhen` |
| 2 Fight | the doors seal, two or three small waves (Mites, a Jack), open on the last kill | E10b sealed room |
| 3 Climb | a ladder, scramble blocks, a rope bridge and a lift to the last door | W8a ladders, W8b scramble, W6c rope deck, W6a winch lift |

The `vault` music cue (E15b) and the vault room tone (`wet` 0.45). A short blockout pass first (one round in
`art/showcase-template/round-12-vault/`), then the polished look.

## 2. Engine / game / host work, just in time

None: every row is a west or earlier east host. Research for fit: four rooms in a 70 × 70 × 10 m box is tight for a
lift and a scramble; the climb room may need the full 10 m height (Q1).

## 3. Other shards in this slice

None.

## 4. Done when, hours, blockers

**Done when:** a player walks rooms 1–3 in order, solves the plates, clears the waves, climbs out; a death in room 2
restarts room 2 with room 1 still solved; physics walk baseline 0 stuck inside the Vault.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 0 | 0 | 20 h (Opus: blockout 4 h, rooms 12 h, rows 4 h) | **20 h** |

**Blockers:** E10b, W4a, W6a, W6c, W8a, W8b.

## 5. Risks

- The body cap: room 1's crate plus room 2's bodies stay far under 40; the Vault is never loaded with the Titan arena.

## 6. Questions for Jake

1. **The Vault's height.** Round 5 gives it y −40…−30 (10 m). (a) keep 10 m and make the climb room a 9 m climb; (b)
   deepen it to y −50…−30 (20 m) for a taller climb, still clear of the Titan arena's sky at −80. **Recommended (b):** a
   10 m box can't hold a ladder, a scramble and a lift to a last door with headroom; 20 m still leaves 30 m to the arena.
