# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**(1) LIVE 59a595ab10; main CI GREEN at 0012c73e11** (20:57Z); its six-leg smoke 40587079395 is running and
sp-ci-deploy releases it the moment it passes. G769 mega build; G768 gate; G801 sweep. Damage list:
[BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md) only. HOST-AUDIT (G679) parked; legacy waits (G606).

**For wildshard-v (G711):** counter 178 / 209 = 85 %. Rows close on landed code + one Chromium reading by their own lane
(G807). G809 rows (SW3, CF3-CF5, GM1, build-speed) done in fa319ebead. **Crossings (G782):** warm passes everywhere
(last-cell retention); Sky passes both bars; cold DW ~11.5 s (waits on D178), Nalati ~15 s, Pine 18.3 s. D178 is being
built (sp-o4, held view: pause post, nearer far plane, 30 fps floor). D179 B built (sp-o3 producer, sp-x2 reader).
Official quiet Sim frame floor 10 / 15 (T10, sp-o5). iphone-downloads: only I2 open (honest status in its row).
Nalati warm green ground (G784): sp-o4.
**For Jake's play tonight (G812):** Driftwood -7 MB A / B board `art/driftwood-isle/round-21-phone-geometry-ab/board.jpg`
(9ca2c9e22a; phone 23.3 -> 14.9 MB served; static geometry identical).
**Questions for Jake (recommendations):** (a) R4 typed lint 23.8 s against 15 s; parallel runs cross 8 GB (f636b0f49d,
D129): accept ~24 s single-run as R4's bar. (b) D2 heap: the idle Template's major GCs come from the 5 s periodic save
(271 KB continuation): checkpoint every 30 s, skipped while idle, keeping pagehide / hidden / dispose / crossing saves
(<= 30 s lost on a crash); alternative a delta save format with a migration. sp-o3 holds the cadence until answered.
(c) D59: decision-module cap 8 -> 9 product-wide (Pine contract guest, Nalati practice course), built on the recommended
9 under G769; confirm 9 or name a module-budget design.
(d) G808 cold crossings: arrival-first entry (compile / draw only content within ~125 m of the entry before reveal;
farther content behind its stand-ins, appearing nearest-first after reveal): DW cold ~10.3 -> ~6-7 s est.; built behind
Developer meanwhile (sp-o4). Recommend arrival-first; the alternative keeps ~10 / 14 / 17 s (DW / Nalati / Pine).
**Jake picks open:** D175 (125 m kept) / D181 (sheen kept) ruled; D183 / D185 pending; LD5-LD8 / A1 / A2 / M2 / RM13.

**Lanes (G804 / G805; G803 3 Opus; Claude 82 %, Codex 99 % on credits):** sp-o3 iphone + D2 heap, sp-o5 tile-streaming
+ T10, sp-o4 crossing shaders + D178 (G808), sp-x8 + sp-x10 grid-crossing DW, sp-x9 loading, sp-x6 damage D53 / D94,
sp-x1 + sp-x2 I2 / D179, sp-ci-deploy CI + release only. sp-o1 / sp-o2 released.

**Rules:** G704. G803. G807. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
