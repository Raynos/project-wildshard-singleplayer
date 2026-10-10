# G292 Nalati producer rollout

Three declared entry points, nine retained outputs. Report-only; no output or native continuation is replaced.

| Producer | Outputs | Cold ms | Warm ms | Forced ms | Cache key |
| --- | ---: | ---: | ---: | ---: | --- |
| nalati-bodies | 2 | 2140.632 | 3.551 | 4186.645 | `9c8582712cf0f36d4205bab895e164a5ccbf0b151766f0ffd85364f9abde1678` |
| nalati-places | 6 | 4157.789 | 5.562 | 3845.217 | `3d98904ca13362eef1a50c481248c18714829b3414992ebfeeda3a380950c259` |

Bodies and places: Darwin arm64 raw cold/forced output hashes and committed bytes exactly match; warm hits validate
those same hashes. Places uses the real Chromium generator, with its executable digest in the key. Its closure includes
the renderer’s desktop-reference budget import. An initial missing-budget attempt refused publication, then the complete
closure passed. Bodies and places retain their eight files; no Linux bit-exact claim.

Physics: strict comparison REFUSED at preview pin `1090df8a2b5b6b65b251922068c5d9fdd9ea66b9`. The only differences
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
