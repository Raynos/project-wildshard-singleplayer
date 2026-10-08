# sp-x3 handoff — 2026-10-08, offline memory attribution

- SF57 e632 Developer D/P/N/template dry5 functional PASS, 316.270 s, peak
  WC+GL993.183MB, no GPU loss; receipt3aa80594b.
- Full30 functional PASS but memory RED:1811.547s,6complete circuits+partial7,
  47route witnesses/all16crossroads/errors0/GPUloss0. Peak WC+GL1235.984MB,
  +235.984MB overcap; settled loop2 808.049→loop6 1012.101MB (+204.052MB).
  Sampling/leakZero pass, calibration/recovery fail. Full raw/receipt at
  progress/memory/sf57/e632fe913-dev-subset/. No full-catalogue/cap clearance.
- Offline attribution receipt0edc1ca2a: WC+197.150MB, GL+6.902MB;
  PMREM+6.881MB routed coordinator/Opus, ~50.2MB/circuit total/no observed
  plateau. attribution/README.md + reproducer/JSON under the same evidence dir.
- Approved post-SF69 four-circuit diagnostic on2fccee5ba FAILED/incomplete:
  2circuits/8route witnesses green, boundary0/1/2 SF64/native/passive data kept;
  Heap.snapshot at2 closed Inspector before any heap payload. Cleanup RPC timeout
  prevented final main-result flush (rawcircuits1 is stale; eight witnesses prove2).
  Evidence/reproducer progress/memory/sf57/2fccee5ba-four-circuit/.
- Preinspection WCtails464.605/890.917/1213.699MB; SF64RAM196.036/355.382/531.403MB;
  programs151/314/320. RAM1to2+176.022MB =buffers127.251+bitmaps35.652+canvases7.877+
  images5.243; renderergeometry251->251,GL+1.836MB. CPU-source candidate for
  place-lifetime lane, NOT strong-root proof without heap/collection.
- VM/heap inspection visibly raises nativeWC; failedheap intervalhigh2139MB is
  intrusive, not cap evidence. No newips/postbootWebContentloss, but transport
  closecode/reason was not retained;512MiB payload limit is unproved candidate.
  No four-circuit leak rate or causal comparison with e632; SF69+PMREM present.
- All owned Safari/Inspector/proxy/sampler closed; sim0/1 verified; fresh device
  A274C713-B7DE-4AB6-BF56-8B24E53EFF38 shut down/deleted. Owned4400/PID82624 stopped
  by preparation finally. No preview/browser/native remains. No retry started.
  Next: send receiptSHA to coordinator/place lane; wait coordinator for diagnostic
  transport/final-flush correction and any next shared-Simulator measurement.
- Driver2025b98f1 +lintforward6d3165ebb landed/pushed.26focused/scriptsstrict/scopedlint
  green. Requiredheavyfull5310pass/9foreignreds was approved bycoordinator (shared
  WIP or central generated outputs). No sourceWIP or plan edits.
- Scratch /private/tmp/claude-501/sp-builders/sp-x3/sf57-2fccee5ba-four-circuit
  raw is archived exactly in repo; original e632scratch still kept under
  /private/tmp/claude-501/sp-builders/sp-x3/sf57-e632fe913-retry.
- Sun floor2ed39b862 shipped:20/22 cadence rows pass/aggregateRED; exactreceipt
  progress/shard-platform/sf50-sun-floor-e632fe913.md. HOVER8f1918525+c932ce846
  shipped/touch4of4; Pine P0d77+f9e in e632. No plan edits.
- Coordinator alone pushes. Private index fromHEAD/CAS/hooks; never message
  wildshard-v. Older e459 scratch cleanup was blocked by automatic review;
  no deletion retry, all useful evidence already durable.
