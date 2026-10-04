# E435 SF47: the ranger porch exit

The standard Pine Hollow walk passes all seven authored legs on both phone and desktop tiers after Hale's move (`c5fcea94c`). Each run reports **0 stuck and 0 page errors**. Measured origin pin: `6ce58df8863ee55697442cd5546efc552b333a4f`, preview build `6ce58df-mutvhlx7`.

The observation-only parity diagnostic found Hale's solid NPC box at the stone exit: the blocked capsule at `(-8.450, 3.710, -34.833)` contacted the box centred at `(-7.781, 4.343, -34.460)`, normal `(-0.974, 0, -0.225)`. This matches Hale's cabin-local `(6, 1.7)` placement. The coordinator moved him to `(6, 0.2)` with the same facing; `addPerson` still creates his figure, following collider and talk prompt together. The controller, route, tolerance and collider dimensions are unchanged.

```sh
scripts/browser-lane.sh --max 15 node scripts/physics-baseline.mjs --no-build --mode=walk --shard=pine-hollow --tier=phone --url=<pinned preview> --settings=time=midday,weather=clear,memorySaver=off --label=sf47-walk-after-phone
scripts/browser-lane.sh --max 15 node scripts/physics-baseline.mjs --no-build --mode=walk --shard=pine-hollow --tier=desktop --url=<pinned preview> --settings=time=midday,weather=clear,memorySaver=off --label=sf47-walk-after-desktop
```

The harness defaults to phone and now validates `--tier=phone|desktop` (`06a2295cb`), recording the tier in JSON. Both runs retain the standard portrait viewport and real CharacterMotor/input path. [Phone walk](../physics/sf47-walk-after-phone-6ce58df-mutvhlx7.json), [desktop walk](../physics/sf47-walk-after-desktop-6ce58df-mutvhlx7.json).

Before the move, the stock phone pond baseline also reported 0 stuck; the fixed-clock parity walk reproduced the wp1 stall. These are different observations, not a claimed stock-baseline 1→0 improvement. Trails and the exact parity wp1 check are still running. The coordinator's next combined floor on both surfaces includes this placement.
