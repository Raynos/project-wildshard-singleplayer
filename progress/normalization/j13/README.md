# J13 — magazine ammo chip reload

Jake picked `art/hud/round-17-reload-chip/J13-chip-A.jpg`: the ammo chip itself is the button. Cyan border and corner brackets remain at full; the reload glyph appears only below a full magazine. There is no illustration inset. A tap dispatches the same reload input action as desktop R. Full magazines, no reserve, an existing reload, and blocking UI are inert. Pine lever rifle and Nalati/practice AR15 declare magazine ammo; quivers retain their passive chips.

## Portrait evidence

All three JPEGs were visually inspected, 390×844 phone tier on a served clean scratch export (runtime `b28730c1`; original base `e0a462fe`). The browser lane was used; browser and preview closed.

- `full-magazine.jpg`: 7 / 7 + 21, no reload glyph; full-chip click does nothing.
- `part-empty.jpg`: three real shots, 4 / 7 + 21; visible 15px reload glyph with a divider.
- `mid-reload.jpg`: native browser click on the chip starts the existing lever reload; 20.6% progress, glyph visible, repeat taps disabled. Existing `freezeCycle` debug handle holds the real action briefly for this shot. It is released and the reload completes to 7 / 7 + 18, glyph hidden.

`capture-proof.json` records these states. `capture.mjs` repeats the capture against a served build: `node progress/normalization/j13/capture.mjs <origin> <repo>`. agent-browser writes PNG regardless of a .jpg suffix, so the script converts through sips (85 quality) to actual JPEGs (~145 KB). GameClock.timeScale is reset every frame by Game; freezeCycle is the appropriate existing capture handle.

## Tests and parity

Focused tests cover both magazine declarations, full/part-empty/empty/final-round/no-reserve states, real Rifle and LeverRifle reload methods, desktop KeyR, no desktop reload markup, swaps to quiver/melee, blocking UI/title, and disposed scope behavior.

`boot-parity-proof.json`: every required phone shard booted with `boot.errors=[]`; the initial run also booted both Z3 shards and the template. Pine phone fingerprint+poses and walk+combat+leak were run separately. The same batteries on parent e0a462fe establish **zero new red fields** (`parent-comparison.json`). Pine draw/triangle counts match parent; scope resources are all zero after unload and disposalErrors is empty. Existing m5 reds (save inventory, GPU ceilings/cabin counters, and the split-walk ambient sampling deltas) are also red on the parent. No baselines or ceilings were changed.

Private scratch: `/tmp/sol-j13-bd3pkpso`; latest HEAD integration export: its `landing/`. Lead owns landing and push.

Final integration checks on parent `66db342a`: TypeScript, whole-tree oxlint and all **325 vitest files / 2328 tests pass**. CSS passes; Vite builds the exact runtime verification candidate `7bdaadea`, and four required phone shard boots have `boot.errors=[]`. J4's timeout fix is included in this parent. Earlier test timeouts were reported to their owners and are resolved.
