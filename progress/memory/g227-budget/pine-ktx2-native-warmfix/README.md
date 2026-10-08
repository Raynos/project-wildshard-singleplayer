# Pine KTX2 source memo: isolated native comparison (E435 / G227)

**Credit: 1,569,440 deterministic GL bytes. Native WebContent saving: none credited.**
Three alternating valid cold Safari boots per side, zero failed attempts on either
side; every route reaches Pine interior and centre with game errors `[]`, and
all owned Safari / Inspector / sampler / proxy resources close. The Simulator
was released to sp-x4 before receipt packing. Simulator-relative evidence does
not establish a physical-iPhone cap pass.

Baseline `71f385a525bf9d54f4b55ee58df04ee68c3e1e2d` is historical cdad59776 plus
only the separately proved injected-array warm-up fix. Candidate
`b87c6afd23ba35dbd47c4799a4becf2722ca6c6e` has that exact parent and only the
two source memo runtime files. `memo-vs-warmfix.patch` preserves that difference;
these diagnostic commits are unreferenced and never move main. HTTP version,
disk bytes, registered PID and listener group were checked before sampling.

Both arms: phone tier, 2×, Developer ON, Memory saver ON, volume zero, seed 357,
same existing grid defaults. The shared `native.mjs` pine-centre route resets
Safari storage, samples home, Pine entry and centre, and follows the exact
WebContent PID after home. Each pose takes three independent fresh kernel
samples. No heap snapshot or explicit GC; optional passive diagnostics disabled.
The exact common harness hashes are in `summary.json`, checked before every
boot. During the final run, another lane saved additive native.mjs changes after
that Node process loaded the module; they do not alter the already loaded code.
The exact loaded native.mjs is preserved, hash-checked against committed HEAD.
Raw census reports, native ledgers and attempt/sampler logs are gzip copies.

| Cold run | WebContent MB | GL MB | Combined MB |
|---|---:|---:|---:|
| baseline 1 | 941.150240 | 229.943160 | 1171.093400 |
| memo 1 | 993.513576 | 228.373720 | 1221.887296 |
| baseline 2 | 848.236600 | 229.943160 | 1078.179760 |
| memo 2 | 909.332560 | 228.373720 | 1137.706280 |
| baseline 3 | 898.846824 | 229.943160 | 1128.789984 |
| memo 3 | 910.069768 | 228.373720 | 1138.443488 |

Combined medians: baseline **1128.789984 MB**, memo **1138.443488 MB** (candidate
+9.653504 MB). Ranges overlap: baseline 1078.179760–1171.093400 MB, memo
1137.706280–1221.887296 MB. Cold-process/allocator variation exceeds the GL
cut, so neither the median difference nor pair differences establish a native
saving or a native regression. Failure counts: baseline 0/3, candidate 0/3;
this small cohort is not a reliability guarantee.

GL is exact in every run: 229,943,160 baseline bytes versus 228,373,720 candidate
bytes. The actual Mac centre census separately identifies the four removed
duplicate rock/wood allocations, and the real compressed-file lifetime/readback
fixture has 14 byte-identical frames. See
`../pine-centre-0e6d69988/ktx2-centre-allocation.json` and
`../pine-centre-0e6d69988/ktx2-source-parity.json.gz`.

## Handoff (sp-x5)

The source reuse is validated for pixels, lifetime and deterministic GL storage.
It does not solve Pine's over-cap native footprint. No native resources remain;
sp-x4 owns the next Simulator slice. Larger render target / sky / atlas changes
need the rendering owner and their own pixel or taste proof.
