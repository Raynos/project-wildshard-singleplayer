# G292 Nalati producer rollout

Three declared entry points, nine retained outputs. All three producers are proven cold/warm/forced on Darwin.
Report-only; no output or native continuation is replaced.

| Producer | Outputs | Cold ms | Warm ms | Forced ms | Cache key |
| --- | ---: | ---: | ---: | ---: | --- |
| nalati-bodies | 2 | 2140.632 | 3.551 | 4186.645 | `9c8582712cf0f36d4205bab895e164a5ccbf0b151766f0ffd85364f9abde1678` |
| nalati-places | 6 | 4157.789 | 5.562 | 3845.217 | `3d98904ca13362eef1a50c481248c18714829b3414992ebfeeda3a380950c259` |

Bodies and places: Darwin arm64 raw cold/forced output hashes and committed bytes exactly match; warm hits validate
those same hashes. Places uses the real Chromium generator, with its executable digest in the key. Its closure includes
the renderer’s desktop-reference budget import. An initial missing-budget attempt refused publication, then the complete
closure passed. Bodies and places retain their eight files; no Linux bit-exact claim.

Historical blocker (resolved by `8b144a8d0`): strict comparison REFUSED at preview pin `1090df8a2b5b6b65b251922068c5d9fdd9ea66b9`. The only differences
from its retained capture are `spawns[21].mem._graze` (0.0004400006294250488 vs 0.0004399995803833008) and
`spawns[23].yaw` (-2.498531545425934 vs -2.4985315443768923). These are real actor continuation fields, not provenance.
The baker’s RAF first-sight observation sees actors after a small live-clock update; it already documents the shepherd’s
one-frame heading exception. No tolerance, rounding, seed substitution or continuation exclusion is added. Physics stays
committed and blocked for a deterministic first-sight capture fix; the cache and old payload are not presented as a proof.

Initial bodies/places run: the missing budget was explicit. Physics independently captured equal repeated reads inside
one boot before the retained-data mismatch, then closed all browser resources. Additional strict warm/forced results
are recorded below. No full suite, runtime/collider change, witness refresh, or output removal.
Warm capture comparison also refused the retained continuation difference. Fresh forced generation then refused
`Regenerate-and-compare failed: nalati-physics`: separate cold boots are not raw-byte deterministic, even on the same
Darwin preview/binary. This is an unresolved producer issue, not a cache hit or a passed cold/warm/forced proof.
The existing valid cache was preserved; the failed staging output was discarded. Body/place checks and runner strict/lint
are green (11 focused tests). All browsers/leases closed. Fix first-sight actor timing before using this job to remove
or replace the committed physics payload.

## Deterministic first sight

The browser init now selects the existing capture clock before bootstrap: a fixed 0.1 ms boot quantum observes
the initial actor roster before a 60 Hz motor step. It preserves every first-sight position, heading and memory field;
no tolerance, rounding or exclusion is used. A 60 Hz experiment advanced the shepherd before first sight and was
rejected by the unchanged tick-zero roster tests. The shipping live clock is unchanged.

At preview `90932bd93b0531b672f8e238d047b9dc8883f0e7` (same application bytes; final producer helper supplied by Node),
two independent cold Chromium processes produced identical complete bytes. The shared producer cache then passed
cold (7304.44 ms), warm (2.07 ms) and forced cold regenerate-and-compare (7377.39 ms), key
`83d5a9df6b68e4319b6890e4c3c496ee5d3dfa31671555b6b0c57529c16451b3`. Output SHA-256:
`3196eaa4fb068c8eca3e6973379781fdfa64354e7607b625fad7f03b0a156381`.

Compared with the previous capture, only two gameplay fields change deliberately: `spawns[21].mem._graze` becomes
`0.00022000000000000003`, and `spawns[23].yaw` becomes `-2.498311544796509`. Collider/floor bytes, every placement,
actor identity, other memory, group state and grass observation are unchanged. The fixed boot-clock/first-sight tests,
existing native roster/raid/elite/restore tests and strip-only compatibility process are checked without relaxing assertions.
All browser leases close after capture. This resolves the physics producer blocker; outputs remain committed pending
the separate build-time retention rollout.

## Runner re-proof after the first-sight fix

At committed preview `8b144a8d09283b34b19c4e8cc2aacef8bb68a539`, the shared runner passes retained gameplay comparison and
complete cold/forced cache hashes exactly. Warm hits verify the same output hash. No nested actor/clock exclusion
is added. The former BLOCKED physics producer is now **proven on Darwin arm64**; Linux remains unavailable for
this normative browser capture. All nine retained files stay in git.

| Producer | Cold ms | Warm ms | Forced ms | Cache key |
| --- | ---: | ---: | ---: | --- |
| nalati-physics | 10822.423 | 2.872 | 9383.7 | `4da3665f3589b5d1f5e5b3224fba782715eda91e0188971601ffe506e17578cd` |

Both fresh browser processes and their lane leases closed. No Simulator, full suite, continuation rebake or output
removal was needed for this re-proof.
