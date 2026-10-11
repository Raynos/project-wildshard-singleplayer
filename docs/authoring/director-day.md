# Director day observations

A director input can observe the declared look clock with `day:FROM..TO`.
Both endpoints are fractions between 0 and 1, in increasing order. Zero is
midnight, 0.5 is noon. The interval includes FROM and excludes TO; an interval
that crosses midnight uses two inputs and `late || early`.

```ts
import { Director } from '@wildshard/sdk/director';

const dusk = new Director({
  id: 'outpost.dusk',
  inputs: { dusk: 'day:0.75..0.84' },
  stages: [
    { id: 'waiting' },
    { id: 'lit', when: 'dusk', do: [
      { flag: { key: 'outpost.beacon-ready', value: true } },
    ] },
  ],
});
```

Declare `outpost.beacon-ready` in `quests.flags` and put `dusk.toJSON()` in
`directors`, or attach the director to an authored scene. `look.day` determines
the real minutes per day and start time; when omitted it uses the rendered
12-minute day starting at noon. `look.dayOverride` pins and pauses that same
clock. Authors do not calculate ticks or provide clock callbacks. `when` still
accepts bounded boolean expressions, not numeric comparisons.

The native host advances the renderer's exact clock recipe before director
observations on each fixed tick. The browser reads its actual page-owned look
clock and never advances it a second time. Both preserve the complete clock
continuation (time, pause, scale, cycle and held pin) and stage cursor on restore;
restore emits no stage action. Flag-only directors keep their existing snapshot
shape. A missing page clock, malformed range or malformed continuation refuses.

The retained `dayDirectorExample` in `scripts/docs/authoring/directors.ts` is
executed by `test/director-day.test.ts`, alongside actual native restore and
borrowed page-clock checks.
