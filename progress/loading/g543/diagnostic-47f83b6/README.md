# Diagnostic loading receipt: Phase 1 remains open

Served committed SHA: `47f83b6acab324b1ab5e05cb7e3b98d896dfa326`.

| Surface | Path | Wall / stages (s) | Network / display (MB) | Byte error | Longest detail gap (ms) | Result |
|---|---|---|---|---|---|---|
| simulator | shardfile | 14.4 / 14.471 | 184.54 / 178.17 | 3.45% | 943.0 | pass |
| simulator | grid | 14.9 / 14.915 | 183.24 / 174.89 | 4.55% | 731.0 | pass |
| phone | shardfile | 25 / 25.086 | 173.54 / 173.52 | 0.01% | 917.6 | pass |
| phone | grid | 32.7 / 32.698 | 171.78 / 171.73 | 0.03% | 1073.3 | Detailed update gap exceeds 1 s |
| desktop | shardfile | 10.4 / 10.370 | 181.16 / 181.16 | 0.00% | 192.2 | pass |
| desktop | grid | 11.1 / 11.081 | 180.46 / 180.47 | 0.00% | 417.4 | pass |

Phone Chromium uses iPhone 16 Pro emulation and CPU 4x; desktop uses native CPU.
Safari runs on the iPhone 16 Pro Simulator through sim-lane. Every browser is muted.
Network bytes come from the independent HTTP observer, including service-worker traffic.
Detail cadence excludes duration clocks. JSON retains dependency text, stage totals and counter samples.

Five entries pass. Phone grid's 1073.3 ms detail gap fails the one-second gate.
Source-mapped follow-up attributes the remaining gap to custom-schema compilation;
760a8c9846 adds a paint boundary between complete checks. The newer source also
replays early worker receipts (55b310a603), reports actual-unit bar progress
(09bdb72199), and reports selected audio decodes (21a07a76d5). Acceptance needs
a new served committed-SHA proof including those changes.
