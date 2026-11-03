# Mini plan: KITCHEN-SINK v2 audio (AU)

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md) §2.13. Jake, 2026-11-02: *"It's a kitchen sink, so it needs a music plan,
a sound effect plan, mini-boss music, boss music, all the good stuff."* The score is **orchestral**, made with MiniMax
Music 3; every SFX is made with MOSS-SoundEffect v2 and Stable Audio 3 Medium and the better take ships
([LOCAL-MODELS.md](../../process/LOCAL-MODELS.md)). Enemies and bosses: [enemies-bosses-mini-plan.md](enemies-bosses-mini-plan.md).

## 1. What the shared host does today

- **Score** (`format/audio.ts` `music`, `engine/audio/SetScore.ts`, `Stems.ts`): a slot is a bar-exact loop with a
  calm stem and a tension stem (one recording split by demucs); calm / alert / combat set the tension gain (0, 0.5, 1;
  combat falls back to alert 8 s after the last hit). `selection` rows pick the slot from scene fields (Nalati:
  `boss`, `storm`, `night`, `zone`, first match wins). A boss slot adds `layers` (bass, drums) with gains per phase 1–3
  (Pine's Antler King). A level's set lives in `public/assets/music/<set>-<genre>/`; one genre (orchestral, folk,
  piano or synth, from Settings) is resident at a time.
- **Stings:** four fixed names, `pickup`, `death`, `chunk`, `dawn`.
- **Ambience** (`zones`): rectangles with per-bed levels, blend metres, room `wet`, ≤ 32 positional loops, one-shot
  schedules; beds, winds and gusts.
- **SFX:** one merged `best` set (154 files, 4.1 MB) plus per-shard folders; melee cues pick hits by material (`wood`,
  `ground`, `flesh`) and clangs (`wood`, `stone`); creature calls by `registerCalls`; buses music, ambience, sfx,
  voice, ui. Credits come from `engine/audio/credits.ts`.

## 2. Music cue list

All ~45–60 s loops, 4/4, calm + tension stems. Prompts follow `scripts/music/gen/orchestral.json` (Hisaishi-warm
orchestra, no drum kit) with an **industrial colour**: anvils, low brass, snare, metal percussion. Two seeds a cue;
pick by the loudness shape.

| Cue | When | Character | bpm |
|---|---|---|---|
| `hub` | the hub | warm strings and horns, "shift change", D major | 92 |
| `west` | west half | playful pizzicato and woodwinds, G major (toys) | 104 |
| `east-low` | bands 1–3 | light march, snare, low strings, D minor; **layers gained by band** | 108 |
| `east-high` | bands 4–6 | heavy: low brass, anvils, taiko, C minor; **layers by band** | 116 |
| `vault` | Training Vault rooms 1–3 | harp, celesta, low strings, mysterious | 84 |
| `elite-pallet` | Big Pallet (elite) | comic-heroic brass, tuba oompah | 120 |
| `elite-warden` | Vault Warden (elite) | choir and timpani, ominous | 100 |
| `elite-foreman` | Foreman Unit 7 (elite) | driving strings, piccolo trills echoing his whistle | 128 |
| `boss-titan` | Crate Titan | base + bass + drums layers; phase gains 1 [0.6, 0], 2 [1, 0.55], 3 [1, 1] | 96 |
| `storm` | storm hour | tremolo strings, distant brass | 88 |
| `night` | night | muted horns, sparse harp | 72 |

Priority: boss > elite > storm > night > zone. Combat in any slot raises its tension stem (today's behaviour). Jake's
"mini-boss music" is the three band-gate elites' themes (he renamed mini-bosses to elites); the three night elites
(Sir Nibbles, Hot Mess, Riveting Rita) play the `night` slot at full tension plus the elite host's sting.

**Stings** (3–8 s, the score's key): `levelUp` brass fanfare · `questComplete` · `contract` (short) ·
`eliteDown` · `death` · `beaconLit` (chime) · `dawn` (the storm ends) · `shardComplete` (full orchestra and
choir, 8 s). **The Titan intro cue** (12 s, timed sections in the prompt) is cut to the cutscene's shots on its onsets.

## 3. SFX list

New sounds marked ★; the rest reuse the `best` set. Generic ★ sounds (metal, parry, UI, traversal) go into the shared
`best` set so every shard can use them; robot voices go in `public/assets/sfx/showcase-template/`.

| Category | Sounds |
|---|---|
| Sword | swing ×3 and heavy (reuse) · hit flesh / wood (reuse) · ★hit metal ×3 · ★parry clang ×2 · ★riposte ring |
| Spear, bow | thrust, draw, full draw, twang, impacts (reuse) · ★arrow / spear impact metal |
| Crossbow | fire, reload (reuse) · ammo: iron ★bolt-metal hit · pitch ★ignite whoosh, ★burn loop · broadhead ★heavy thunk |
| Lever rifle | fire (reuse) · ★lever cycle · ★ricochet ×2 |
| Robots, per type (6) | ★move loop (servo skitter, hydraulic stomp, rotor whine, torch hiss, plate drag, arc hum) · ★telegraph · ★hit · ★death (breaks into blocks); night shift: same takes pitched −2 semitones plus a ★lamp buzz |
| Elites (6), the Titan | ★intro roar · ★one telegraph per signature attack (crate throw, clamp slam, whistle, pounce, flare, lamp sweep, Titan slam / rain / roll) · ★hit · ★death; Titan ★assemble rumble |
| UI | ★XP tick · ★level-up chime (under the sting) · ★MISS whiff · ★glance dull tick · ★crit ping · ★Scrip coins · ★buy · ★locked · ★contract accept / turn-in |
| Traversal | ★lift clank + hum · ★spinner · ★slider · ★conveyor loop · ★jump pad launch · ★grapple fire / latch / reel · ★zip line run · ★hoverboard hum, ★trick landed, ★combo up |
| World | storm (rain and wind beds, thunder: reuse) · ★beacon ignite + loop · ★portal hum + enter · ★chest open · ★crate break · ★plate click · ★door seal / open |

About **95 new sounds**. Robots get calls through `registerCalls` (reach, gap) so packs don't stack voices.

## 4. Ambience zones

| Zone | Beds and loops | Room |
|---|---|---|
| Hub | low HVAC air, flag halyards, the obelisk hum, dev-bot chirps at the givers | open |
| West | light wind, far machinery, the parks' own loops (conveyors, lifts) as positional emitters | open |
| East bands | a generator bed deepening by band: 1–3 yard clanks and beeps · 4 welding crackle · 5 far rivet hammering · 6 arc buzz | open |
| Vault interior | room tone, servo ticks, drips; rooms 1–4 | `wet` 0.45 |
| Arena | wind through the stands; a rumble bed in the fight | `wet` 0.2 |
| Night / storm | night lowers the machines and adds lamp buzz; storm adds rain, storm wind and thunder (cell-wide) | — |

## 5. Mix and phone budgets

- Music about −18 LUFS under play; stings +3 dB over it; combat ducks ambience −4 dB, a boss slot −8 dB.
- **Telegraph sounds are never ducked** and win voice stealing: they are gameplay. At most 8 robot voices at once.
- Download: music ≤ **12 MB** (about 30 files; Nalati's 15 are 6 MB), shard SFX ≤ 3 MB, orchestral only.
- Memory: one genre resident; decoded only the playing slot, a crossfade target and the stings; decoded audio
  ≤ **60 MB** inside the 1.2 GB Explorer limit, read on the Simulator in K10.

**Credits and licences:** "Music: MiniMax-Music3" (a licence condition); "Sound effects: MOSS-SoundEffect v2 · Stable
Audio 3 Medium — Powered by Stability AI" (Apache-2.0 and the Stability licence's line). Both already show through
`credits.ts`; the shard-complete card's credits row repeats them.

## 6. Host gaps (all under W19)

| Gap | Today | Needed |
|---|---|---|
| W19a Named stings | four fixed names | a sting row per name (≤ 12) on the set's manifest and the cue map |
| W19b Layers by a scene field | layer gains only by boss phase 1–3 | gains by any numeric scene field (`band` 1–6) |
| W19c Boss and elite scene fields | written per shard | W11's boss path writes `scene.boss = id` and the elite host `scene.elite = id` while engaged, so each picks its slot by row |
| W19d One-genre set | a missing genre falls back to synth | a set may declare one genre that plays under every stem genre |
| W19e Metal | impacts wood / ground / flesh; clangs wood / stone | `metal` for both (robots, plates, crates) |
| W19f New event cues | none | cue rows on `damage.missed` and the outcome (LV3), XP, level-up (LV6), Scrip and shop (LE) to the ui bus |

The cutscene's cue track is IN-GAME-CUTSCENES IC4 (W12). Estimate: W19 grows from 7 h to about 16 h.

## 7. Wave 2 rows

| Row | What | Effort |
|---|---|---|
| AU1 | Briefs: 11 cues, 8 stings, the Titan intro, in the `orchestral.json` form | 0.25 d |
| AU2 | Music: two seeds a cue, the pick, demucs stems, bar-exact loops, Titan layers (`stems.py --set showcase-template`) | 1 d |
| AU3 | Stings and the Titan intro cue cut on onsets | 0.25 d |
| AU4 | SFX: ~95 sounds through both engines, CLAP rank plus an ear check, `sfx_merge.py` | 1 d |
| AU5 | Rows: music selection, zones and beds, positional loops, the cue map, robot calls | 0.5 d |
| AU6 | Mix pass and the memory read (with K10) | 0.25 d |
| | **Total** | **~3.25 d** (parent K9 holds 2 d) |

All model runs under the model lock, batches under 30 minutes.

## 8. Open questions for Jake

1. **Orchestral under every music setting?** Recommended: yes; folk and piano players hear the showcase's orchestral
   score (W19d), synth stays synth.
2. **Band intensity:** two east themes with layers by band, or six themes? Recommended: two themes with layers.
3. **Robot voices:** mechanical chirps only, no spoken barks? Recommended: chirps only; the Foreman's whistle is the one
   "voice".
4. **Shared sounds:** new metal, parry, UI and traversal sounds go into the shared `best` set? Recommended: yes.
