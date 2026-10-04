# GW2-ZONES council: the frozen ledger

> **State:** frozen for the council started 2026-10-01 (3 rounds, Jake's number). A seat may reopen an item only with
> new evidence that it is wrong (a file:line, a quote, a source), never on preference. Protocol: [singleplayer `docs/process/COUNCIL.md`](../../../docs/process/COUNCIL.md).

## Jake's statements (2026-10-01, quoted)

| # | Settled |
|---|---|
| L1 | "What we have right now is maximum 5 minutes of content. And even then only the island zone had a quest I could complete." That is his played experience. The doc may explain the gap to the code's estimates, but it may not deny the experience |
| L2 | "Nine Dragon doesn't have any content, it's a partial shard … under progress." |
| L3 | "I don't think we want to build these gigantic Guild Wars 2 zones, or maybe we do, I have no idea." This is an open question the doc answers; it is not a ledger item either way |
| L4 | "Of course we're not building Guild Wars 2, we're building Wildshard. But Guild Wars 2 has zones that are fun and you can play in those zones for hours." GW2 is the comparison asked for, not the design target |
| L5 | Reports about the MMO gap lived outside this repo at the time (since 2026-10-03, E431 / E433, they live in `docs/design/`): "we don't want to whiplash it with the impossible cliff of how to make this single player tech demo be Guild Wars 2." Recommendations must not turn into a pile of singleplayer work |
| L6 | The process complaint: "all the development of shards has just been focused on mockups, graphics, world, and really basic features … another agent has to retrofit content, enemies, quests into the world … they have to go together, and they have to ebb and flow." |
| L7 | The broadening: "how do we make the most fun shards possible that feel like a game that was designed by a game director … each shard would be designed by its own game director." |

## Standing project rules (from the repos)

| # | Settled | Source |
|---|---|---|
| L8 | The game is played as an iOS home-screen PWA on an iPhone (touch, portrait); phones are the target device | singleplayer `AGENTS.md`, memory |
| L9 | No URL switches: every variant is a Debug row | singleplayer `AGENTS.md` |
| L10 | Per-shard looks stay different (Driftwood toon, Nalati painterly, Pine Hollow photoreal PBR, Nine Dragon Jiehua Neon) | memory, VISION open tension |
| L11 | The vision's fundamentals: 500 × 500 × 200 m shards, a 5 × 5 first grid, a server-owned highway, a hardcoded centre, player-authored shards via Claude Code, uploaded as data, the beacon ritual | [../../vision/VISION.md](https://github.com/Raynos/project-wildshard-meta/blob/main/docs/vision/VISION.md) |
| L12 | Crafting is out of scope for now | VISION |
| L13 | The shard inventories are read from code at tag `pre-normalization` (`dcd6a29a`); nothing was played. Seats may challenge a reading with code evidence | the inventories |
