# Desktop AO warm-up regression fixed

Exact served committed SHA: `32cde805434270f8ab04091082bfc6b6fcc3c733`.

| Case | Wall / stages s | Network / display MB | Byte error | Detail gap ms | First frame |
|---|---|---|---|---|---|
| Desktop grid, AO present and enabled | 11.4 / 11.391 | 179.420 / 179.433 | 0.0075% | 174.1 | pass |
| iPhone 16 Pro Chromium CPU 4x, SHARD SELECT | 26.6 / 26.640 | 175.607 / 175.537 | 0.0401% | 352.7 | pass |

Both real title entries are muted and use the real 5 x 5. The phone's labelled
portrait was viewed. The desktop receipt reads the actual AO presence/enabled
state after probe publication and a subsequent real renderer frame. An earlier
assertion ran during the loading fade, before probe publication; its false
missing-AO result is not accepted or substituted for this corrected proof.

`b2e4c86d92` warmed raw post materials before desktop N8AO had bound its
sample arrays. Three's uniform-array flattener dereferenced the first absent
vector (`toArray`). The forward fix leaves those materials linked but omits
unsafe optional draws until the actual pass initializes its own values. It
never invents sample data, advances effects or disables AO; only completed
stand-in draws count toward the warm-up counter. The real N8AO regression
and all six post tests plus strict lint pass. Root tsc passed on the fix.

The original shader source batch on `49c39e9232` passed in 833.2 s but used
phone-tier first frames and missed desktop AO. Its queued entry matrix was
cancelled before launch when the desktop regression was reported. A single
new source batch on the forward fix is pending. Carrier owns the push.

This urgent release-blocker proof does not close the remaining native warm
cache or O5 acceptance. Those retain the earlier failures and receive their
own corrected cold/warm served receipts.
