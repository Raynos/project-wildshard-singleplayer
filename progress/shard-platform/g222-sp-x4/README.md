# G222 phone proof — sp-x4

E435 / G222. Source changes reached `origin/main` in coordinator pin `e9128c290`; this commit records the phone evidence. The serialized coordinator push owns the final gate for this receipt.

| Row | Source | Proof |
|---|---|---|
| (a) Cell screen setback and near readability | `343a15845`, `4684f2112` | Real build `9156a965e`, iPhone 16 Pro / phone tier, muted, Developer ON. At road feet `(0,-277.5)`, the Sky Reach screen is `(0,6.9,-323)`, scale 2, lower edge 0.4 m above ground. It stays 24 m inside the closed cell, with no collider. The same canvas and plane show the live waiting reason and action in larger near type. Nine screen tests pass. |
| (b) Apply & reload text | `74c25584f` | Both authored strings now contain the literal `Apply & reload`, consumed by the existing textContent path. |
| (c) Explore / selector title overlap | `86bb8a5ce` | Build `9156a965e`, 402×874 viewport: the heading ends at y=50; Explore starts at y=62. Intersection area is **0 px²**. |
| (d) Template copy titles | `c9f784231` | Real build `ae94f0fd1` road-to-template-2 entry displays `Template shard · 2`. The RealDOM fixture proves unique card text for instances 1, 2 and 6, preserves native card text, and disposes its timer. The current Developer catalogue exposes only copy 2. |
| (e) Template minimap | `ae94f0fd1` | The real template centre capture shows the square path loop, four radial paths and landmarks. The image composites the admitted props.far GLB into the same product canvas, shared by copies and home; no new fetch or format. Eight map fixtures pass, including the real 2,364-triangle GLB, painter ordering, both load orders and canvas release. |

Captures: [screen](screen.jpg), [selector](selector.jpg), [template map](template-map.jpg).
The screen and selector captures use the committed build `9156a965e`; the template map uses `ae94f0fd1`.
The final browser ran inside `scripts/browser-lane.sh --max 20`, muted with the iPhone 16 Pro device profile; its browser and preview were closed after capture.

Full clean-export Vitest ran before every source commit. Historical candidate runs passed **4,690** and **4,707** tests with one inherited AG7 graph-inventory failure awaiting central regeneration. After the coordinator regenerated and pushed `e9128c290`, the full clean-export check before this receipt passed **772 files / 4,713 tests** in **79.38 s** (`git archive HEAD`, `node scripts/link-node-modules.mjs`, `pnpm gen`, `pnpm exec vitest run`). Own focused fixtures and typed lint also passed.

Pine's four-entry grid proof is separate and remains open: its actual native footprints pass, but the live durable creature continuation failed on a later entry. See the SF47 live receipt; no format or Pine geometry change is part of these fixes.
