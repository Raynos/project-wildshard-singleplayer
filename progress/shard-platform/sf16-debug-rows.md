# SF16 Debug-row inventory

Source: `lint/debug-flags.mjs` scans literal registry, plugin and declared plumbing rows.
The switch retired the legacy installer but recreated `template.oil` in plumbing, so its
initial count stayed 29. This follow-up removes that teaching-only row from the source
project and lowers the policy ceiling to 28. The lantern's normal action remains.

Both baseline diagnostics and variants count against the same ceiling. Permanent developer
aids have no retirement plan; variants carry the actual plan row and its exit condition.
No new plan rows are invented here. Later independently approved additions are separate
from this 29 → 28 SF16 decrement.

| Row | Ask | Classification / retirement |
| --- | --- | --- |
| ai.brains | E357 | Baseline AI diagnostic overlay; retained |
| learnedLut | E85 | Baseline look inspection option; retained |
| time | E55 | Baseline clock inspection; retained |
| weather | E357 | Baseline weather inspection; retained |
| clockSpeed | E162 | Baseline clock acceleration; retained |
| musicStyle | E5 | Baseline selectable music preference; retained |
| sfxSet | E5 | Baseline selectable SFX preference; retained |
| aimRing | E162 | Baseline aiming aid preference; retained |
| creatures | E136 | Baseline procedural/model inspection; retained |
| balbals | E162 | Baseline creature inspection; retained |
| ghosts | E162 | Baseline creature inspection; retained |
| crossroadsRig | E435 | SHARD-PLATFORM SF22c phone measurement action; retained diagnostic |
| fps | E193 | Baseline cadence diagnostic; retained |
| loadProfile | E162 | Baseline loading diagnostic; retained |
| tex | E157 | Baseline texture-path diagnostic; retained |
| prefetch | E158 | Baseline loading-path diagnostic; retained |
| memorySaver | E435 | Variant: SHARD-PLATFORM SF22d; remove losing path/row after SF22c physical reading and Jake's pick |
| bootPack | E162 | Baseline boot-path diagnostic; retained |
| storage | E357 | Baseline cache readout; retained |
| clearDownloads | E172 | Baseline cache clearing action; retained |
| calibrate | E357 | Baseline calibration action; retained |
| budgetReadout | E357 | Baseline budget diagnostic; retained |
| gridOneFrame | E435 | Variant: SHARD-PLATFORM SF19a/SF19b; retain default-off until physical evidence/pick, retire losing path/row at pick |
| gridDevserverCell | E435 | SHARD-PLATFORM SF21a baseline DEVSERVER-only cell selection; retained developer aid |
| effects.apply | E357 | Baseline effect diagnostic; retained |
| template.oil | E357 | Retired by SHARD-PLATFORM SF16; no replacement Debug row |
| driftwoodHybrid | E435 | Variant: SHARD-PLATFORM SF46; retain default-off through conversion parity, remove losing path/row when Jake picks |
| driftwood.director | E435 | Variant: SHARD-PLATFORM SF24, default-off; retire the row and legacy path at the SF46 conversion |
| pineLife | E357 | Baseline life/environment inspection; retained |
| cragView | E357 | Baseline lookout inspection; retained |

Verification: the template's admitted plumbing has zero Debug rows; SF16 reduced the global
inventory to 28 with no `template.oil`. SF24 subsequently added the independently reviewed
default-off `driftwood.director` row (5ce272552), raising its ceiling to 29; its retirement
belongs to SF46. The historical review note predicting a fall to 26 was
stale: independently added grid/measurement/variant rows still exist and are inventoried
above. This follow-up does not delete unrelated diagnostics to satisfy that old prediction.
