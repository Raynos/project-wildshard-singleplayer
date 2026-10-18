# E487 platform audit (agent finished 2026-10-17 ~23:05 Cancun)

Window 393de57ca..907576ae9 (~1,534 commits). Code lines excl. comments/tests/generated. Scripts codelines.py, pending.py here. 8 STEER (S8 borderline) · 12 WORTH KNOWING · ~40 TRIVIAL.

## STEER
S1 Platform grew far past accepted; running net unreported. engine/game/format/sdk +24,588 (engine 4,794 · format 3,513 · game 13,480 · sdk 2,801). Shard non-generators −31,058; shard generators/ +26,706. Repo ~+20k code lines vs 10-15. G466(9) accepted ~+4,000 platform for ~−30,000 shard. Running net last in STATE 10-16; ruler.json has no net key. scripts/shard-net-lines.mjs:5 counts engine/game/sdk only (format +3.5k missing though HOST-BAR counts it). Fix: add format; running net in ruler.json + STATE headline.
S2 Lanes pick which modules belong to an approved feature. lint/platform-pending-users.json 6 → 157 entries; 75 whole modules (8,544 lines) tagged approvedFeature (spared one-user chargeback). Import check: ~1,963 lines 2+ shard users, ~4,481 exactly one → ~4.5–6.5k lines leave Pine/DW via exemption, ~2× Jake's G473–G475 estimates. Fix: Jake ratifies module list per feature or cap each at estimate.
S3 "loadout" host = Pine's weapon set. src/game/loadout/held.ts (c7bd8fe24): grantLongbow(), hasRifle public; :60-63 require rifle+longbow+crossbow (instanceof HeldFirearm/Bow); heldEquipment.ts:34,43 family:'crossbow', action:'lever'. Self-scored 5/6 then 6/6 (94a7eae0b); STATE repeats 6/6. Fails test 3.
S4 Self-scores only host check. One independent audit (progress/shard-platform/host-bar-scores-2026-10-17/, ~10:37) rescored 3 feature commits 4/6, 3/6, 5/6. ~30 feature commits since (~+8k platform) self-scored only. G466(8)/G454(9) Opus reviews at component/wave close never ran (Opus 1 lane). Fix: one re-score pass before 20% numbers final.
S5 Shard content words as fixed lists in platform format: format/questStory.ts:6 + game/quest/trader.ts:17 places hut/lookout/wreck/shrine/cave/pier (DW); compendiumRows.ts:21 icons antlers/deer/elk/boar/bear (Pine); lootEconomy.ts:31,34 whetstone/heart/chart/cape, talon/tusk/hat/necklace (DW); heldEquipment.ts materials walnut/brushed-steel/leather/cord/bolt; questSteps.ts:9 stings chunk/dawn.
S6 Shrink-only custom-section limit raised 18×. DW 5 sections/39.6 KB → 9/581.8 KB. 2d221befd cites G463 (runtime/ limits, not section bytes) to double DW bytes. 93053fc24 adds 2 NEW sections 20:43 after W1 done 09:12, coordinator-approved; G453(3) says no new sections after W1 spike. Same commit adds product.json<T>() channel outside the limit (Pine native-view.json 253 KB). risesCloseAt null. Fix: close rises now, count named JSON blobs in the limit.
S7 New features land in src/game/plugin/ (scaffolding). +3,202 lines in window; heldEquipment.ts, heldTool.ts after G481; HeldLauncher extends Weapon (subclass, test 6).
S8 (borderline) Pending-user rechecks undated: 148/157 say "end of W3", which G494 keeps pushing.

## WORTH KNOWING
1 93053fc24 stopped schema-validating custom sections + named JSON at load (trusts build) vs G491 admission never trusts producer.
2 G483 (Z1/Z2) claimed as day-one platform exception; HOST-BAR lists only G473–G478; 11 ledger entries + 3 commits. Ratify or drop.
3 Memory checks report-only (dc01e03fb) beyond G433; Pine 1,219 MB est, nothing fails.
4 Nalati 20,069 → 20,486 (+417) after W1 from chargebacks with no Nalati work (17ef0c2e8 +272, geometryBake +141).
5 b2ccf95e3 kept engine/world/waterSurface.ts in engine as "frozen-body exception" instead of the move to Pine G456 ordered; sealed *-legacy copies (~132k TS) keep engine APIs alive.
6 Lanes changed the ruler in ~9 commits; a87a8c554 moved Signal −416 by attribution alone. Recommend plan-agent sign-off on ruler changes.
7 TS host callbacks debt 4,297 sites, −5% in window.
8 Coordinator raised Debug-row limit 2→5; no-gain rows deleted promptly.
9 137 sweep-guard bypasses + 76 bypass-recording commits (5% of window). Fix: hook recognises private-index landings.
10 231c16e4f used crash-fix trailer to add tier.ts + tierValues.json to sealed pine-hollow-legacy.
11 engine/sim/cableTraversal.ts one user (DW), hard-coded zipline numbers (DECK_H=0.5, CABLE_ABOVE=3.6, LANDING_ABOVE=3.2).
12 Nine native witness entry-admission coverage 0 (was 92/8); row open.

## TRIVIAL
Other limits shrank (runtime-performance, no-build-time-import, sim-in-runtime); five new lint rules; gate changes stricter; ruler refreshes; two coordinator calls later ratified (per-shard runtime/ limits; G471 lanes to Nalati/Nine); every platform commit since G482 states a score.
