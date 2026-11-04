# Golden-drift bounds, 2026-11-04

Status: current bisect stopped at the coordinator's G1012/G1014 priority
boundary. The first changing commit is **not established**. The origin of
each difference remains open; no visual fix or golden promotion is made.

| Symptom | Established bound | Panel |
|---|---|---|
| Pine 20 purple conifer crowns, faintly 12 | Present in retained clean c733 and NF18 candidate raw frames, and fresh landed 13253 and c280 frames; the proposed 13253..c280 onset is retracted | [20](../../art/golden-runs/drift-bound-2026-11-04/pine-hollow-20-board.jpg), [12](../../art/golden-runs/drift-bound-2026-11-04/pine-hollow-12-board.jpg) |
| Nine 11/12 cyan post and thin line absent | Already absent in retained clean c733, NF18 candidate, and fresh 13253/c280; the corresponding SHARDFILE golden still contains them | [11](../../art/golden-runs/drift-bound-2026-11-04/nine-dragon-stack-11-board.jpg), [12](../../art/golden-runs/drift-bound-2026-11-04/nine-dragon-stack-12-board.jpg) |
| Nalati 12 snow lighter than golden | Retained c733/NF18 and fresh c280 agree; fresh 13253 also captured for comparison | [12](../../art/golden-runs/drift-bound-2026-11-04/nalati-grasslands-12-board.jpg) |

Opus review (sp-o3, 2026-11-04): the full-resolution crops show the Pine
crowns identical in c733 / ba94 / 13253 / c280 and Nalati snow identical
in c733 / ba94 / c280. The prior 'green at NF18' Pine observation was a
downscaled-board error. All three differences predate c733. This is a
bound, not a regression/no-regression verdict.

The retained NF18 candidate is labelled **working candidate**: its build
said ba94ac09de but contained uncommitted NF18 changes. It is not used as a
landed-source causal endpoint. The separate c733 parent was clean.

Fresh endpoint captures used only the five named cameras, the maintained
Chromium goldens harness through browser-lane, muted iPhone 16 Pro portrait,
phone tier/2x, seed357, midday/clear, and explicit Shardfile download. Both
sources have empty errors and settled idle/live for every selected pose.
The source pins were 13253e260911928a9ab65b5ef5aad112d4406626 and
c280532523bd748ce086f80cfd23a57aa3b3100c. No clock override, renderer edit,
extra settle, residency override or comparator allowance was introduced.

Fresh raw/receipts: `tmp/sp-x8-golden-drift/{left-13253,bad-c280}/raw/`.
Retained raw/receipts: `tmp/goldens/2026-11-04-nf18/{parent,raw}/`.
Nine's supplied raw1206x2043 post ROI is x200..255/y1120..1265; the line
is y1232..1248 outside the deck. The labelled images are diagnostic crops
except Pine12's full portrait. Harness hash/settings are retained in
`tmp/sp-x8-golden-drift/harness-binding.json`.

Normal landed a75c3c299d, 793ceb58d8 and a258c2941a builds also exited0,
but no frames were captured from them. The quiet-window start and new
priority stopped this work before those captures; no visual bound is
inferred from build success. All owned builds and the earlier unrelated
SDK related walk had naturally ended by the verified20:47:27Z resource
boundary. All historical preview leases were normally closed.
