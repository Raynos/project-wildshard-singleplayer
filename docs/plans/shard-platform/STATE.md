# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy:** legacy-final 91a9eef081. **G908: Pine + Nine untouched** until Jake's word after his fps QA.

**LIVE 4b49fb0-mvvh0x0m** (16:51 Cancun). **Release candidate 4fe6619330** (run 41138893609): Nine phone entry PASS
(137 draws, no 'Missing world scene blob'), typecheck green; ships when all 36 required jobs are green (sp-ci-deploy).
It carries NF10 slabs + fix 1883256c5a, the cell re-chunk cde6aaf36f, PF3 shadow cadence, EP7 -> 44, diner fix.
**wildshard-v: f7 before/after table for Jake at qa-2026-10-30-mini-plan.md:22.** Also for Jake: MF13 'Refine dither'
phone check (Sim Nine longest loader frame 110 ms, was 2.25 s; 9165621261); QB17 zip video
tmp/sp-o3-mf15/qb17-zip-before-after.mp4. **Open:** MF7 battery, QB20 thermal (phone), CI7 / CI9 / CI12 / CI14.

**18:05 (G960, Opus 5):** o1 PF10 Pine GLSL done (~1 ms off) -> Pine render per-draw cost; o2 PF10 water / sky /
cabins / wildlife; o3 GLSL cascade sun (Driftwood dark in sun); o4 NF15 Nine GLSL; o5 PF6 weather / equipment.
Codex: x1 Pine exact CPU cuts; x2 EP2; x6 CI7; x8 NF12 (first cut negative) + PF9 land; x9 deterministic sort.
Pine Q4 at 4x: 18.7 ms (update 6.2, render 12.4) vs 12 / 16 bar.

**Autonomous decisions (for Jake's review):**
- GLSL becomes the global default (public too) once Nine + Driftwood pass Pine's parity (44-55 dB); o1 flips + deletes the row.
- EP12 parked till after QA: L1 look fix ready, no fps (128 -> 130 draws); neighbours see L1 only from >= 250 m.
- EP7 Nine accepted at 44 programs (bar 43; the last needs shared hydration + mover churn).
- PF4 closes at the leather-grip merge: a cross-material crossbow breaks weapon skins; Pine's draw bar is met.
- PF6 closes ~0.3 ms equipment / ~0.09 weather (bars 0.2 / 0.05): rain draws per frame; a holstered weapon freezes (clip).
- PF9 lands: its P3 1 px is a pre-existing depth tie (fire-lookout coarse, async material ids), not PF9.
- EP9 kept (G941, board 6c23d7d7a6): Nine P2 restores a culled copy (as legacy); P1 4 px cull edge; Pine exact.
- Cell re-chunk ships (G941, board 4152abcd85): Nine P1-P5 143-157 -> 109-116 draws.
- NF16 done at composite 3 -> 2; EP8 crowd dye B ships; PF1 + PF2 Pine 165 -> 109 draws.

**Rules:** G844, G848, G941, G952, G958, G960; no reverts (G674), no new Debug rows, never herdr wildshard-v.
