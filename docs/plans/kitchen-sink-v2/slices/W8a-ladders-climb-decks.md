# W8a: ladders and the climb yard's decks and bridges

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the ladder line of the old
**W18** ("ladders G") with a correction: no shipped shard uses ladder rows.

## 1. The showcase piece

| Item | Rows |
|---|---|
| Climb yard 40 × 56 (zone 10) | decks A 6 m, B 10 m, C 14 m, each with a ladder; rope bridges A → B → C → the Rock top (W6c rows) |
| Other ladders | the water tank (grapple hook 3), the tower (decks every 9 m), the Rock's chimney (north face), the movers pit (W6a) |
| Count | 6 ladders in round 4's census + the pit ladder = 7 |

The scramble wall up to deck A and the Rock's south scramble route are W8b.

## 2. Engine / game / host work, just in time

Research: ladders are rows already, with no user.

- `src/format/modes.ts:27` `LadderModeSchema { kind: 'ladder', id, bottom, top, exit, normal, … }` with checks for a
  vertical ascending route and a landing behind the normal; the law is `src/game/server/shardfile/ladder.ts` (108 lines,
  `LadderDriver`: "fixed-step climb law shared by the real page and Node; every translation goes through the real
  capsule motor"; saved state `{ recipe, route, exit, latched }`). It landed in `52625b3406` (OS-F8, E435).
- `src/format/shardSchema.ts:286`: "ladder traversal requires the data-only player owner" (a product with a runtime
  can't use ladders).
- Users: none in `src/shards/` (only `test/fixtures/nine-boot-contract.ts` and the WorldClaw Thin Ice design mention
  ladders). The showcase is the first real user; the old row's "ladders G" overstated it.

Work: no new host. Write the seven ladder rows and their visual (a ladder model in the toon kit, Blender). Fix whatever
the first real use finds (budget 4 h: the law has never run in a shipped shard). Tests: add a product-level ladder test
(`ladder-product.test.ts`: climb up, exit onto the deck, climb down, save mid-climb and restore); `physics-baseline`
climbs each ladder in its walk (a route per ladder).

## 3. Other shards in this slice

None (no other user). Host bar: the ladder law is a one-user host after this slice; it needs a G595 row (W0d register)
or a second user (Q1).

## 4. Done when, hours, blockers

**Done when:** all seven ladders climb up and down, exit onto their decks, survive a mid-climb save; the yard's decks
and three rope bridges carry you to the Rock top; walk baseline 0 stuck.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 4 h (first-use fixes) | 0 | 12 h (Opus: decks, ladders, yard) | **16 h** |

**Blockers:** W6c (bridges), W0b. W9a for the Rock top landing (until then the last bridge ends at a deck).

## 5. Risks

- First real use of a host no shard has shipped: expect fixes (exit landings on thin decks, the touch input to start a
  climb).

## 6. Questions for Jake

1. **Ladders: approve as platform with one user, or find a second?** (a) approve (G595): ladders are a generic verb any
   shard can use; (b) also give Nine Dragon or Driftwood a ladder now as a second user. **Recommended (a):** a ladder
   added to a shipped shard is a level change with its own look board, not a ride-along.
2. **How a climb starts on touch.** (a) walk into the ladder and push forward; (b) a CLIMB prompt button.
   **Recommended (a):** no HUD change; the law already latches on approach.
