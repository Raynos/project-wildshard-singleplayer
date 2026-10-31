# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy:** legacy-final 91a9eef081. **G908: Pine + Nine untouched** until Jake's word after his fps QA.

**LIVE ab792cd-mvvnrzgu = GLSL** (19:54 Cancun; all 36 green; Nine + Pine + Driftwood phone entry PASS). Next release
adds NF12 stage 2 (Nine wire 30.15 MB, 29d0a382ac) and the Developer journal cut (10ef1e8893).
**wildshard-v: f7 table for Jake at qa-2026-10-30-mini-plan.md:22.** For Jake: MF13 dither phone check (Sim longest
loader frame 110 ms, was 2.25 s); QB17 tmp/sp-o3-mf15/qb17-zip-before-after.mp4. **Open:** MF7, QB20 (phone), CI7/9/12/14.

**20:05 Claude 86 % -> G960 3 Opus:** o1 Pine first-hold spike (41-54 ms after entry); o2 visual regression walk
of Nine + Pine on the GLSL build; o5 Sky Reach GLSL fix (30 dB, custom ambient too bright; TSL look kept), then
Sunscar. Codex: x1 uniform array cache (109 duplicate uploads / frame at Pine P4); x2 EP2; x6 CI7 (Basis tool cache);
x8 EP10 Linux diagnostic report, then CI14; x9 CI9 (fixture skip 3b2a56007b; boot + ship one runner next).
Done: NF12 (29d0a382ac), NT3 closed measured (490 chunks, no gain), PF6 / PF3 / PF10 closed. **P0 19:15:** 94e03bbbdf
broke Nine entry (fp rig), fixed ab792cd85f. **QC on ab792 (o1, 2508e90724):** Nine at legacy (7.4 vs 7.4 ms P1, walk
7.8 vs 7.8; f7 was 10.9-12.2); Pine 10-19 % under f7, over legacy (P1 12.6 vs 9.3); Simulator 30 fps both.

**Autonomous decisions (for Jake's review):**
- GLSL is the global default (public too): Pine 44-55 dB, Driftwood 45.7, Nine 41-75; banyan canopy ruled B = GLSL
  (keeps haze TSL dropped, closer to legacy; board 9557e1dc93). Nalati 7/8 at 52-63 dB; grid +170 far crag facets
  41 dB / 1.29 % accepted (slight tone shift 140 m out). TSL deletion stays NF18 (after QA).
- Toon gloss gate stays off (shipped look: sun glint on every toon surface); restoring it makes rough toon matte.
- EP12 parked till after QA: L1 look fix ready, no fps; neighbours see L1 only from >= 250 m.
- EP7 Nine at 44 programs (bar 43); GLSL programs accepted: Nine 72 (bar 70), Pine 111 (bar 100; rest is distinct states, warm-up). EP3 / NF22 / PF15 closed: program sort worth ~1-4 switches, bars met.
- PF4 closes at the leather-grip merge (skins). PF6 ~0.3 equipment / ~0.09 weather; holstered weapon freezes (clip).
- Cabin merge and Rapier step skip not built (look trade; stale hitboxes).
- Known capture flake: Nine P2 canopy-cards (591,715) 1 LSB, GPU-side; ruled exact (f3feb414de).
- EP9 kept (board 6c23d7d7a6); cell re-chunk ships (board 4152abcd85); NF16 3 -> 2; PF1 + PF2 165 -> 109 draws.

**Rules:** G844, G848, G941, G952, G958, G960; no reverts (G674), no new Debug rows, never herdr wildshard-v.
