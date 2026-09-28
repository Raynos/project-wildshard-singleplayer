# Simulator native memory budget (E261)

This macOS watchdog exits nonzero when the selected Simulator's WebContent physical
footprint exceeds a budget. Single-budget mode defaults to **4 GiB (4,294,967,296 bytes)**. It samples
the kernel's `proc_pid_rusage` physical footprint and resident size every 100 ms,
outside JavaScript, and writes timestamped JSONL samples plus a final result.

**Scope: the enforced budget is WebContent native physical footprint. It is not an
app-wide RAM or VRAM ceiling.** The same Simulator's separate WebKit GPU process is
reported separately (footprint, RSS, lifetime/interval highs), without adding shared
or unified memory to WebContent and double-counting it. GPU usage is not budgeted.

Use a dedicated booted Simulator with Safari and a single test tab. Then run:

```sh
xcrun simctl list devices booted
python3 scripts/ios-memory-watchdog.py \
  --device YOUR_SIMULATOR_UDID \
  --url 'https://wildshard-singleplayer.vercel.app/?chunk=nine-dragon-stack' \
  --budget-gib 4 --duration 120 --out /tmp/nine-memory-run-1.jsonl
```

The current requested game caps are **1.8 decimal GB while loading and 1.0 decimal
GB in World Explorer**, not GiB. To enforce both in one run:

```sh
python3 scripts/ios-memory-watchdog.py \
  --device YOUR_SIMULATOR_UDID --world-phase-file /tmp/nine-world-run-2 \
  --duration 120 --out /tmp/nine-memory-run-2.jsonl
# In the test driver, when World Explorer is entered:
touch /tmp/nine-world-run-2
```

Use a fresh marker path. The driver must mark the transition promptly, not after
waiting for memory to settle. A stale marker is rejected; a run that never enters
the world phase cannot pass. The report includes each sample's phase and exact byte
budget plus separate phase peaks. This external signal does not infer readiness
from elapsed time. Single-phase checks can use `--budget-gb 1.8` (loading) or
`--budget-gb 1` (World Explorer); these decimal options cannot be combined with
`--budget-gib` or the two-phase option.

Enter the shard during the recording window. `--url` is optional; without it, start
the watchdog before navigating/loading. Use a new output filename for each run.
The window begins with the first WebContent sample; it does not assert that the
game reached a playable state. Keep the Simulator visible and complete the tested
flow during that window. Alongside samples, the watchdog reads the kernel's native
interval and lifetime high-water counters (`RUSAGE_INFO_V4`). A released burst
between samples still fails if the interval high crosses the budget. If a process
dies before that counter can be read, its disappearance fails the run instead.

- Default scope is **the sum of all WebContent processes in that Simulator**, so
  another tab or prewarmed process is included. It never measures desktop Safari
  or the USB-connected iPhone. `--pid NUMBER` narrows the scope to one WebContent
  PID, validated against the chosen Simulator's process ancestry.
- Every sampled PID includes its native start identity and executable. Any
  previously seen process disappearing or restarting fails the run, even if its
  replacement is small. Expected prewarm retirement or deliberate navigation can
  therefore fail conservatively; inspect the recorded identities before retrying.
- Zero matching processes, denied sampling, Simulator shutdown, and interruption
  cannot produce a pass. Exit codes: `0` completed within budget; `1` exceeded
  budget or lost a tracked process; `2` setup/sampling error; `130` interrupted.
- The report records **physical footprint** separately from **RSS**. The budget
  applies to footprint, not JS heap, virtual address space, or a sum of RSS and
  footprint. Sampled aggregate peak and sum of per-process interval highs are
  separate fields: those per-process peaks need not occur simultaneously, so the
  sum is a conservative upper bound. `--pid` gives one process's native high.
- At monitoring start and the world-phase transition, the watchdog resets only
  the selected WebContent processes' native interval accounting counters using
  `proc_rlimit_control(..., RLIMIT_FOOTPRINT_INTERVAL, FOOTPRINT_INTERVAL_RESET)`.
  Lifetime peaks remain intact and are always recorded. A pre-reset sample and
  the reset are logged. Only run one high-water watchdog per target process;
  overlapping watchdogs would reset each other's intervals. Sampling/reset failure
  refuses to pass. There is a narrow read/reset boundary, so this is not an atomic
  application-phase trace. [Apple XNU implementation](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_resource.c).
- This is a **native-accounting test assertion**, not a 4 GB RAM limit or an iOS jetsam
  emulator. It does not kill processes or modify Simulator/device settings.
  allocations, WebKit behavior and GPU memory accounting differ from real iOS;
  GPU-process memory is reported separately. Physical iPhone jetsam reports remain the
  evidence for actual device termination. A 4 GiB pass is not a safe-phone budget:
  this phone's kernel logged a fatal **ActiveHard 2048 MB** WebContent memory
  limit on 2026-09-28. Its roughly 4.5 GiB termination footprint was an overshoot,
  not an allowance. Start with `--budget-gib 2` for a conservative regression
  assertion, while continuing to verify actual physical-device behavior.

Safe native pass/breach/process-exit regression test (owns only a 64 MiB child).
It explicitly frees the allocation before reading again and verifies that the
kernel high-water counter still fails the budget, then verifies interval reset:

```sh
python3 scripts/test-ios-memory-watchdog.py
```

The watchdog does not close Safari or shut down the Simulator. Stop/close your own
test session after recording. Keep raw local reports out of version control.

## Actual Simulator game checks, 2026-09-28

These were actual Nine Dragon loads into visible World Explorer in the local
`wildshard-iphone` iPhone 17 Pro Simulator, iOS 26.5, with no USB device involved.
The last cold run's inspected build was `e5e8b8e-muloh54x`. `WEBGL_multi_draw` was
supported and `facade-large-batch` was present: this exercised the batched facade.
The renderer reported Apple GPU / Apple Inc., DPR 2, drawing buffer 804 × 1428,
antialias off, and power preference default. World Explorer visibly rendered
around 30 fps. Physical iOS was 26.6.2, so this is not an identical OS/driver test.

| Actual run | Window | Sampled WebContent peak, GB | Native interval high, GB | Separate GPU lifetime high, GB |
| --- | --- | --- | --- | --- |
| Nine reload, one page PID | 40 s | 0.493 | 0.513 | not recorded by this run |
| Nine cold Simulator/process restart, all WebContent | 40 s | 0.816 | 0.819 | 0.256 |
| Nine second cold Simulator/process restart, all WebContent | 40 s | 0.765 | 0.800 | 0.256 |

GB here is decimal. The cold runs include a roughly 0.043 GB prewarmed WebContent
process; the game's own lifetime highs were respectively **0.776 GB and 0.757 GB**.
Both cold runs passed a stricter 1.0 GB WebContent budget over the entire load and
rendered-world window. The earlier 120 s Nine run sampled 0.849 GB aggregate peak;
a separate 30 s world-only page measurement peaked at 0.641 GB. A Driftwood run
sampled 0.781 GB over load and approximately 0.494 GB settled in World Explorer.
These are smoke measurements, not exhaustive shard/movement/stress baselines.

**The physical phone's multi-gigabyte failure was not reproduced in these Simulator
runs.** The native high-water counters establish that this was not merely a fast
spike hidden between samples. Passing here does not demonstrate a physical-device
fix or prove a 1 GB app-wide/VRAM limit. Raw local recordings are
`/tmp/e261-nine-kernel-peak-cycle1.jsonl`, `/tmp/e261-nine-kernel-cold2.jsonl`, and
`/tmp/e261-nine-kernel-cold3.jsonl`. The owned Simulator and its Inspector were
closed after the runs.

Chrome availability check: `simctl listapps` found no Chrome/Chromium in this
Simulator, and no Chrome.app/Chromium.app was found under the machine's CoreSimulator
device bundles. The [official Chromium iOS build instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/ios/build_instructions.md)
support compiling a Simulator-specific `Chromium.app` (`fetch ios`, then the
`Debug-iphonesimulator` build). That is a source build, not an installed Google
Chrome app here; its checkout alone is documented as 30 minutes on a fast connection
or hours on a slow one. No Chrome Simulator run was performed or claimed.
