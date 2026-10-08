# G226 reviewed runtime cost refresh (SF22a, E435)

Pine uses the **8e82ae91f** cold Auto/KTX2, trim-ON study, matching the grid default: three cold-run settled play medians, median **648.990416 MB WebContent**, plus same-pin, same-phase labelled GL **205.941312 MB**. The old images-first reading stays in its separate leaf so G188 still chooses compressed textures before cold boot. Standalone trim OFF was not measured by that study.

The game subtracts the dated 299 MB engine calibration and undoes 1.11 exactly once: **500,839,395 accounted bytes**. With the allocator's 300 MB base and 80 MB overlap, Pine models at **935,931,729 bytes**, leaving **64,068,271 bytes before platform / neighbours**. This is not a grid-fit verdict. The original full-coverage combined transient upper bound **960.832454 MB** is retained; adding the model's 81 MB base/overlap difference to that peak would exceed 1 GB. The settled model is not a guarantee against every transient.

Nalati retains **606 MB WebContent + 236.8 MB GL** from **91f97bdfc**, with textures / buffers / renderbuffers 122.5 / 73.2 / 41.1 MB. Its old single-cold-run provenance is explicit: **489,909,910 accounted bytes**, modeled **923,800,001 bytes**, margin **76,199,999 bytes before platform / neighbours**. No substitution of the later, lower 585.911848 MB single-run reading and no claim of a fresh regional measurement.

[Machine-readable arithmetic](summary.json), [Pine cold study](../sf22a-pine-g187-8e82ae91f/README.md) and [Nalati original evidence](../sf22a-2026-10-04.json). Simulator native plus desktop phone-tier GL is a relative proxy, not a physical-iPhone cap proof. Platform claims and source-disposal success still decide whether G226 fits.
