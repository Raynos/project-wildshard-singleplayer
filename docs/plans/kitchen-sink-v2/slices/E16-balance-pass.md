# E16: the balance pass (XP curve, fight lengths, the miss curve, soft gates, the economy)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs parent **K11** (the golden-ratio
XP curve ~60 h to L20, fight lengths, the miss curve, soft-gate brutality), **EB10** (contacts per kill, telegraphs at
30 fps, soft-gate feel), **LE10** (the economy golden test: Scrip per hour per band and the level each upgrade is
affordable, from the rows) and **LW10** (prices ± 30 %, numbers in the commit). The §15 maths stays locked (19aa): this
retunes constants against its targets, it doesn't reopen them.

## 1. The showcase piece

The whole east, tuned: a common dies in ~7 swings (~9 s) and kills you in ~11 strikes at equal level; +3 ≈ 50 % wins,
+6 ≈ 0 %; elites ~60 s, the Titan ~3.6 min; each Forge tier is 20–35 minutes of its band; a level-appropriate player
never waits for a respawn.

## 2. Engine / game / host work, just in time

No host change. Tools, all from the rows:

| Check | How |
|---|---|
| fight lengths | a headless duel runner over `CombatPipeline.hit` with the showcase's rows: every robot × every weapon × gaps −6…+8, 1,000 seeded duels each; the table goes in the commit |
| XP curve | the experience host's numbers vs the band respawn and walk-back times (round 3's 116–176 s walk-back vs 90 s respawn): hours per level band |
| economy | LE10's golden: Scrip and parts per hour per band, the level each upgrade becomes affordable, the pre-Titan total (the loot plan: ~7,700) |
| telegraphs | every windup ≥ 0.6 s (18 frames at 30 fps): a scan of the strike rows plus a 30 fps capture per robot |
| a playthrough | one Codex lane plays L1 → L8 on a served build with the Developer row; one Opus lane checks the elites' feel |

## 3. Other shards in this slice

None (the showcase's rows only).

## 4. Done when, hours, blockers

**Done when:** the duel table hits §15's targets within ±15 %; the XP curve's real hours to 20 are in the plan's STATE
(the golden-ratio target ~60 h, 19p); the economy golden passes; prices moved at most ± 30 % with the numbers in the
commit.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 4 h (the duel runner) | 0 | 20 h | **24 h** |

**Blockers:** E2–E12h (everything that fights).

## 5. Risks

- ~60 h to L20 can't be play-tested in full; the runner and the economy golden are the proof, a real run covers L1–L8.

## 6. Questions for Jake

1. **If the real curve is far from ~60 h** (respawns and walking make it slower or faster). (a) retune the XP ratio to
   land near 60 h; (b) keep ×1.618 and report the real hours. **Recommended (b):** you picked the golden ratio itself
   (19p); the hours are its consequence, reported, and you decide after your play.
