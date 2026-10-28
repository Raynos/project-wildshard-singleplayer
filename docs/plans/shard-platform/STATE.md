# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**(1) LIVE 0f4a65357b** (02:48 Cancun; full CI + six smoke), with tonight's Pine and slow-link fixes. Damage list:
[BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md) only. HOST-AUDIT parked (G679).

**Counter (sp-x8 recount, cc69600):** raw 186 / 209; true **188.5 / 209 = 90 %** (SW13 done, GR10 folded, build-CI carry done;
RM13 is half until Jake's word). Open: picks / parked (LD5-8, A1-A2, R1-3, RP2-4, M2), measured misses (I2, H3, H4, A1, T2-4, T6,
T7, T10, G784). I2 closes only with D179 / D185 or per-shard byte targets (recommend targets).
**Question (H3 scope):** G794 made H3 order-only, but its row still carries the whole-Home 1.5 s bar (that's H4's). Close H3 on its
order slices (469841245c, efce5d5324, 9d6f78f19d) and keep the timing bar on H4? Recommend: yes.
**Question (Nalati herds):** herd clocks run fast when thinks stagger; tick once per 0.1 s per herd (paths change)? Recommend: yes.
**Question (cold crossings):** fewer material variants (look, G717.O3.5b): A / B board per shard? Quantize Nalati's big meshes
(colour Uint8, normals Int8): ~5-6 MB less upload, colours within 1/255? Recommend: yes to both.
**Question (crossing instrument):** cold on the Sim: Nalati 6.65, Pine 7.42, DW 5.48 s (all < 8); Chromium 4x DW 7.50 (passes), Nalati 10.9, Pine 14-15 s
(G807's instrument). Close on the Sim? Recommend: yes; Chromium 4x guides slices.
**Question (Pine cold, reopens T7.7):** build data-only parts (parse, placement rows; no scene / lights) once the approach is
verified, dropped on a turn-away? Saves <= 2.5-3 s of the 15.7 s held span. Recommend: yes.
**Jake picks open:** D183 / D185; LD5-LD8 / A1 / A2 / M2 / RM13; DW -7 MB board (round-21-phone-geometry-ab).

**FYI Jake:** Pine white ground and teal tree cards (D189) and the slow-link Pine crossing (D190 / D196) are fixed and live.
**T10 official Sim frame floor (8409c015d5): 13 / 15** (was 11). Fails: spawn p95 39 / max 63, Pine drive 42 / 95 ms; Nalati
drive / standing pass now. Native memory is under 1.2 GB (1.07-1.11 GB).
**Question (T10 spawn):** p95 39-43 ms is post-boot settling (GC, GPU backlog), 33 / 34 settled. Sample after a settle? Recommend: yes.
**Question (RM8.1e):** all 24 products and tile caps pass at 35281b4d8e. The codec (850a6efb5f) has no per-shard pixel A/B,
only RM13's look board. Accept on the existing looks, or wait for an Opus witness after the morning switch? Recommend: an Opus witness.
**Question (D53):** 8 Pine / Nine manual CLIs import Node I/O: new confined SDK author-command host, or debt until HOST-AUDIT? Recommend: debt.
**Stated misses:** H4 warm home 3.74 s, A1 770 ms (first-time work); I2 18 / 24 meet both bars, floors DW 30.8, Nine 19.2,
Nalati ~55, Pine 77.5 MB.
**Lanes (G818: 95 %, all Opus released 02:00):** sp-x1 + sp-x9 Explorer-after-play stall (cache contention); D53 / D94 split
x6 Pine, x8 Nine, x10 Nalati, x2 rest; sp-ci-deploy release.

**Rules:** G704. G807. G818. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
