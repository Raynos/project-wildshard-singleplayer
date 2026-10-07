# SF61 Debug-row inventory (E435, E451, G204)

Inventory taken from committed `b64c2a908` on 2026-10-07, after the E451 rules in `dfddbc370` / `f8d404cee`.
`lint/debug-flags.mjs` finds 32 definitions; the inline `runtimeVariantEnabled` call for `pineMemoryTrim` adds
one omitted definition. Further review found the global navigation action `game.template`, also omitted:
**34 actual rows** (33 listed initially, plus the navigation action). The committed ceiling is 32. Repeated installations of the shared
`shardDirectors` row in separate shards count as one definition. No generated inventory or foreign staged file
was used as the authority. Sources below are paths from the repo root.

The Debug menu is already visually hidden when Developer is off. That does not gate saved experimental values
or their runtime installation. SF61 must distinguish a comparison from a developer tool, a player preference
and unfinished runtime work; merely hiding its menu is insufficient.

| ID | Ask | Source | Gates | Recorded pick / disposition |
|---|---|---|---|---|
| `ai.brains` | E357 | `src/engine/ai/view/DebugOverlay.ts` | Live AI geometry/text overlay | Diagnostic, no A/B pick; move to Developer tools. |
| `learnedLut` | E85 | `src/engine/ui/debugOptions.ts` | Fitted colour grade vs no grade | **ON picked**, E85: permanently on, remove from Settings. Retire row, option and off branch. |
| `graphMaterials` | E435 | same | SF59 graph backend vs family presets | Unfinished SF59, physical-device/perf proof outstanding; keep owner-controlled, gate unfinished work with Developer. No taste board inferred. |
| `time` | E55 | same | Live day cycle vs a held time | Inspection tool; no winner to pick. Move to Developer tools. |
| `weather` | E357 | same | Authored weather vs held clear/fog/rain | Inspection tool; no winner to pick. Move to Developer tools. |
| `clockSpeed` | E162 | same | Normal vs accelerated authored clock | Timer diagnostic; no winner to pick. Move to Developer tools. |
| `musicStyle` | E5 | same | Piano/orchestral/folk/generated vs synth score | E5 explicitly requests three styles and an in-game switch; player preference. MiniMax composer picked (E5/E33), not one style. Move preference to Audio; inspect synth fallback before retirement. |
| `sfxSet` | E5 | same | Generated best takes vs synth sounds | Generated better take is shipping policy (AGENTS); synthetic load-failure fallback has a separate purpose. No pending A/B found; remove forced synth selection after audio-owner coordination. |
| `aimRing` | E162 | same | Aim-assist diagnostic ring | E162 calls it a debug aid, not a taste comparison. Move to Developer tools. |
| `creatures` | E136 | same | Model creatures vs procedural rigs | **Models picked**, E136; remove selectable proc path. Preserve required procedural bake/loading/failure recipes. |
| `balbals` | E162 | same | Natural dusk activation vs forced wake/off | Encounter diagnostic, not an A/B pick; move to Developer tools. |
| `ghosts` | E162 | same | Natural riders vs forced line/off | Encounter diagnostic, not an A/B pick; move to Developer tools. |
| `crossroadsRig` | E435 | same | Navigates production Memory check to static rig | **Remove picked**, G115 / SF22c: rig remains a Simulator tool, production row deleted. |
| `fps` | E193 | same | Desktop auto/30/60 frame cap | E193 picks phone 30; row already desktop-only. Desktop frame preference/test aid, not a pending taste pick. Move to Developer tools or Video preference. |
| `loadProfile` | E162 | same | Load-path timing instrumentation | Developer diagnostic; move to Developer tools. |
| `tex` | E157 | same | Auto/KTX2/images loading | E157 A+B and **G188 phone KTX2 first** are decided; x2 owns loading/admission changes. Coordinate retirement with x2; retain fallback on capability/failure, not forced images. |
| `prefetch` | E158 | same | Background download on/off | **ON picked**, E158: Wi-Fi and cellular. Off was a benchmark switch; retire row/option and forced-off branch, preserve Save-Data/SW refusal. |
| `memorySaver` | E435 | same | SF22d CPU copies/depth/shadow/half-luminance cuts | **Keep default-off picked**, G114, not ON. Proof work remains; unfinished Developer candidate with explicit risky-render gate. No new A/B board presumed. |
| `bootPack` | E162 | same | Existing packs vs forced per-file boot | Developer loading diagnostic; no recorded taste comparison. Retire forced-off option if pack path/fallback proof green, otherwise Developer tool. |
| `storage` | E357 | same | Storage usage/persistence readout | Readout, not comparison. Move to Developer tools. |
| `clearDownloads` | E172 | same | Two-tap cache wipe preserving saves | Requested diagnostic action, not comparison. Move to Developer tools. |
| `calibrate` | E357 | same | One-shot empty calibration run | Developer action, not comparison. Move to Developer tools. |
| `budgetReadout` | E357 | same | Prints tier/budget/current renderer cost | Developer action, not comparison. Move to Developer tools. |
| `gridDevserverCell` | E435 | `src/game/grid/debug.ts` | DEVSERVER placement vs Template 1 | DEVSERVER-only development configuration, not an open taste pick. Keep owner-safe until Developer configuration route replaces it. |
| `game.template` | E357 | `src/game/shard/templateDebug.ts` | Global Enter Template action | Developer navigation tool, no comparison. Global action scanner previously omitted it. |
| `shardDirectors` | E435 | `src/game/shardfile/directorClient.ts` | Data/script policies vs shipping oracles; remaining Nalati flock and families | G112 technical parity retirement, not taste. **Do not retire yet:** Nalati flock ON floor pending; remaining policies in flight. Gate candidate through Developer, retain independent proof control. |
| `effects.apply` | E357 | `src/kit/effects/install.ts` | Forces starter effects every five seconds | Developer combat test aid, not comparison. Move to Developer tools. |
| `farReachEntries` | E435 | `src/shards/far-reach/debug.ts` | Rising Islet entries vs closed old entries | **G183 option 4 / G200 B picked**; G194 holds OFF until way-up works. Live Opus lane owns it; keep until proof/owner release. No new board needed. |
| `nalatiHybrid` | E435 | `src/shards/nalati-grasslands/plugin.ts` | Hybrid resident loader vs legacy entry | Unfinished SF48 technical candidate, x1 owns; Developer gate, no new A/B taste pick. |
| `nineDragonEntries` | E435 | `src/shards/nine-dragon-stack/debug.ts` | Four decks/lift vs closed old entries | **G177/G184 B/G200 B picked**; G194 holds OFF until lift works. Live Opus lane owns it; keep until proof/owner release. |
| `pineLife` | E357 | `src/shards/pine-hollow/debug/options.ts` | Birds/hares/ravens/skinning gameplay on/off | E162 Models winners apply to individual visuals, not removal of gameplay. No pending life ON/OFF board found; gameplay is shipping, retire forced-off diagnostic. |
| `cragView` | E357 | same | Shaded/AO/sun/wet/normal/albedo channels | Developer material inspection; no taste pick. Move to Developer tools. |
| `pineMemoryTrim` | E435 | same (inline runtimeVariantEnabled) | RGB9_E5 sky / B1+B2+B4+B5 phone memory cuts | **G180/G187 picks recorded**, x2 owns exact loading/memory rollout. Keep until owner/proof release; no new board needed. Scanner must include this row. |
| `pineHybrid` | E435 | `src/shards/pine-hollow/plugin.ts` | Hybrid resident loader vs legacy entry | Unfinished SF47 technical candidate, x1 owns; Developer gate, no new A/B taste pick. |

## Recorded decisions already purged

These are not live rows at the inventory pin: `measureLook` (G163 B), `driftwoodGpuOnlyCopies` and
`driftwoodIslandInstancing` (G173 ON), `gridOneFrame` (G175 ON, 16 m), `itemCards` (G181 big cards),
`driftwoodHybrid` (G172 shipped world), `gridMemoryAdmission` (G190 plus accepted proof),
`gridPlannedReload` / SF57b (G171 never), `gridRoadCull` (G112 accepted proof), and template oil
(SF16 single ItemRuntime owner). Recovery reloads remain required by G185/G209; they are not planned crossing reloads.
The E162 bird/people/knife and bow-arc rows were already deleted after their recorded picks.

## Real pending board batch

**None found in the 34 live definitions.** E162's formerly open bird/people/knife comparisons all have
recorded Models winners later in the same ask. Entry ideas, Template look, memory cuts and card style also have
recorded G-row winners. SF59, hybrid loaders, director policies and SF22d are technical work/proof gates,
not an invented request for Jake to compare A/B/C. Report newly discovered real taste comparisons to the coordinator.

## Ownership / remaining work

Coordinator relays live-lane coordination: x1 recovery/soak/hybrid; x2 admission/KTX2/Pine memory; Opus
Far/Nine entries; SF59 graph materials. Do not delete those owners' WIP or consume stale staged generated files.
Inventory is the initial receipt, not a claim that SF61 is closed. Per-row commits follow; the final ratchet
uses the actual complete scanner count after Developer tools are separated and reviewed winners retired.
