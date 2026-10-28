# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**(1) LIVE 8c07d58caa**; release of **8a5223ab8c** (full CI + six smoke green, all tonight's fixes) deploying (run 40643481656). Damage list:
[BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md) only. HOST-AUDIT parked (G679).

**I2** closes only with D179 / D185 or per-shard byte targets (recommend targets); open rows are measured misses.
**Question (Nalati herds, T10):** herd clocks run faster the more members' thinks are staggered. Tick once per 0.1 s per herd
(real time): ~5-7 % of Nalati's frame, herd paths change. Recommend: yes (bug fix).
**Question (cold crossings):** next lever is fewer material variants (look, G717.O3.5b): A / B board per shard. Also: quantize Nalati's big generated meshes (Float32 colour -> Uint8, normals ->
Int8, like the baked outcrops): ~5-6 MB less upload in the hold, colours within 1/255. Recommend: yes (sp-o4).
**Question (which instrument closes a crossing bar):** after 61e435deec (held WebKit 2 MiB slices) Nalati cold reads **6.65 s on
the Simulator** Pine **7.42 s**, DW 5.48 s (a return into home), vs 10.9 / 14-15 s on Chromium 4x CPU, the row's instrument (G807). Close on the Sim
Recommend: yes, Sim closes crossing bars; Chromium 4x guides slices.
**Question (Pine cold 14.85 s, reopens T7.7):** inputs land ~11 s before the hold; the held span (15.7 s) runs foundation + forest
page + kit / prepare-play (~7.9 s) then warm-up 7.5 s. T7.7 deleted building ahead on a guess. Allow a narrow exception: data-only
parts (parse, placement rows; no scene / colliders / lights) once the approach is verified, dropped on a turn-away? Saves at most
~2.5-3 s (sp-o5 sized it). Recommend: yes.
**Jake picks open:** D183 / D185; LD5-LD8 / A1 / A2 / M2 / RM13; DW -7 MB board (round-21-phone-geometry-ab).

**Pine look (D189 closed, FYI Jake):** white ground fixed a530c2fe07, teal tree cards 1668edb1e3; next release.
Slow-link Pine crossing (Fast 4G): D190 (efcb18bed1) and D196 (6232aaece6) fixed; a Fast 4G pair completes.
**T10 official Sim frame floor (5c04e9e034): 11 / 15** (was 10). Fails: spawn p95 43, Pine drive 43, Nalati drive 38, Nalati
standing 46 ms. Standing = JSC critical-memory GC at a ~730-880 MB WebContent footprint. Native memory is UNDER the 1.2 GB
limit (1.07-1.11 GB; the 1.49 / 1.82 GB were allocator claims). sp-o3 trims leaks for the standing GC; sp-o4 spawn.
**Question (T10 spawn pose):** spawn's p95 43 ms is post-boot settling (JSC GC, GPU backlog); settled it reads 33 / 34 ms.
Sample spawn after a settle like the standing poses? Recommend: yes.
**Misses stated with breakdowns:** H4 warm home 3.85 s (first-time construction), A1 770 ms (first-time Rapier + road).
**I2:** DW 30.8 (floor), Nine 20.8, Nalati 55.0, Pine 77.5 MB (stated).
**Lanes (G818: 94 %, 2 Opus):** sp-o3 Nalati standing GC, sp-o4 spawn heap; sp-x1 / x9 I2, sp-x2 D197, sp-x8 RM8.1e, sp-x6 / x10 damage,
sp-ci-deploy release. sp-o1 / o2 / o5 released.

**Rules:** G704. G807. G818. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
