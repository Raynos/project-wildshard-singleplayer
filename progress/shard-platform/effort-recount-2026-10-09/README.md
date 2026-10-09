# M3 effort recount, 2026-10-09

Jake asked how many hours the shardfile port has taken and how many are left, per shard, and what shape the
progress curve has. Effort is measured from the 643 Codex and Claude session logs since 2026-10-04: active time,
with idle gaps capped at 15 minutes, credited to each commit's shard. Share is today's `scripts/shard-platform.mjs`,
re-run on historical commits. Confidence is low to medium: the hours spent are measured, but the hours remaining
extrapolate the bake phase seen on two small shards.

| shard | agent-hours spent | agent-hours remaining | effort % done | share % (HEAD) | proofs passing of 6 | curve shape |
|---|---|---|---|---|---|---|
| Template 1 | 57 | 0 | 100 % | 90.4 | 6 | early jump, then flat |
| Signal Dunes | 16 | ~28 | 37 % | 20.9 | 6 | flat, jump, tail starting |
| Sky Reach | 20 | ~50 | 28 % | 9.6 | 5 | flat, jump (still in it) |
| Pine Hollow | 21 | ~205 | 9 % | 3.1 | 3 | flat |
| Driftwood | 17 | ~140 | 11 % | 1.0 | 3 | flat |
| Nalati | 23 | ~280 | 8 % | 0.4 | 0 | flat |
| Nine Dragon | 10 | ~150 | 6 % | 0.2 | 3 | flat |
| Shared systems | 41 | ~100 | 29 % | — | — | — |

**Overall:** about 205 agent-hours spent and about 950 left, so 18 % done (13 % without Template 1). At about 10 lanes
on nothing but the port, the 950 hours take about 95 h of wall clock. At today's mix (38 % of fleet hours on the port),
they take about 350 h.

**The shape** (`share-vs-hours.jpg`) is neither linear nor a snowball:
1. The share stays flat while a shard's witness is built: 6–16 h, during which custom lines even grow by 2.6–4.1k.
2. It jumps once the static builders are baked, at 110–220 lines/h.
3. Then a slower tail, as behaviour moves to data and AssemblyScript at about 60 lines/h. This tail holds most of the
   remaining hours, and it depends on the shared systems.
