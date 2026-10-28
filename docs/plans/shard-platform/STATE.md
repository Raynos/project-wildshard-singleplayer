# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**(1) LIVE 8c07d58caa** (19:47). Pine GL 1282 smoke fixed (7ed7f1ecee, depth feedback loop). Damage list:
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
**For Jake:** DW -7 MB board `art/driftwood-isle/round-21-phone-geometry-ab/board.jpg`.
**Jake picks open:** D183 / D185; LD5-LD8 / A1 / A2 / M2 / RM13.

**Pine look (D189 closed, FYI Jake):** white ground fixed a530c2fe07, teal tree cards 1668edb1e3; next release.
Slow-link Pine crossing (Fast 4G): D190 (efcb18bed1) and D196 (6232aaece6) fixed; a Fast 4G pair completes.
**T10 official Sim frame floor (5c04e9e034): 11 / 15** (was 10). Fails: spawn p95 43, Pine drive 43, Nalati drive 38, Nalati
standing 46 ms. Standing = JSC full GCs every ~0.65 s under memory pressure: **Sim WebContent Nalati 1.49 GB, Pine 1.82 GB**
(over the 1.2 GB per-shard limit; Chromium phone 1.16 / 1.20). sp-o3 cuts memory; sp-o4 the drive frames' JS tasks.
**Misses stated with breakdowns:** H4 warm home 3.85 s (first-time construction), A1 770 ms (first-time Rapier + road).
**I2:** DW 33.3 (near floor), Nalati 55.0, Pine 77.4 MB; Nine (sp-x9) next.
**Lanes (G818: 94 %, 2 Opus):** sp-o3 memory + spawn, sp-o4 drive JS tasks; sp-x1 / x2 / x9 I2, sp-x8 D105, sp-x6 / x10 damage,
sp-ci-deploy release (next candidate needs fbeec3ecda + bd51640c49 + 3e0ab079de). sp-o1 / o2 / o5 released.

**Rules:** G704. G807. G818. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
