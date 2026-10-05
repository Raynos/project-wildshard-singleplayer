# SF22a refreshed standalone memory readings

E435, 2026-10-04. Clean pin `6c0aaea4f`, build `6c0aaea-muuepsmd`; sampler `356032992`.

| Variant | Play WebContent MB | Explorer WebContent MB | GL MB | Combined play MB | Margin to 1,000 MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| driftwood-hybrid-off-copies-off | 602.1 | 610.2 | 282.4 | **884.5** | +115.5 |
| driftwood-hybrid-off-copies-on | 518.7 | 525.1 | 282.4 | **801.1** | +198.9 |
| driftwood-hybrid-on-copies-off | 626.9 | 619.2 | 281.8 | **908.7** | +91.3 |
| driftwood-hybrid-on-copies-on | 642.1 | 652.7 | 281.8 | **923.9** | +76.1 |
| pine-trim-off | 569.5 | 567.6 | 622.7 | **1192.2** | -192.2 |
| pine-trim-on | 568.8 | 569.8 | 603.2 | **1172.0** | -172.0 |
| nalati-default | 585.9 | 618.7 | 236.8 | **822.7** | +177.3 |

All seven Simulator collections and all seven desktop probes exited successfully. The Simulator was shut down before the desktop wave; every owned browser and port 4472 preview was closed afterwards.

Protocol: one cold Safari origin/tab per variant, 30 s play and 30 s Explorer; each settled result is the median of three one-second kernel/Web Inspector samples. The desktop Metal GL census uses the same committed pin and device picks after 15 s settling and a 10 s measurement. Totals include textures, full mips, buffers and renderbuffers; GPU-process RSS is recorded separately in raw data. The comparison is Simulator evidence, not a physical-phone pass.

Pine remains **192.2 MB over** the cap with trim OFF and **172.0 MB over** with trim ON. Its GL census drops 622.7 to 603.2 MB (19.5 MB); native play remains about 569 MB.

Driftwood hybrid OFF copies ON reduces native play by 83.4 MB and Explorer by 85.1 MB, with held JS geometry falling about 201 to 123 MB. Hybrid ON also drops those geometry arrays, but native play rises 626.9 to 642.1 MB and Explorer 619.2 to 652.7 MB; Inspector is about 1.08 GB in play and 1.13 GB in Explorer with copies ON. These are one cold run each, not averaged or discarded. **Follow-up:** the [three-cold-run study](../sf22a-repeat-6c0aaea4f/README.md) found legacy play/Explorer reductions of 82.6/84.3 MB and hybrid reductions of 9.7/86.6 MB. Hybrid copies-ON play varies 533.3–624.8 MB; its Explorer readings are consistently 539.4–549.8 MB. The sustained-retention inference from this first wave is not confirmed. The historical readings above remain intact.

This first-wave Driftwood metadata used **the measured default path** (hybrid OFF, copies OFF, island instancing OFF): 602.099 MB WebContent + 282.4 MB GL = 884.499 MB. The unchanged 299 MB engine calibration is dated to build `91f97bdfc` and its original evidence. The current GL total includes 10.9 MB renderbuffers omitted from the old 272 MB metadata figure. No budget or calibration factor increased. The repeat study now supersedes its WebContent number with a 606.097 MB three-cold-run median and recorded spread; the first-wave evidence remains unchanged.

[Full provenance and phase statistics](summary.json) links every variant report and same-pin GL ledger. Each variant folder retains its native and Inspector JSONL, verified plan, phase report and table.
