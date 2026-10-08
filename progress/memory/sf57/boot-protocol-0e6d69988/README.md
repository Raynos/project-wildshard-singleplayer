# SF57 rejected boot rehearsal — 0e6d69988

The corrected Developer cell rehearsal failed before any route or measurement baseline. It does not count as the five-minute dry run, the thirty-minute soak, or a memory-cap proof.

Runtime pin: 0e6d69988. Harness pin: 2fdf4d41c (loaded before the later grader commit). Borrowed preview: port 4405, owned by sp-x5. Only its explicitly authorized data-g227-fixture block was removed; the original is retained here. The shared preview remains alive.

Command: node scripts/soak/soak.mjs --prepared=<manifest.json> --borrowed-preview, followed by GO. One Simulator/Inspector. No game errors were recorded. The failure was the premeasurement WebKit process transition: 'Runtime' domain was not found. Cleanup waited for a leak callback before the game API existed, then timed out; no leak-zero claim is made. All owned Safari, Inspector, proxy and sampler resources closed; sim-lane reported 0/1 booted.

The independent native sampler ran 74.4 seconds, including 60 fresh unload-phase samples, with no lost process. It did not reproduce the other lane's sampler stopping at 31 seconds. There were 14 loading samples; the partial loading WC+GL high was 513,375,636 bytes, with zero missing GL joins. Boot never completed, so this is neither a complete cold peak nor an accepted capacity result. No drive, eviction or listener-delta evidence was obtained.

Brotli archives preserve the original receipt, native and GL samples, mutation journal, manifest and removed diagnostic fixture. checksums.json gives each decompressed byte count and SHA-256; every archive was decompressed and verified. Scratch originals remain until the corrected rehearsal is prepared separately.
