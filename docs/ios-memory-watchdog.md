# Simulator native memory budget (E261)

This macOS watchdog exits nonzero when the selected Simulator's WebContent physical
footprint exceeds a budget. It defaults to **4 GiB (4,294,967,296 bytes)**. It samples
the kernel's `proc_pid_rusage` physical footprint and resident size every 250 ms,
outside JavaScript, and writes timestamped JSONL samples plus a final result.

Use a dedicated booted Simulator with Safari and a single test tab. Then run:

```sh
xcrun simctl list devices booted
python3 scripts/ios-memory-watchdog.py \
  --device YOUR_SIMULATOR_UDID \
  --url 'https://wildshard-singleplayer.vercel.app/?chunk=nine-dragon-stack' \
  --budget-gib 4 --duration 120 --out /tmp/nine-memory-run-1.jsonl
```

Enter the shard during the recording window. `--url` is optional; without it, start
the watchdog before navigating/loading. Use a new output filename for each run.
The window begins with the first WebContent sample; it does not assert that the
game reached a playable state. Keep the Simulator visible and complete the tested
flow during that window. For a lower regression threshold, use e.g. `--budget-gib 2`.

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
  footprint. Peak is the maximum observed aggregate footprint.
- This is a **sampled test assertion**, not a 4 GB RAM limit or an iOS jetsam
  emulator. It does not kill processes or modify Simulator/device settings.
  Bursts shorter than the sample interval can escape measurement. Simulator
  allocations, WebKit behavior and GPU memory accounting differ from real iOS;
  GPU-process memory is not included. Physical iPhone jetsam reports remain the
  evidence for actual device termination. A 4 GiB pass is not a safe-phone budget:
  this phone's kernel logged a fatal **ActiveHard 2048 MB** WebContent memory
  limit on 2026-09-28. Its roughly 4.5 GiB termination footprint was an overshoot,
  not an allowance. Start with `--budget-gib 2` for a conservative regression
  assertion, while continuing to verify actual physical-device behavior.

Safe native pass/breach/process-exit regression test (owns only a 64 MiB child):

```sh
python3 scripts/test-ios-memory-watchdog.py
```

The watchdog does not close Safari or shut down the Simulator. Stop/close your own
test session after recording. Keep raw local reports out of version control.
