# Milestone follow-up — 2026-10-16

Pinned source `4fa84dbe9702b63300c6adf94f32a0f5ee3157d1`, build `4fa84db-mvamy1u5`. Includes Pine module preparation `3efc0d81d` and KTX2 resource fix `c5ef7b1c1`. Comparison: [78254116d receipt](../milestone-2026-10-16/README.md), source `f542a4cfb`.

**Floor FAIL; matrix complete; page errors 0.** Two plain passes per surface, each with four standalone shards and the full milestone grid journey. Same 120-frame/default-settle protocol, muted, Developer on, live clocks, 2× render scale, no profiler or GL observer. Desktop Chromium/Metal 1440×900 Auto fps; portrait iPhone 17 Pro Simulator Safari, phone tier and shipped 30 fps cap. Simulator is Mac-backed Safari, not physical-device fps.

Table cells are median / p95 / worst ms. Median and p95 come from the worst-p95 pose in each scope; worst is the maximum frame across its poses. Every pose and full drive verdict remains in [receipt.json](receipt.json). Desktop bar: rounded median ≥60 fps, p95 ≤17.5 ms, max ≤100 ms; Safari: ≥30 fps, ≤35 ms, ≤200 ms. CPU ownership/validity checks are retained.

| Surface | Case | Previous | Pass 1 | Pass 2 | Both pass? |
| --- | --- | ---: | ---: | ---: | --- |
| Desktop | Pine standing | 16.7/16.7/16.8 | 16.7/16.8/16.8 | 16.7/16.8/16.8 | PASS |
| Desktop | Pine road | 16.7/33.4/983.3 | 16.7/33.3/83.3 | 16.7/33.3/83.3 | FAIL |
| Desktop | Driftwood standing | 16.7/16.8/16.8 | 16.7/16.8/16.8 | 16.7/16.8/16.8 | PASS |
| Desktop | Driftwood road | 16.7/16.8/66.7 | 16.7/16.8/50 | 16.7/16.8/66.7 | PASS |
| Desktop | Sky standing | 16.7/16.8/16.8 | 16.7/16.8/16.8 | 16.7/16.8/16.8 | PASS |
| Desktop | Sky road | 16.7/16.8/66.7 | 16.7/16.8/66.6 | 16.7/16.8/66.7 | PASS |
| Desktop | Signal standing | 16.7/16.7/16.8 | 16.7/16.8/16.8 | 16.7/16.7/16.8 | PASS |
| Desktop | Signal road | 16.7/16.7/83.3 | 16.7/16.8/16.8 | 16.7/16.7/16.8 | PASS |
| Desktop | Hub/grid standing | 16.7/16.8/16.8 | 16.7/16.8/16.8 | 16.7/16.8/16.8 | PASS |
| Safari | Pine standing | 33/34/35 | 33/34/36 | 33/34/35 | PASS |
| Safari | Pine road | 34/81/852 | 34/86/216 | 34/91/148 | FAIL |
| Safari | Driftwood standing | 33/36/42 | 33/44/49 | 33/45/51 | FAIL |
| Safari | Driftwood road | 33/44/113 | 33/52/122 | 33/75/164 | FAIL |
| Safari | Sky standing | 33/34/36 | 33/35/37 | 33/34/43 | PASS |
| Safari | Sky road | 33/45/310 | 33/48/151 | 33/47/182 | FAIL |
| Safari | Signal standing | 33/34/34 | 33/34/35 | 33/34/34 | PASS |
| Safari | Signal road | 33/38/135 | 33/38/135 | 33/36/98 | FAIL |
| Safari | Hub/grid standing | 33/34/164 | 33/34/46 | 33/34/35 | PASS |

Pine's earlier 983.3 ms desktop and 852 ms Safari drive stalls did not repeat: desktop drive maxima were 83.3/83.3 ms; Safari 216/148 ms. The 216 ms frame still fails Safari's 200 ms gate. Pine travel remains a failure in both passes (desktop p95 33.3/33.3 ms; Safari 86/91 ms versus 81 previously), so this is not an overall Pine floor pass.

Safari Driftwood standing worsened from p95 36 to 44/45 ms, and its road scope from 44 to 52/75 ms. Those are repeated measured misses; this unprofiled follow-up does not establish their cause. Sky and Signal Safari travel also remain failures. Extra journey misses: Nine drive max 133.3 ms on desktop pass 1 and 415 ms on Safari pass 1; desktop Template return max 116.7 ms on pass 2; Safari Nalati drive p95 36 ms on pass 2. Every exact failure is retained in the JSON.

Quiet windows are bounded, owned by sp-x7 and auto-cleaned; load samples and exact phase times are retained. Each cohort has its own fresh browser. A second pass may still benefit from OS/network caches. Plain timing repeats show observed behavior, not proof that either fix caused a timing change. Other grid routes (Template/Nine/Nalati) and their failures remain in the JSON. No floor threshold or gameplay timing was weakened.
