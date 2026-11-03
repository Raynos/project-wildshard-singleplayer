# E11d: Foreman Unit 7 (L18), wave 5, the run board, the Titan road

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the Foreman part of **EB6**,
**LS3** for the Foreman, its **LW7 / LW4** rows (200 Scrip, the Foreman's Capacitor, the hard hat worn, the trophy
*Foreman's Whistle*; the contract *Middle Management*), the tier-3 quest **The Gauntlet** (L18) and Jake's 11-03
ruling "the Titan road stays locked until your first gauntlet clear". Opus (G848).

## 1. The showcase piece

**C3 Foreman's Floor** (⌀84, floor ⌀56, terraces +1.5 / +3 m, wall 6 m, doors D5 / D6): **Foreman Unit 7, L18** (hard
hat, hi-vis, clipboard, rivet gun; E12 mockup) whistles from his office balcony (+6 m), then drops in. P1: rivet bursts
(laser 0.7 s); **the whistle** (a 1.5 s wind-up calling three buffed Mites, max 6; 30 damage during it cancels it, E8a's
interruptible wind-up). P2 "Overtime": a Pallet Jack and an Arc Sentry once; caution-tape zones slow you 40 %
(`effect.slow`, E0g / E4's hazards); under 25 % a 360° rivet spray with one gap (1.2 s tell). The trophy chest, then
**G3** opens to the Titan gate and the **Titan road** shortcut unlocks for good.

## 2. Engine / game / host work, just in time

None new: E8a, E11b, E10b, E4 (hazards), E3 (rivet projectiles). The Titan road is a door with `opensWhen: { all:
['gauntlet.cleared'] }` and `latch: true` (W4a's doors).

## 3. Other shards in this slice

None.

## 4. Done when, hours, blockers

**Done when:** an L18 player clears wave 5 in ~60 s of Foreman time; interrupting the whistle with 30 damage works on a
phone; the run board records the full run's best time; the Titan road opens after the first clear and stays open
across reloads; the quest and contract complete.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 4 h | 0 | 24 h (Opus: Foreman 10 h, C3 + balcony 8 h, fight 6 h) | **28 h** |

**Blockers:** E11c, E8a, E4, E3.

## 5. Risks

- C3 peaks at 9 live robots (round 5); with E0h's 12-awake cap that's fine, but the whistled Mites plus P2's adds can
  touch 9 + 2: the fight's `max 6` Mites is a hard cap in its rows.

## 6. Questions for Jake

1. **The Foreman's office.** (a) a balcony he whistles from, then drops in (round 5); (b) he starts on the floor.
   **Recommended (a):** the drop is the elite reveal, and the office roof holds a Gold 1×1 (round 5).
