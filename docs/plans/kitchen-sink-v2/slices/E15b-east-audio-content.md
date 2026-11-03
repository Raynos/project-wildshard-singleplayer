# E15b: east audio content (the east score, elite and boss music, stings, ~65 SFX, ambience)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the east half of **AU1–AU6**
(briefs, music, stings and the Titan intro cue, SFX, rows, the mix pass), audio plan §2–§5. West cues (`hub`, `west`,
`night`, `storm`) landed in W11b. Music is MiniMax Music 3; every SFX goes through MOSS-SoundEffect v2 and Stable Audio
3 Medium and the better take ships; one local model at a time, batches under 30 minutes (AGENTS.md).

## 1. The showcase piece

| Kind | East content |
|---|---|
| Music (orchestral, industrial colour) | `east-low` (bands 1–3, layers by band), `east-high` (bands 4–6, layers by band), `vault`, `elite-pallet`, `elite-warden`, `elite-foreman`, `boss-titan` (base + bass + drums; phase gains 1 [0.6, 0], 2 [1, 0.55], 3 [1, 1]) |
| Stings | `levelUp`, `questComplete` (if not in W11b), `contract`, `eliteDown`, `death`, `beaconLit`, `dawn`, `shardComplete` (8 s); the **12 s Titan intro cue** cut to E12h's shots on its onsets |
| SFX (~65 of ~95) | metal hits ×3, parry clang ×2, riposte ring, arrow / spear metal impact, bolt-metal, pitch ignite + burn loop, broadhead thunk, lever cycle, ricochets; per robot (6): move loop, telegraph, hit, death; night lamp buzz; elites and Titan: intro roar, signature telegraphs, hit, death, the assemble rumble; UI: XP tick, level-up chime, glance tick, crit ping, Scrip coins, contract accept / turn-in; world: beacon ignite + loop, portal hum + enter, door seal / open |
| Ambience | east band beds deepening by band, the vault (`wet` 0.45), the arena (`wet` 0.2), night lowers the machines |

Robots chirp, no spoken lines (19k); the Foreman's whistle is the one "voice". Robot voices go in
`public/assets/sfx/showcase-template/`; generic sounds into the shared `best` set.

## 2. Engine / game / host work, just in time

None: E15a's hosts and W11b's named stings and one-genre set. Robot calls through `registerCalls` (reach, gap) so packs
don't stack voices; at most 8 robot voices at once; telegraph sounds are never ducked and win voice stealing (audio
plan §5).

## 3. Other shards in this slice

New shared sounds don't change any shard's cue map (proof: identical cue logs on Driftwood and Nalati). No save risk.

## 4. Done when, hours, blockers

**Done when:** every cue above plays in its place; music download for the whole shard ≤ 12 MB, shard SFX ≤ 3 MB;
decoded audio ≤ 60 MB read on the Simulator with E17's memory read; Jake gets a listening page (an artifact with mp3s,
memory: `.m4a` is refused) of the east cues.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 2 h | 0 | 30 h (model runs, picks, stems, cuts, rows, the mix pass; Opus ear checks) | **32 h** |

**Blockers:** E15a; the robots and elites whose sounds it wires (E1b–E12h; it can land in batches as they do).

## 5. Risks

- Model time: 7 cues × 2 seeds, 9 stings, the intro cue and ~65 SFX × 2 engines is many hours under the one model lock;
  batch it across days and never run two models at once.

## 6. Questions for Jake

1. **Band intensity.** (a) two east themes with layers by band (the audio plan); (b) six band themes.
   **Recommended (a):** fits the 12 MB budget and the layers already step with the band.
