# G222 / G223: the warning chip and the crossroads ledger

E435 / E452. Browser pin `ae94f0fd1e85aa9e2441463550e18a943ab9594f`, build
`ae94f0f-muysrury`, captured 2026-10-08 UTC (2026-10-07 local). One muted Chromium Metal browser,
iPhone 16 Pro portrait, DPR 2; contexts ran sequentially and were closed, then the preview stopped.
Device `devMode` was seeded with **boolean true** and verified after load. Current Developer catalogue:
Driftwood home, Pine north, Nalati east, Signal Dunes west, Sky Reach south and template-2 northeast;
the other three corners are open plots. This is not the older four-template catalogue.

The grid probe entered through the title tap, waited for loading/reveal and 15 s settlement, then
used a diagnostic pose at the southwest crossroads (-277.5, -277.5) and waited another 15 s.
The pose is an allocator inventory witness, **not a crossing or physics pass**. The Pine warning
proof used a separate standalone context. Both contexts had zero page errors.

Run the committed probe through the browser lane against a clean pinned preview:

```sh
scripts/browser-lane.sh --max 20 node progress/memory/g222-grid-headroom/probe.mjs \
  http://localhost:<port>/ <scratch>/report.json both
```

## Warning and contrast

`b9271675c` makes the Developer memory warning a tappable chip. On Pine it measured 158.44 x
24.14 CSS px. Expand/collapse changed `aria-expanded` false/true/false, restored the compact chip,
and preserved all numbers/provenance. The container has `pointer-events: none`; only the chip
and its expanded details take pointer events. Outside hit testing reached the existing touch layer.
[Collapsed](report-both.json.warning-collapsed.jpg) / [expanded](report-both.json.warning-expanded.jpg).

`ddaf53ee6` fixes the SF38 red text contrast: computed background `#180c10`, red `#ffb5ab`, text
`#fff2ef`. WCAG luminance ratios are **11.33:1 red** and **17.47:1 body**, rather than the earlier
rounded 11.5 claim in its commit prose. [Crossroads](report-both.json.crossroads.jpg).

## Actual charged owners

These are the allocator's SF22a model, not a Simulator WebContent reading. Developer's G216
override admits the full cost: **2,338.100 MB playing / 1,000 MB**, **2,418.100 MB loading**,
**1,764.054 MB accounted**. Home-settled and southwest-settled totals match. Labelled GL was
338.883 / 338.996 MB respectively, fully reconciled, zero unlabelled resources.

| Owner | Accounted MB |
|---|---:|
| Pine | 806.398 |
| Nalati | 491.628 |
| Driftwood home | 341.965 |
| Platform look | 106.507 |
| Highway physics | 6.493 |
| Grid/shared product | 5.910 |
| Sky / Signal / template-2 combined | 5.153 |

Pine's 804.681 MB sim claim and Nalati's 489.910 MB sim claim are frozen, unheld and unneeded at
the southwest pose, each 583.15 m from its cell. They persist after the 567 m cold readiness bound
despite only far views drawing. There are five far views, no L0/L1 views, no pending work or issues.
This is the principal headroom problem; reducing a few far proxies cannot solve it.

Platform accounted bytes are principally open plots 34.311 MB, signs 22.733 MB, deck 22.604 MB,
the preallocated three-screen pool 18.350 MB, junctions 5.630 MB and asphalt 2.845 MB. No invisible
geometry is relabelled as free memory. Far proxies remain needed and charged.

## First landed changes and remaining G208 work

`dc1ce0632` retires frozen regions beyond the cold readiness bound plus a 10 m release band,
before a new product/sim admission. Active or prepared transfers stay protected. A durable failure
keeps the world and full claim, without per-tick save retries; explicit retry or re-approach reopens
the attempt. Scope/world/basis claims retire on success. The native template proof covers a refused
save, a U-turn, HP 55, an open door, a frozen clock, prepared-frame protection and zero allocator
residue after page cleanup. Eight live-grid tests across six suites passed; final direct-prefetch
retirement witness and scoped typed lint passed.

Removing **only those two cold sim claims** projects 1,436.995 MB less playing cost, leaving
**901.104 MB** before any extra basis or product release. This is a calculation from the captured
ledger, not a post-change browser measurement or proof that Pine fits when approached.

`0c9809936` charges the screen's shared plane once (280 bytes) plus only live canvas/mip slots.
Off-range slots and their card images dispose; U-turn reacquires; a refused optional slot allocates
nothing and does not interrupt movement. Twenty screen/road-byte/admission tests and typed lint
passed. The captured pose wants two screens: eliminating its unused third slot saves **6.789 MB
playing**. Where no screens are wanted, all three slots free **20.369 MB** (less the shared plane).

**Still open:** approaching or entering Pine must fit alongside the retained Driftwood home.
Its current whole-runtime claim is 804.681 MB accounted (the older images-first ruler), so cold
unload alone does not make that travel fit. G208 needs a reviewed residual non-streaming cost plus
preflight costs for independently disposable presentation chunks/shared dependencies, charged by
the existing render rings before allocation. Cached models/materials still retained by global asset
caches must remain charged; no whole-claim discount is valid before ownership and measurements
cover them. The coordinator pairs the renderer builder with this lane for that step.

[Raw report](report-both.json) retains the exact claims, readiness, GL resources and warning states;
[summary](ledger-summary.json) records the calculation inputs. All three retained images are below
500 KB. No cap, assertion or measured default-home metadata changed.
