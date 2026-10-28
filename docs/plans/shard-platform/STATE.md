# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**(1) LIVE 8a5223ab8c** (01:47 Cancun; full CI + six smoke): ships tonight's Pine look, slow-link and GL 1282 fixes. Damage list:
[BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md) only. HOST-AUDIT parked (G679).

**I2** closes only with D179 / D185 or per-shard byte targets (recommend targets); open rows are measured misses.
**Question (Nalati herds, T10):** herd clocks run faster the more members' thinks are staggered. Tick once per 0.1 s per herd
(real time): ~5-7 % of Nalati's frame, herd paths change. Recommend: yes (bug fix).
**Question (cold crossings):** next lever is fewer material variants (look, G717.O3.5b): A / B board per shard. Also: quantize Nalati's big generated meshes (Float32 colour -> Uint8, normals ->
Int8, like the baked outcrops): ~5-6 MB less upload in the hold, colours within 1/255. Recommend: yes (sp-o4).
**Question (crossing instrument):** cold on the Sim: Nalati 6.65, Pine 7.42, DW 5.48 s (all < 8); Chromium 4x 10.9 / 14-15 s
(G807's instrument). Close on the Sim? Recommend: yes; Chromium 4x guides slices.
**Question (Pine cold, reopens T7.7):** build data-only parts (parse, placement rows; no scene / lights) once the approach is
verified, dropped on a turn-away? Saves <= 2.5-3 s of the 15.7 s held span. Recommend: yes.
**Jake picks open:** D183 / D185; LD5-LD8 / A1 / A2 / M2 / RM13; DW -7 MB board (round-21-phone-geometry-ab).

**Pine look (D189 closed, FYI Jake):** white ground fixed a530c2fe07, teal tree cards 1668edb1e3; live in 8a5223ab8c.
Slow-link Pine crossing (Fast 4G): D190 (efcb18bed1) and D196 (6232aaece6) fixed; a Fast 4G pair completes.
**T10 official Sim frame floor (8409c015d5): 13 / 15** (was 11). Fails: spawn p95 39 / max 63, Pine drive 42 / 95 ms; Nalati
drive / standing pass now. Standing was JSC critical-memory GC at a ~730-880 MB WebContent footprint. Native memory is UNDER the 1.2 GB
limit (1.07-1.11 GB; the 1.49 / 1.82 GB were allocator claims).
**Question (T10 spawn):** p95 39-43 ms is post-boot settling (GC, GPU backlog), 33 / 34 settled. Sample after a settle? Recommend: yes.
**Question (RM8.1e):** all 24 products and tile caps pass at 35281b4d8e. The codec (850a6efb5f) has no per-shard pixel A/B,
only RM13's look board. Accept on the existing looks, or wait for an Opus witness after the morning switch? Recommend: an Opus witness.
**Misses stated with breakdowns:** H4 warm home 3.85 s (first-time construction), A1 770 ms (first-time Rapier + road).
**I2:** DW 30.8 (floor), Nine 20.8, Nalati 55.0, Pine 77.5 MB (stated).
**Lanes (G818: 95 %, Opus released at boundary 02:00):** sp-o3 / sp-o4 finishing standing GC / spawn heap; sp-x1 / x9 I2, sp-x2 D197, sp-x8 RM8.1e, sp-x6 / x10 damage,
sp-ci-deploy release. sp-o1 / o2 / o5 released.

**Rules:** G704. G807. G818. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
