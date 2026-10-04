# SF57 — memory soak (G154, E435 / E445)

The coordinator grants a quiet window before the two real 30-minute Simulator runs. Prepare pinned clean builds first:

```sh
node scripts/soak/soak.mjs --prepare --rev=<pushed-sha> --out=<own-scratch-directory>
```

Keep that parent alive. Once it prints `PREPARED`, request the quiet window. After the coordinator says go, create the
printed `GO` file. The parent runs shipped and full dev layouts serially through `scripts/sim-lane.sh`, then closes its
two previews, owned Inspector proxy, sampler and Simulator.
Each layout uses a fresh named iPhone 17 Pro device on the same iOS runtime, one at a time, so Safari tab restoration
from the preceding layout cannot contaminate its baseline. `--prepared=<manifest.json>` can reuse existing pinned
previews after a preparation-parent restart; it never rebuilds or resumes a partly measured document.

The Safari helper changes only the entry HTML: independent leak counters, live harness pins, phone tier, automatic
cadence, 2× scale, the one-frame Debug row ON, and the existing one-shot grid/title intent. Developer stays OFF for the
shipped catalogue; Developer and the DEVSERVER build select the full dev catalogue. The hidden shipped menu is unchanged.
One initial pose places the player safely on the road. Every subsequent metre uses the actual controller: hover on the
road, walking into midpoint entries. No reload, manual eviction, forced GC, budget override or far-proxy admission.

The route attempts every catalogue cell and traverses all 16 crossroads repeatedly for 1,800 seconds. It records actual
regional admissions, production resident removals, soft-wall refusals, complete circuits and errors. Each complete
circuit rests 20 seconds at the same reference road pose: the last ten seconds form its baseline window. Comparisons
allow ±30 decimal MB against loop two, for both peaks and troughs; loop one warms the process. The JSONL retains every one-second kernel `phys_footprint`
reading, individual WebContent PIDs, interval high-water marks and the separate GPU process. A pre-context GL hook
records labelled live texture, renderbuffer and buffer allocations every second in a separate GL JSONL. The gate adds
WebContent and GL (GPU-process footprint is informational): playing ≤1.0 decimal GB, loading ≤1.8 GB. Missing,
unlabelled or unreconciled GL readings refuse a pass. At each settled stop, `(measured − 300 MB engineBase) / accounted`
must be ≤1.11; raw `measured / accounted` and the ×1.4 phone estimate are informational. It requires repeated natural
eviction circuits, continuous samples and the final same-document full unload with every nested leak-census counter zero.

The pinned 07209c626 run is a **rehearsal**, regardless of memory readings: the SF57 gate only counts after
SF46/47/48-g (and dev SF49/50-g) are prepared. Runtime cells refused by M3 remain explicit. A bounded memory run with refused cells cannot close the gate: rerun after
SF46–48 make them admissible. Simulator readings satisfy this Simulator gate; they are not physical-iPhone measurements.
SF57b builds default-off fade-reload at shard exits regardless of this rehearsal verdict. Retention attribution needs
heap, WASM and GL evidence; a refusal, missing reading or route/disposal error does not establish retained memory.
