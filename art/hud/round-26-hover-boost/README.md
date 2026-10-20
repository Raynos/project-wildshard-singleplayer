# G540 hover BOOST HUD

Real Template captures while hovering with Developer enabled. Both use a
muted iPhone 16 Pro browser profile, 402 × 874 CSS pixels in portrait.
The JPEGs have burned-in footer labels and are each under 250 KB.

| Capture | Build | State |
| --- | --- | --- |
| [Before](before.jpg) | `aab2923-mvh76stx` | Existing HOVER and SWAP column |
| [After](after.jpg) | `726c5b9-mvhbljr8` | BOOST on, beside HOVER |

The live HUD check measured BOOST at x=50, y=378.03 with a 58 × 48 CSS
pixel target, clear of HOVER (right edge x=38). Its `aria-pressed` became
true on tap. Switching Developer off in Settings hid BOOST immediately;
switching it back on restored the retained latch. Page errors: zero.
The browser and preview were closed after capture.

Runtime/HUD source: `08c611c8f1`; Template manifest/card parity fix:
`726c5b90a1`; authored open-plot road class: `c2bfcffc33`; direct-entry
speed-class installation: `31dad82ded`.

`pnpm exec vitest run test/hover-boost.test.ts` passes all four tests,
covering five real padding manifests against a main shard, standalone
and grid speed-class reads, 2× road / 4× interior boost, Developer
visibility/input, and scope cleanup. Changed-file type-aware lint passes.
