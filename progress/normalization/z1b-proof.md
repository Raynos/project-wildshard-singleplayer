# E357 Z1 follow-up — sol-z1b, 2026-10-01

The template starts above its sampled collision floor. The dedicated gate now asserts real phone touch movement, look, dodge and use. Optional authored combat `Step.settleFrames` defaults to zero; only the template gate opts into 30 frames, before target-relative aiming.

Runtime proof candidate: `e11049109f5a63c296a548490e5f4657c560881e`, parent `c598fab85471ff5eccb970edd4f13b3f6bdc3514`. Harness preservation candidate: `dcbe204a33eca12fb13dcc2d52e633547f960fdb`. The landing projects the three code hunks onto current HEAD and preserves its ask blob plus this builder's section.

## Report classification

CI gpu-gate run 36905741385, `/private/tmp/e357-z1b/ci-report/report.md`, has exactly one red field: `walk.touch`. `boot.registry`, boot errors, structural counts and unload census are green. The analytic trail lies below the sampled collision floor; without explicit spawn y, the embedded player stays sliding and movement/dodge are blocked. This is a template bug; y=1 fixes it.

Generic `walk.legs={}`, combat `n/a`, poses and budgets `{}` reflect absent generic fifth-shard fixtures, not red rows. The dedicated Z1 gate supplies the hut route and blob fight. No generic rule was loosened.

`Player.spawn` retains dashT: a successful touch dodge survives a following teleport, moving the player after combat aim is sampled. This is a harness ordering assumption. Settle before aim only in the authored template scenario. Engine follow-up for the lead: assess dash retention separately, because clearing it changes respawn-during-dodge behavior.

## Verification

- `node scripts/parity.mjs --export=e11049109f5a63c296a548490e5f4657c560881e --lane=m5 --shards=_template --tiers=phone --record --runs=3 --jobs=3 --out=/private/tmp/e357-z1b/template4`: aggregate green, no red fields. Each run moved 8.500821728356668 m, yaw -1.1065470956695471, dodged/used true, boot errors [], unload census exact. Initial-record new/info rows remain visible.
- Dedicated gate `/private/tmp/e357-z1b/contract4.log`, `template-contract/gate.json`: touch all passes; hut stuck=0; blob four whip hits, dead in 2.533333333333325 s; disposal errors []; census exact. Scratch `node contract.mjs <candidate>` builds/serves the clean export and invokes `scripts/test-template-gate.mjs`, closing preview/browser in finally.
- Four-real phone boot `/private/tmp/e357-z1b/boot4/`, `--shards=all --only=fingerprint+poses`: boot errors [] and three poses each, 12 real-shard shots. Isolated spawn parent/candidate structural fingerprints match exactly (`four-fingerprints.json`, `real-before` / `real-after`); only build/browser identifiers and measured timings/heap are excluded.
- Original versus changed harness on the SAME dcbe204a exported runtime, four-real phone `--only=walk+combat+leak`: `harness-before` versus `gameplay-final`, 61,087 fields, zero differences. Includes sound multisets, all route trace rows, touch values, combat timing/hits/loot and leak census/disposal/scope. Route-seconds summation is rounded to 1 ns. Leak diagnostic stack URLs and retained/GPU object UUID lists are omitted; parity already skips these diagnostic fields. No sounds or gameplay fields are omitted. Counts: Driftwood 9,844; Pine 19,352; Nalati 21,153; Nine Dragon 10,738.
- Cross-build Nine Dragon captures consistently record footstep:rock 3 before versus 4 after; same-runtime original/changed harness both record 4. This is disclosed separately from harness equivalence. Other cross-build gameplay/census values match, apart from sub-picosecond informational route seconds. No baseline or comparison mask changed.
- Full clean-export gate passed dcbe204a (`gate3.log`). A simultaneous e1104910 gate hit load-sensitive timing failures while eight capture browsers ran: navmesh mean 0.338 ms versus 0.3 ms, ragdoll 5 s timeout, fixture subprocess failures. No test or limit changed. The final candidate is gated again after template jobs close (`gate-final.log`) and boots before landing (`boot-land/`).

## Remaining work

The universal touch-leg wait changed real-shard sounds and Nalati combat and was discarded. A node spawn test also passed against the broken old spawn, so it was discarded. `scripts/parity/walk.mjs` stays identical to HEAD.

Lead pushes with `scripts/push-main.sh`, obtains the first green macos-15 bootstrap plus dedicated template contract, and commits its runner baseline artifact. Local M5 proof does not claim CI green. Follow-up: Player.spawn dash retention. No design guesses remain; spawn y=1 and template settle=30 were explicitly authorized.
