# Pine travel: loading-card invalidation (E435)

**FAIL: this fix does not close the Simulator travel gate.** Plain matched cold runs measured 57 ms p95 before and after. The Simulator whole-drive row was 35 → 36 ms (limit 35); max was 136 → 133 ms (limit 200). Both interiors were 34 ms. Candidate desktop passes: travel/whole-drive p95 16.8 ms, max 50 ms (limits 17.5/100).

Source baseline `a9bdd506008a76fda881dc9a46c9dd4716783fed`; isolated candidate `e86b2c689b06448e8ba46d3aa5ad8c2ddaeac210` contains only landed `0223e2fc1`. Tree and patch hashes are in [summary.json](summary.json). Same Pine-only route, Developer/DEVSERVER, pacing ON, Auto, unchanged 2× scale, muted. No GL observer or CPU profiler in timing runs. Quiet UTC 14:36:44–14:43:26; push priority and 120 s gap observed. All three runs completed, exact Pine residency/ownership passed, zero errors. All owned proof resources closed before quiet release.

The separate attribution run showed repeated 1024×640 loading-card uploads while unpainted clock/RAM facts changed. `0223e2fc1` keys the near layout by exactly the facts it paints; full-layout clocks and visible progress still repaint. Focused fixtures preserve text, progress, disposal and the full layout. This removes wasted work, with **no native timing saving credited**.

Remaining attribution: world-stage shader status waits are sp-x2's path. The play-stage long frames have negligible timed GL, with sampled ScriptHost instantiation and NPC rig construction. Safari sample timestamps were zero, so sample counts do not assign milliseconds or prove a particular allocation caused a frame. Raw profiles stay in scratch; the summary retains scalar hook/GL findings. The earlier full milestone remains FAIL; this is no physical-device or memory-cap proof.
