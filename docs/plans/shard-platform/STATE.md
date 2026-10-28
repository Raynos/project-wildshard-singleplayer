# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G824: SHARD-PLATFORM archives today; after the archive commit EVERY lane and the coordinator stop until Jake's retro
(G845).** Only legacy-deletion (LD4b goldens done, then LD5-LD10 all at once on Jake's word, G840 / G843) waits on Jake.
Archived today: loading, iphone-downloads, grid-crossing, shared-waits, open-plots (hologram), mega-build, finish-line,
NM pilot, remaster-open-plots, grid-ready, build-speed, custom-code-freeze (LD9 / LD10), tile-streaming (9be158bc79).

**LIVE a6701db713.** The QA-fix release rides the first SHA past 6e1ef677e4 with full CI + exact six-leg smoke green
(all reds since 460 / 538 / ced are fixed). Landed for it: SW stall limits + QF2 + B1-B6 (B2 / B6 stated misses), loading
screen lane, minimap labels, water, pier, sailboat, Far Reach islets (18aaab1583), WebKit warm-up pacing, Nine title fix
(f2e66fd723), NM figures (c408623188), Pine far trees (a3050f9d2c), Nine NR3 sky / NR7 talisman.

**Jake's QA 10-28 PASSED:** Night Market (G827), loading / M2 (G831), tiles / T10 iPhone (G832), DW phone cut B (G833).
**Open (Opus, G853):** Nine NR1 / NR2 / NR8 (sp-o3), NR3 facades + NR6 rain after NR2, Far Reach FR2 / FR3 (sp-o5),
RM8.1e codec witness (sp-o4). Done: QF12 pier, FR1 / FR4, NR5 (not reproduced). Damage: T6 D202, T7, Props D201, Sky D199.

**PICK for Jake (Pine P2-P4 + pale crag, one cause):** SHARDFILE applies Pine's colour LUT (G322 'always carried'); LEGACY
never loaded it (its renamed id has no LUT file), so the goldens are LUT-less. Board 6ead6c59f8:
art/pine-hollow/round-2-g848-lut/board.jpg. **A** keep the LUT (sp-o4 + my rec, per G322) or **B** drop it to match the
golden. Likely the same for Driftwood's warmer planks. No code change until picked.

**Rules (10-28):** G848 no visual work on Codex. G844 every look commit lands with a labelled same-camera before / after.
G846 the detailed loading screen stays for everyone. G828 no crossing cuts, no one-world plan drafts.
**Lanes:** 3 Opus (sp-o3 / o4 / o5; G853: 2 from 60 %, 1 from 80 % weekly; now 5 %), 5 Codex on standby (no non-visual rows
left) + sp-ci-deploy.
**Still open for wildshard-v / Jake:** herd clock, material variants / mesh quantising, D53 CLIs; picks D183 / D185.

**Rules:** G704. G807. G844. G848. G853. No reverts (G674). No new Debug rows (G669). Never herdr wildshard-v.
