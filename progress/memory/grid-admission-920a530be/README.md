# G112 / G144: metered Infinite admission

Source pin `920a530be`, build `920a530-muyhnpnz`, 2026-10-07. This is the admission model backed by the measured default Driftwood metadata, not a new physical-device memory reading.

| Catalogue | Settled playing MB | After round trip MB | Remaining playing MB | Platform JS + GPU MB |
| --- | ---: | ---: | ---: | ---: |
| Developer | 843.863697 | 865.367270 | 134.632730 | 53.707412 |
| Shipped | 872.734715 | 895.588993 | 104.411007 | 41.802592 |

One fresh Chromium/Metal iPhone 16 Pro portrait context per case; phone tier, 2x render scale, muted. The Debug device pick `gridMemoryAdmission=on` was verified after load. Each entered through the real title tap. The shipped catalogue is tested by turning Developer OFF before the next document imports; the shipped menu gate is unchanged. Service workers were blocked for the clean pinned local build.

The home entry is exactly `sim:driftwood-isle` = 341,781,982 bytes, with two references (boot and live registry), charged once. All six platform render claims, the highway, far proxies, products, admitted regional sim/basis and ring tiles appear in `report.json`. Eight far proxies settle in each layout; rings report zero refused tiles and no outstanding requests. The shipped layout also admits the two neighbouring template regions before movement, then template-4 on approach. No capacity refusal occurred on this route.

The original 15 m/s physics harness drives Driftwood → highway → template-4 → highway → Driftwood: four transfers in each case, zero stuck, no route issues, no page errors. Reveal ends at the actual path end (7.0213 / 7.0226 s), with both readiness signals present and no ceiling fallback. The raw console retains one generic resource 404 per case (resource identity was not captured); this is not reported as a clean network census.

M3 waits remain behind soft walls and far proxies: Developer Sunscar Dunes, Nalati and Far Reach; shipped Nalati. These are unsupported runtime admissions, not memory refusals. This receipt does not prove every possible route or physical-phone RSS.

Reproduce with a clean preview:

```sh
scripts/serve-build.sh --rev 920a530be --port 4400
scripts/browser-lane.sh --max 15 node progress/memory/grid-admission-920a530be/probe.mjs http://127.0.0.1:4400/ /tmp/grid-admission.json
python3 progress/memory/grid-admission-920a530be/verify.py
```

Both phone captures were inspected. Browser and preview closed after the run. Coordinator approved the G112 retirement of the opt-in row and unmetered grid path; that change is a separate commit with no cap increase.
