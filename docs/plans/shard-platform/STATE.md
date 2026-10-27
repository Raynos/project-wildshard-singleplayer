# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**(1) LIVE 0012c73e11** (shipped 22:08Z after green CI + six-leg smoke); sp-ci-deploy tracks the next green. G769 mega build; G768 gate; G801 sweep. Damage list:
[BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md) only. HOST-AUDIT (G679) parked; legacy waits (G606).

**For wildshard-v (G711):** counter 183 / 209 = 88 %. LIVE 0012c73e11 (shipped 22:08Z). Rows close on landed code + one Chromium reading by their own lane
(G807). G809 rows (SW3, CF3-CF5, GM1, build-speed) done in fa319ebead. **Crossings (G782):** warm passes everywhere
(last-cell retention); Sky passes both bars; cold DW ~11.5 s (waits on D178), Nalati ~15 s, Pine 18.3 s. D178 is being
built (sp-o4, held view: pause post, nearer far plane, 30 fps floor). D179 B built (sp-o3 producer, sp-x2 reader).
Official quiet Sim frame floor 10 / 15 (T10, sp-o5). iphone-downloads: only I2 open (honest status in its row).
Nalati warm green ground (G784): sp-o4.
**For Jake's play tonight (G812):** Driftwood -7 MB A / B board `art/driftwood-isle/round-21-phone-geometry-ab/board.jpg`
(9ca2c9e22a; phone 23.3 -> 14.9 MB served; static geometry identical).
**Jake answered (G815-G817):** arrival-first ships on by default once sp-o4's reading confirms (Developer gate
removed); D2 30 s idle-skipped checkpoint (sp-o3 building); R4 closes at ~24 s (sp-x1 marks; generators archives at 100 %);
D59 cap stays 9. green-main + ci-flow archive (sp-x6). H4 warm 4.3 s vs 1.5 and Nalati cold 14.7 s vs 8 are real misses;
Jake triages misses after tonight's play.
**FYI for Jake (look, correction):** the SDK Float16 fix (430285601e) makes Nine's crowd casts show their authored
clothing / umbrella colours again; since the 02f half-float bake they were dark silhouettes. Driftwood is unchanged.
**18:30 reply:** GR10 was folded (sp-o4) into GR9 / GS3 / GR7 (done) and LD6 (G606). Opus lanes: one Chromium reading per row (G807).
**Question for wildshard-v (cold crossings):** no-look levers are spent. WebKit fences pace shader builds (D152 looser fences failed);
prebuilding during the approach fails the 80 % test (Pine 22 %, Nalati ~20 %): Pine re-keys 149 of 150 programs (lights / fog in the key).
Only lever left: fewer programs / material variants = a look change (G717.O3.5b). Recommend: an A / B board per shard for Jake to triage after tonight's play.
**Jake picks open:** D175 (125 m kept) / D181 (sheen kept) ruled; D183 / D185 pending; LD5-LD8 / A1 / A2 / M2 / RM13.

**Lanes (G804 / G805; G803 3 Opus; Claude 86 %, Codex on credits):** sp-o3 iphone + D2 heap, sp-o5 tile-streaming
+ T10, sp-o4 crossing shaders + D178 (G808), sp-x8 + sp-x10 grid-crossing DW, sp-x9 loading, sp-x6 damage D53 / D94,
sp-x1 + sp-x2 I2 / D179, sp-ci-deploy CI + release only. sp-o1 / sp-o2 released.

**Rules:** G704. G803. G807. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
