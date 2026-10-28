# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**(1) LIVE 8c07d58caa** (19:47 Cancun). 94f30e1ee5's
Pine public smoke leg (GL 1282) stays an open incident with sp-o3 (no local repro; 3001d0dac3 logs it). Damage list:
[BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md) only. HOST-AUDIT parked (G679).

**19:30 reply:** I1 / I7 / I11 done; I2 is open only on its 12 MB bar: needs D179 / D185 or per-shard byte targets
(recommend targets). 183 / 209 stays flat: open rows are measured misses that need a look pick or bar call to close.
**Question (Nalati herds, T10):** herd clocks run faster the more members' thinks are staggered. Tick once per 0.1 s per herd
(real time): ~5-7 % of Nalati's frame, herd paths change. Recommend: yes (bug fix).
**Question (cold crossings):** count cuts are nearly spent; then the lever is fewer material variants = look change
(G717.O3.5b). Recommend: an A / B board per shard. Also: quantize Nalati's big generated meshes (Float32 colour -> Uint8, normals ->
Int8, like the baked outcrops): ~5-6 MB less upload in the hold, colours within 1/255. Recommend: yes (sp-o4).
**Question (which instrument closes a crossing bar):** after 61e435deec (held WebKit 2 MiB slices) Nalati cold reads **6.65 s on
the Simulator** Pine **7.42 s**, DW 5.48 s (a return into home), vs 10.9 / 14-15 s on Chromium 4x CPU, the row's instrument (G807). Close on the Sim
Recommend: yes, Sim closes crossing bars; Chromium 4x guides slices.
**Question (Pine cold 14.85 s, reopens T7.7):** inputs land ~11 s before the hold; the held span (15.7 s) runs foundation + forest
page + kit / prepare-play (~7.9 s) then warm-up 7.5 s. T7.7 deleted building ahead on a guess. Allow a narrow exception: data-only
parts (parse, placement rows; no scene / colliders / lights) once the approach is verified, dropped on a turn-away? Saves at most
~2.5-3 s (sp-o5 sized it). Recommend: yes.
**For Jake (G812):** Driftwood -7 MB A / B board `art/driftwood-isle/round-21-phone-geometry-ab/board.jpg`.
**Jake picks open:** D183 / D185; LD5-LD8 / A1 / A2 / M2 / RM13.

**Pine look (D189 closed, FYI Jake):** white near ground (e962089fb2) fixed in a530c2fe07; teal tree-card backings
(three's NodeMaterial.copy drops alphaTest, since <= 10-24) fixed in 1668edb1e3. Both land after live 8c07, in the next release.
Slow-link Pine crossing (Fast 4G): D190 fixed (efcb18bed1); D196 warm bound counted network time, sp-o4 fixing.
**T10 official Sim frame floor (5c04e9e034): 11 / 15** (was 10). Fails: spawn p95 43, Pine drive 43, Nalati drive 38, Nalati
standing 46 ms (a periodic regression; sp-o3). **I2:** DW 33.4, Nalati 56.2, Pine 79.4 MB. **H4** warm home 3.85 s.
**Nalati cold, Chromium 4x:** 12.67 -> ~10.5-11.5 s (sp-o3 tail cuts).
**Lanes (G818: 92 %, 2 Opus):** sp-o3 Pine cold tail, sp-o4 D196 + Nalati precompile; sp-x1 / sp-x2 Nalati / Pine I2,
sp-x8 + sp-x9 H4 / A1, sp-x6 + sp-x10 damage, sp-ci-deploy release. sp-o1 / o2 / o5 released.

**Rules:** G704. G807. G818. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
