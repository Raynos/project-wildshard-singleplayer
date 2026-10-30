# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy:** legacy-final 91a9eef081. **G908: Pine + Nine untouched** until Jake's word after his fps QA.

**LIVE f95804a-mvvldtx2** (18:59 Cancun, TSL; + PF6). **GLSL release 8afe35056d** (180df449c9 GLSL default): Nine + Pine +
Driftwood phone entry PASS; ships on its own 36 green. Live carries NF10 slabs, re-chunk, PF3, EP7 -> 44, diner fix.
**wildshard-v: f7 table for Jake at qa-2026-10-30-mini-plan.md:22.** For Jake: MF13 dither phone check (Sim longest
loader frame 110 ms, was 2.25 s); QB17 tmp/sp-o3-mf15/qb17-zip-before-after.mp4. **Open:** MF7, QB20 (phone), CI7/9/12/14.

**19:00 Claude 85 % -> G960 3 Opus:** o1 PF12 Pine readings; o2 depth-only caster merge; o5 program counts (Pine 114
-> 100, Nine 75 -> 70). o3 + o4 stood down at their boundaries. Codex: x1 + x9 Pine exact CPU; x2 B18 test fix + EP2;
x6 CI7 (sort fix); x8 NF12 stage 2 (wire <= 41.23 MB); runtime-join cut 857dc8b781 exact.
**Nine NF15 (GLSL vs LEGACY):** Chromium 4x P1-P5 at or under legacy + 0.5 (P5 9.0 / 10.4 busy machine), WebKit 1x
within +0.4, Simulator 30 fps held. **Pine Q4 GLSL:** draws 121.8 vs legacy 130.3, work 18.4 vs 20.0 (bar 12 / 16).
**wildshard-v 18:24:** (1) o4 was on readings. (2) PF3 kept: matched A/B halves the shadow pass (GLSL 1.51-2.23 ->
0.78-1.23 ms), -0.4 ms work; the board's 1 s readings came from two concurrent browsers. (3) EP3 / EP5 / EP9 marked.

**Autonomous decisions (for Jake's review):**
- GLSL is the global default (public too): Pine 44-55 dB, Driftwood 45.7, Nine 41-75; banyan canopy ruled B = GLSL
  (keeps haze TSL dropped, closer to legacy; board 9557e1dc93). TSL deletion stays NF18 (after QA).
- Toon gloss gate stays off (shipped look: sun glint on every toon surface); restoring it makes rough toon matte.
- EP12 parked till after QA: L1 look fix ready, no fps; neighbours see L1 only from >= 250 m.
- EP7 Nine at 44 programs (bar 43). EP3 / NF22 / PF15 closed: program sort worth ~1-4 switches, bars met.
- PF4 closes at the leather-grip merge (skins). PF6 ~0.3 equipment / ~0.09 weather; holstered weapon freezes (clip).
- Cabin merge and Rapier step skip not built (look trade; stale hitboxes).
- Known capture flake: Nine P2 canopy-cards (591,715) 1 LSB, GPU-side; ruled exact (f3feb414de).
- EP9 kept (board 6c23d7d7a6); cell re-chunk ships (board 4152abcd85); NF16 3 -> 2; PF1 + PF2 165 -> 109 draws.

**Rules:** G844, G848, G941, G952, G958, G960; no reverts (G674), no new Debug rows, never herdr wildshard-v.
