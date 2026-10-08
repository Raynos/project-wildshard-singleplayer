# Boot and residency confirmation (playtest round 2, E435)

Source fixes: `f1a25194e` (cold dwell / wider release band), `fbd3ed935` (owned-home boot invariant), `970e00029` (approached destination allocation), with the current input ledger at consumer pin `163516ec7`. This confirmation uses existing closed browser evidence and two single-file native checks while the coordinator's frame floor runs; no new browser, build, Simulator or full gate.

## Load only near cells

The owned-home path of `LiveGridHost.prefetch()` only admits immutable products/modules. `beforeFixed()` may construct a destination only on the neutral road, with no resident source world, for the nearest approached cell within `6 + capsule radius + 0.5 + speed / 60` metres of its geometric edge. This does not move the motor's 6/10 m commit bands. Explicit crossing `prepare()` uses the same exclusive-runtime guard: checkpoint, road commit, leave/dispose source, then allocate destination. Failed durability or disposal retains the source and its full charge.

`pnpm exec vitest run test/live-grid-owned-home.test.ts`: prefetch every neighbour (including Pine/Nalati) before the first home allocation creates **zero** regional worlds. Only the existing home preclaim and permanent highway sim claim exist. After entering home and running **2,400 fixed ticks / 40 seconds**, only home has been constructed; neighbours have **zero** sim/basis claims. Product/module requests may exist and are not presented as free runtime worlds. The real capsule approach fixture then creates **Pine only**, while still on the road; Nalati has no sim claim.

The closed phone ledger agrees: settled boot **905.23 MB**, resident `[driftwood-isle]`; Pine entry/centre `[pine-hollow]`; Nalati entry/centre `[nalati-grasslands]`. Each source sim and basis retires before its successor. The two cross-cell traces have exactly their expected source → road → destination commits; no resident overlap is reported at any captured pose. `life` contains a frozen template proxy presentation: it is not a second authoritative regional runtime. The browser ledger begins after settled home rather than on the literal first frame; the first-allocation invariant is established by the native fixture.

## Hysteresis without churn

Automatic cold retirement has a **larger unload radius than load radius**, followed by **five continuous seconds / 300 fixed ticks** outside that radius. At 30 m/s in the native witness, load is **433.5 m** from the cell edge and release is **583.5 m** (150 m additional margin). Retreat resets the dwell. Active frames, pending frame reservations and failed disposal remain protected; quota refusal preserves the complete world/basis and attempts once per excursion until explicit retry or retreat.

`pnpm exec vitest run test/live-grid-ring-residency.test.ts`: **40 seconds** alternating 430/455 m around the load band produces **one allocation**, with the inactive sim tick frozen. A three-second distant excursion followed by retreat does not complete a later dwell early. A quota-refused unload attempts **once**, keeps both sim/basis claims, and explicit retry retires them. U-turn reload restores **HP 55, open door, flags and tick 60**; a prepared frame cannot be retired. Three total loads include the initial allocation and two deliberate returns. Final allocator cleanup is empty.

The borrowed/data native fixture proves the automatic cold policy; opaque owned runtimes intentionally retire immediately at their committed road departure under G226, rather than waiting five seconds and overlapping another opaque runtime. The browser trace confirms that distinct contract. It is not a dedicated 40-second boundary-oscillation browser test.

## Verdict

The former boot overlap and 2–3-second cold-band churn are fixed under the above native invariants and consistent with the current ledger. This does **not** make the memory cap pass: entered Pine centre remains **1,075.91 MB**, Nalati **1,064.19 MB** under Developer override, with one runtime each. Strict admission still refuses those totals; G227 tiles own the remaining overage. There is no cap rise, visibility discount or unproved claim release.
