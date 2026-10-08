# SF57 first-crossing context-loss control

Rejected measurements, not a soak or memory-cap pass. All Simulator, Inspector,
proxy and sampler resources closed; borrowed previews returned to their owner.

| Run | Runtime | Harness | Completed legs | Result |
| --- | --- | --- | ---: | --- |
| initial | 111ea74e9 | 86c2565b4 | 0 | Game context lost; document fence refused |
| repeat | 111ea74e9 | c09f26219 | 0 | Same first Pine crossing loss |
| control | cdad59776 | 1ee89edf4 | 0 | Historical runtime also loses the context |

The repeat and control identify the connected `CANVAS#game` as the lost context,
with current/inside `pine-hollow`, no pending admission and no active runtime hook.
The repeat loss was at epoch 1791456003.258; the control at 1791456246.671.
Both recover by ordinary graphics-recovery navigation; the measurement-document
fence correctly rejects that navigation. Fixed game WebContent PIDs never vanished.
The repeat GPU-process footprint fell from 193,202,840 B 0.472 s before loss to
21,940,456 B 0.549 s after. This is a separate footprint reading, not independent
proof of a GPU PID restart, and is not added to WC+GL.

No regression between these runtime pins is established. The earlier cdad run in
`../reconciliation-failure-cdad59776/` completed four cell legs and three crossroads
with zero game errors under the earlier harness; it was rejected for GL reconciliation.
The changed instrumentation/environment remains to be isolated. The current journal
reconciles the repeat's 43 reconstructed and 47 observed samples with zero missing
samples, but correct reconciliation does not make a disrupted run acceptable.
The historical control has one missing GL sample and remains rejected as recorded.

No cap, saving, calibration, post-unload leak or DFG ownership claim is made. SF57
still needs an accepted five-minute rehearsal and the thirty-minute run. Far/Sun,
full catalogue, road-only and shipped-layout coverage remain open.

Each run directory contains its summary plus Brotli archives of the exact result,
manifest and three raw journals. `artifacts` records raw SHA-256, raw length and
compressed length; every archive was decompressed and compared before committing.

Plan-State: unchanged
