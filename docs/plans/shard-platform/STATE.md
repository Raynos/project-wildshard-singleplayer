# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G824: SHARD-PLATFORM archives today; after the archive commit EVERY lane and the coordinator stop until Jake's retro
(G845).** Only legacy-deletion (LD4b goldens done; tag legacy-final; LD5-LD10 all at once on Jake's word, G840 / G843 / G851).
Archived today: 12 mini plans (loading ... tile-streaming 9be158bc79).

**LIVE c05f6ac3b8 (build c05f6ac3b-mvsxjh1p, ~21:35 Cancun):** NM motion, the spawn-stall fix (no 10x fatal), lend contract,
PL test fixes, What's New; CI 40801902717 all 36 + exact six 40804172656. Previous: beb02d804-mvsuz7t1. Sim phone-route leg still
times out on xcrun (report-only; no Sim pass claimed).
~21:10: the BURN-DAMAGE-LIST working copy was truncated (sp-o3) and restored to HEAD; its unlanded delta is unrecoverable, lanes told.

**Jake's QA 10-28 PASSED:** NM, loading / M2, tiles / T10, DW cut B (G827 / G831-G833).
**Marks:** Nine done NR1-3, 5-7, 12 (NR3 windows 4c4fadb4d2; NR12 walls + coarse look 2b304160d0); open NR4, NR8, NR10, NR13-14. Far Reach FR1-4
done (FR3 53a7884102); FR5 grid sun rays, FR6 open. QF6 / 11 / 20 (tone D205) / 21 / 22 done; D203 / D204 / D205 tone: presets match exactly (harness a9c4ed2b82), inputs differ. NM motion restored (ba74e16032). Pine LUT + far trees done.
**Opus:** o3 FR6, D205 / D204 inputs; o4 NR14 / QF25 (NR13 done 12ca808f2d); o5 QF26. PL11 / PL12 done. Damage: T6 D202, T7, D199, D201, D12 (+ Chromium 4x spawn 66.7 ms).
**Codex (G861 / G862 / G867):** tool `pnpm phone-loading` done (b863be1b48, ac34371119; live phone 51.2 / 24.7 s). x9 N1, then PL1 /
PL3 / PL13, x10 PL2 / PL5 / PL14, x6 PL9 / 11 / 8 / 12 / 16, x2 PL7 / PL4 / PL15, x1 QF19 (P1 desktop Settings), PL6 / PL10.
Then G860 / lint-speed. Done: N2 76003eacee, N3, N4, DL2.
**Rules (10-28):** G828, G844, G846, G848, G858.
**Lanes:** 3 Opus (now 13 % weekly; G853 steps at 60 / 80 %), 5 Codex + sp-ci-deploy.
**Compare harness fixed (sp-o5 2856d1669f):** live game camera, player posed; rerun on 2077a1d673 = 115 / 144 (Nine 10 / 24);
frames tmp/golden-compare-144/2026-10-28-2077a1d673 for wildshard-v's page. 4 bad LEGACY goldens (Sunscar 21 / 22, Pine 11 / 20) re-shot before LD.
**Still open for wildshard-v / Jake:** PICK FR5 (board f5d698f2a3, art/far-reach/round-43-shardfile-regressions/fr5-rays-origin-board.jpg):
A = one line (sunDisc.updateMatrix(); patch tmp/sp-o3-fr5/fr5-a.patch) so Far Reach's rays come from the painted sun, not the world origin;
standalone keel 119,105,93 -> 67,47,29 = the grid's. Rec A: the golden's keel wash is the origin bug, not art; no cost. Pine pond gap (490716bbbc) is no bug: the orange is a passing elite, the 'snow' is LEGACY's
sky-white shore water over the same canoe (sp-o4, tmp/sp-o4-t10/pond-weapon/evidence.jpg); rec keep SHARDFILE, else a water-look row. Older: herd clock, material variants, D53 CLIs, picks D183 / D185, Far Reach G99 isles.

**Rules:** G704, G807, G853. No reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
