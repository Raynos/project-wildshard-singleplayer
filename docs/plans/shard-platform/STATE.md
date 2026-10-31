# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy:** legacy-final 91a9eef081. **G908: Pine + Nine untouched** until Jake's word after his fps QA.

**LIVE eb94988-mvvsdrbi = GLSL** (22:00 Cancun; all 36 + 4-shard entry PASS; Pine uploads -70 %), Sky look, NF12,
Developer journal cut, lever fix, B4 + Pine door test fixes; first release through the merged boot + ship job. Far
Reach native timeout fixed forward 0f0d1ecc9e (x9). Pine uploads -70 % bytes (x8, 0c99d920f6). **For Jake:** QC table qa-2026-10-30 (o1 2508e90724); MF13 dither phone check; QB17 video.

**21:50 E518 (Jake): finish every row of the 4 fps plans tonight**, schedule = finish-fps-2026-10-30-mini-spike.md.
Nine is GPU-bound on his phone (13 fps, gpu 45.7 ms vs CPU 10). Opus o2 G2 -> G4 -> EP6; o1 PF17 -> G5 -> EP11; o5 PF5
-> PF12 / 13 -> EP12 + NT4; o3 / o4 stood down (cap 3). Codex x8 G1 -> NF11 -> NF19; x2 EP2 -> NF23 -> EP7; x6 G3
-> EP10; x9 NF17 -> PF18 -> PF9; x1 PF19 -> EP8. PF7 done, NT5 closed measured. CI9 / CI10 / CI12 wait behind.
**CI7 bars PASS** on 60c0 (max 199 s, 1.187x). **CI9:** 55ea ship wait 62 s (was 512). **Finding:** the Roc can die
falling into the kill plane during its own dive (sp-x1, 46cbeac27d). **QC on ab792:** Nine at legacy (P1 7.4 vs 7.4,
walk 7.8 vs 7.8; f7 10.9-12.2); Pine 10-19 % under f7, over legacy (P1 12.6 vs 9.3); Simulator 30 fps both.

**Autonomous decisions (for Jake's review):**
- GLSL is the global default (public too): Pine 44-55 dB, Driftwood 45.7, Nine 41-75; banyan canopy ruled B = GLSL
  (keeps haze TSL dropped, closer to legacy; board 9557e1dc93). Nalati 7/8 at 52-63 dB; grid +170 far crag facets
  41 dB / 1.29 % accepted (slight tone shift 140 m out). Sunscar pass. Sky Reach fixed to the TSL look (c9354ebb83,
  df7b76d110, 62f2e8590a): 7/8; windmill-isle 39.6 dB / 1.13 % (mill tower texel detail) accepted. TSL deletion stays NF18 (after QA).
- Toon gloss gate stays off (shipped look: sun glint on all toon surfaces).
- EP12 parked till after QA: L1 look fix ready, no fps; neighbours see L1 only from >= 250 m.
- EP7 Nine at 44 programs (bar 43); GLSL programs accepted: Nine 72 (bar 70), Pine 111 (bar 100; rest is distinct states, warm-up). EP3 / NF22 / PF15 closed: program sort worth ~1-4 switches, bars met.
- PF4 closes at the leather-grip merge (skins). PF6 ~0.3 equipment / ~0.09 weather; holstered weapon freezes (clip).
- Cabin merge and Rapier step skip not built (look trade; stale hitboxes).
- Known capture flake: Nine P2 canopy-cards (591,715) 1 LSB, GPU-side; ruled exact (f3feb414de).
- EP9 kept (board 6c23d7d7a6); cell re-chunk ships (board 4152abcd85); NF16 3 -> 2; PF1 + PF2 165 -> 109 draws.

**Rules:** G844, G848, G941, G952, G958, G960; no reverts (G674), no new Debug rows, never herdr wildshard-v.
