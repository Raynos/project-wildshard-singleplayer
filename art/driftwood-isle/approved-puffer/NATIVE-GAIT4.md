# Isolated V57 rig1 gait4 trial

Source-only candidate; not accepted or published. Normal motion3 artifacts remain frozen.

Use the unchanged eight-bone rig1 native input pinned at7d27737df2bd9b1c7b81fd8eff97fbf5fc4fa02f9eba85faeeacd646cc481dcb. The gait4 CLI mode refuses any other native hash or uncalibrated legLen. Rest geometry is the builder's exact-rest-equivalent V57; weights differ at fin caps/transitions.

Build after source checks and lane assignment:

```
python3 scripts/heavy-lane.py build --max 3 -- node scripts/build-puffer-native-preview.mjs art/driftwood-isle/approved-puffer/unaccepted-v57-gait4-dimensions.json gait4 tmp/puffer-native-preview/v57-gait4 art/driftwood-isle/approved-puffer/v57-gait4-preview-candidate.json
PUFFER_PREVIEW_DIR=tmp/puffer-native-preview/v57-gait4 python3 scripts/heavy-lane.py build --max 3 -- node scripts/build-puffer-native-preview.mjs --app tmp/puffer-native-preview-v57-gait4-dist
```

The measurement receipt preserves geometric measurements and explicitly annotates the sole calibration: legLen=.24/(2sin(.36)) drives the existing engine walk phase. Other dimensions remain measured, and all collision/visual acceptance flags remain false. At0.7m/s this gives approximately1.808cycles/s. This is a phase/speed approximation, not the builder's displacement-integrated prototype.

Feet use a0.62 support duty,±0.12m localZ stroke, smooth return and0.06m swing lift. Existing body idle bob is cancelled at the distal feet while moving. Fore/rear diagonal pairs alternate. Speed scales stroke below the generic0.6Hz phase minimum, but low-speed gait-weight transitions, turning, collision and terrain still cause slip. No private numeric recurrence, new actor state or shared engine runtime changes are introduced.

Settled speed0 returns feet to bind. A sudden speed0 transition can visibly pop up to approximately0.12m: an explicit unit test records this limitation rather than claiming the builder's0.22s stateful stop blend. The runtime's actual speed smoothing must be evaluated in genuine stop/start footage. Local turn continuity is tested; world-space planting during a turn is not guaranteed.

Attack gait blend fades over the first0.22s of the existing strike clock. Body/tail motion3 brace/release,1.10maximum swell and allAI/combat timings remain unchanged. FinX is held neutral; finY blends back to the attack pose. Actual weighted vertex attack-blend audit and side/three-quarter gameplay recording are required before any promotion.

The initial author expression exceeded the128-node admission limit by one node. It is preserved as rejected-gait4-overbudget.ts. Constants were deduplicated without changing any schema limits. Focused tests cover the unchanged motion3, gait4 stop bind, true engine phase/speed relation, wrap/turn continuity, disclosed abrupt-stop pop and attack blend. This is functional coverage, not an animation-quality score.
