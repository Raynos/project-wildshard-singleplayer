# SF22a Driftwood cold-repeat study

E435, 2026-10-04. Clean pin `6c0aaea4f`, build `6c0aaea-muuh09s9`; sampler `356032992`. Three independent cold Safari runs for each variant. Island instancing is OFF throughout.

| Variant | Play native median [min–max] MB | Explorer native median [min–max] MB | Combined play median MB | Margin to 1,000 MB |
| --- | ---: | ---: | ---: | ---: |
| legacy-copies-off | 606.1 [603.7–628.3] | 613.8 [610.1–628.1] | **888.5** | +111.5 |
| legacy-copies-on | 523.5 [519.0–526.6] | 529.5 [526.7–532.2] | **805.9** | +194.1 |
| hybrid-copies-off | 625.3 [622.1–630.1] | 628.8 [626.9–632.4] | **907.1** | +92.9 |
| hybrid-copies-on | 615.6 [533.3–624.8] | 542.2 [539.4–549.8] | **897.4** | +102.6 |

| Variant | Play Inspector median [min–max] MB | Explorer Inspector median [min–max] MB |
| --- | ---: | ---: |
| legacy-copies-off | 861.2 [861.2–863.3] | 849.8 [841.0–860.2] |
| legacy-copies-on | 758.0 [753.6–777.9] | 747.6 [738.6–763.6] |
| hybrid-copies-off | 864.3 [861.5–1078.6] | 838.6 [837.3–846.5] |
| hybrid-copies-on | 1091.3 [744.7–1095.9] | 762.7 [762.4–764.1] |

**Legacy copies ON:** play median falls 82.6 MB and Explorer 84.3 MB. The native cold-run ranges do not overlap.

**Hybrid copies ON:** play median falls only 9.7 MB, with a wide 533.3–624.8 MB range that overlaps OFF. Two runs remain high during play and fall about 74–75 MB by Explorer. Explorer drops 86.6 MB, with a narrow 539.4–549.8 MB range below every OFF run. Retained JS geometry falls about 201 to 123 MB in every run on both paths. The earlier single-cold claim of sustained hybrid retention is **not confirmed**; the play release timing remains variable. This study does not identify a retainer or prove that release occurs by a particular play deadline.

[The desktop/WebKit investigation](../../shard-platform/mem-trim/webkit-f3de4c716-phone.json) at `8db2edd7d` found matching V8 retained-object groups and copies release on both paths. Its different build/browser/protocol is supporting evidence, not pooled into these Simulator medians.

Protocol: sequential grouped variants (not randomized), each cold Safari restart followed by service-worker/cache/local-storage reset, exact build and device Debug picks verified, 30 s play and 30 s Explorer. Each phase uses three one-second native/Inspector samples. The table reports the median and min/max of the **three independent cold-run phase medians**, not nine pooled samples. All twelve runs are retained; no outlier removal. All four sampler reports exit successfully and all 36 native phase peak checks pass.

Combined totals reuse the [same-pin labelled GL ledgers](../sf22a-refresh-6c0aaea4f/summary.json): 282.4 MB legacy and 281.8 MB hybrid. No desktop probe overlapped these Simulator runs. All twelve combined play and Explorer readings remain below 1,000 MB. This is relative Simulator/WebKit evidence, **not a physical-iPhone cap pass**.

Default runtimeCost now uses the repeat play median rounded to **606.097 MB WebContent + 282.4 MB matching GL**, with the 603.721–628.281 MB cold range linked as provenance. The 299 MB engine calibration remains dated and unchanged. The shared helper charges **531,078,379 bytes** once; modeled playing cost including existing base/overlap is **969,497,001 bytes**. The platform road still refuses before deck allocation under that envelope; no budget, factor or Debug default increased.

[Full provenance, all raw run values and settled samples](summary.json). Variant folders retain native/Inspector JSONL, verified plan, report and per-run table. The Simulator is shut down and preview port 4472 stopped.
