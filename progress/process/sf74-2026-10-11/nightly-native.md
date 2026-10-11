# Nightly native coverage receipt

Coverage now sends Nalati's taming/worker proof, Signal's native runtime
and the seven-shard type graph to the serial integration phase after
the parallel pool drains. Ordinary push/local scheduling is unchanged.
Vitest's own CLI parser distinguishes enabled coverage from disabled
flags and provider-only settings; all 17 lane/parser fixtures pass.

Signal's checkpoints 700, 2600 and 4100 now have one test each. Every
fresh host, warmup, string round trip, 900-tick paired continuation and
exact snapshot/adapter assertion remains. The original 20/60-second
deadlines and 10-second inventory hook deadline are unchanged.

After the explicit BOTH-surface release and an immediate quiet-absent
check, the five-file V8-covered proof passes all 41 tests in 95 seconds
under `nice -n 10`. It ran from 21:47:23 to 21:48:58 UTC alongside the
authorized preview build/push gap. This is a local timing receipt,
not a controlled before/after speed comparison.

Against the earlier 41-test covered run, every engine file retains its
covered line, statement, function and branch counts except the concurrently
edited compressedUpload module, whose covered lines/statements rise 2 to 3.

| Complete covered test | Time | Existing deadline |
|---|---:|---:|
| Nalati real five-round bond and restored continuation | 14.874 s | 60 s |
| Nalati actual worker checkpoint/command suffix | 13.082 s | 60 s |
| Seven real shards, type-aware coupling | 18.732 s | 60 s |
| Signal real 10k native tape | 4.849 s | 20 s |
| Signal checkpoint 700 | 1.270 s | 20 s |
| Signal checkpoint 2600 | 2.038 s | 20 s |
| Signal checkpoint 4100 | 2.709 s | 20 s |

The 79-second run overlapped a Simulator quiet window and receives no
timing credit. This receipt uses only the subsequent released run,
`20261011T164723-sp-x7-w12-native-clean-37487` in `.git/proofs/`.
Root strict and touched typed lint pass; Linux milestone coverage and
its merged ratchet still need exact-SHA requalification after pushing.

Reproduce with `pnpm exec vitest run --coverage`, JSON test and
json-summary coverage reporters, and the five files: authoring-docs,
author-proof-bundle, shard-coupling, Nalati headless-taming and Signal
headless-runtime. Keep the full runtime/compiler assertions.
