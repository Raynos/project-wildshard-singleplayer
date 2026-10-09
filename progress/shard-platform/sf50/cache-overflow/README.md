# Signal Dunes pack horse: cache overflow refusal fixed

Source `ab3b4e4fdd89f7ad7f7333085a0a8a2875ea9b92` fixes the regression identified in `eb19cbc58`.
The dated whole-runtime measurement is a coverage ceiling. Concrete caches beyond it now receive ordinary commons
leases through the same allocator and admission policy. Observing a cache from a smaller runtime admits the new
charge before releasing its prior covered lease; refusal preserves that reference. No cap, measurement or model changed.

The actual thirteen committed GLBs reproduce the old refusal and missing horse. The fixed standalone and regional
fixtures both load it. Horse storage is **4,394,860 CPU + 5,792,960 GPU = 10,187,820 bytes**. All model caches total
53,837,632 bytes; 5,592,404 bytes overflow the 49,369,323-byte measured runtime claim. The isolated runtime/cache model
therefore rises from 434,799,949 to 441,007,517 bytes. These are allocation/backing storage and model figures, not
physical resident RAM or native memory savings.

The muted Chromium iPhone 16 Pro portrait proof on `16728f1c6` shows the horse, its uploaded textures/buffers and its
flesh collider in standalone and after real held-input road → Signal entry → authored-spawn traversal. Entry takes
14.50 s and the spawn leg 35.04 s; zero page errors. Full grid claims, including platform and neighbours, model
**584,239,556 playing / 664,239,556 loading bytes**, below 1.0 GB. This is not a new native cap reading. The interior
horse inspection pose follows the actual crossing; it is not used to seed entry. Both portraits are included.

Clean candidate `b8c7a255d` (parent `780f71006`, reproducible `candidate.patch`) passes **956 files / 5,439 tests +14 skips**,
strict TypeScript, root oxlint, ratchet and hooks. Thirteen focused tests cover allocator refusal, transfer, cache
retirement/rebuild and actual GLBs. Browser production bytes match that candidate; its extra file is the actual-GLB test.

`browser-summary.json` and `node-summary.json` contain compact figures; Brotli archives retain full claims, routes,
allocation identities, rejected diagnostic attempts and validation logs. The rejected attempts were a census typo,
an unstaged initial road source, and a timeout under parity frame-control across retirement; the canonical real-time
frame-floor setup passes. All owned browsers and the preview were closed. Signal Dunes parity baselines remain unchanged.

Plan-State: unchanged.
