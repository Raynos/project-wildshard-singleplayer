# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**(1) LIVE 0f4a65357b** (02:48 Cancun; full CI + six smoke), with tonight's Pine and slow-link fixes. Damage list:
[BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md) only. HOST-AUDIT parked (G679).

**I2** closes only with D179 / D185 or per-shard byte targets (recommend targets); open rows are measured misses.
**Question (Nalati herds):** herd clocks run fast when thinks stagger; tick once per 0.1 s per herd (paths change)? Recommend: yes.
**Question (cold crossings):** fewer material variants (look, G717.O3.5b): A / B board per shard? Quantize Nalati's big meshes
(colour Uint8, normals Int8): ~5-6 MB less upload, colours within 1/255? Recommend: yes to both.
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
**Question (D53):** 8 Pine / Nine manual refresh CLIs still import Node I/O; moving them breaks no-runtime-generator. Add a confined
SDK author-command host (owned reads, named byte outputs, --check), or keep them as stated debt? Recommend: keep as debt until HOST-AUDIT.
**Misses stated with breakdowns:** H4 warm home 3.85 s (first-time construction), A1 770 ms (first-time Rapier + road).
**I2:** 18 / 24 entries meet both bars; floors: DW 30.8, Nine 19.2, Nalati ~55, Pine 77.5 MB (stated).
**Lanes (G818: 95 %, all Opus released 02:00):** sp-x1 + sp-x9 Explorer-after-play stall (cache contention); D53 / D94 split
x6 Pine, x8 Nine, x10 Nalati, x2 rest; sp-ci-deploy release. Graphical rows (Pine drive, D154, D197 render, RM8.1e pixels) wait for Opus.

**Rules:** G704. G807. G818. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
