# sp-x4 handoff — 2026-10-08

Status: Pine P0 functional fix landed locally; WebKit standalone + grid entry GREEN; clean full suite 910 files / 5254 passed / 14 skipped / no unhandled errors. IDLE under Codex throttle after this receipt. Coordinator owns push/release; do not call local-only commits shipped.

Done:
- Generic mip lifetime: `d77c83b8490a8dfeb170fd6bf05b28479b635e58`; allocation-free scalar guard: `f9e50f6fbbb6afb4e678dbc391608842cbe3134e`. Retain through first successful real draw, including shader uniforms; fail descriptively on retired sampler/source/allocation changes.
- Bolt provisional preload `6ba810ee1a5c02cfeed25d4e8cfeb4e88f4e3c75`; tree sampler-before-upload `733e6e6353fa3b0393004c310cb0218469ac5b9c`; rifle lifetime fixture `09d9bc6ab976d4ecb546038dace82965ce9ae354`.
- Official release boot smoke adds standalone Pine, unchanged 60 s / ten-frame gates: `1bffb4df03715c32fa0b999f037f0b4184d64f3e`.
- Proof pin d77c83b84: standalone Developer OFF 11.312 s + ten frames/errors0; Developer grid real Driftwood→road→Pine 18.35 s, Pine entered/resident/ready, pending[]/issues{}/errors0. Evidence: [Pine first draw](../sf57/pine-first-draw/README.md).

Exact next step: coordinator carries these through the serialized push, runs the official boot smoke on that exact SHA (Driftwood + Pine standalone + Developer grid), then releases only a push-CI/boot-smoke green intersection. sp-x3 may resume its Sun floor/soak on the coordinator's pin. The full 30-minute SF57 soak remains OPEN; this short Mac WebKit proof claims no memory cap or GPU crash-rate result.

Open/parked:
- Template-copy fps / desktop grid boot investigation transfers to Opus. Borrowed-home stationary prefetch count fix `abba21fc38a7c68150ed5f3d8d9d271bf7263f1e` landed with a no-thrash fixture; no browser fps improvement claimed.
- Public-grid native/floor proof is incomplete (template-copy fps red); G233 public catalogue does not itself clear G210.
- Sky cut has no native-saving credit; kurgan lazy native pairs and SF27 flock retirement/floor tails remain in the plan, not new tasks for this idle lane.
- Original texture195 is not mapped by the retained trace; actual standalone bolt40 and tree73 labels are proven. Do not overstate attribution.

Resources: all owned proof browsers closed; no Simulator owned; proof preview :4407 stopped. No owned P0 source differs from HEAD. Shared stale index and other lanes' WIP were left alone. Validation details are in the linked receipt; coordinator's clean push gate remains required.
