# GLB transport encoding inspection

Candidate inputs are the exact served 32cde80543 Driftwood product. No
candidate replaces shipped bytes. Meshopt is lossless, but its smaller raw
body is larger after Brotli at both measured qualities (6 and 11).

| GLB | Raw input MB | Meshopt MB | Raw Brotli 11 MB | Meshopt Brotli 11 MB |
|---|---|---|---|---|
| Hibiscus desktop | 14.605 | 7.850 | 3.545 | 5.109 |
| Palms desktop | 7.769 | 3.470 | 0.996 | 1.528 |
| Shore rocks | 6.468 | 4.874 | 2.669 | 4.596 |

The live cdff44f21 build serves these same GLB hashes with Content-Encoding
br. One actual GET transfers the 14.605 MB hibiscus body as 3.957 MB; the
CDN's compression quality is not inferred from local candidate sizes.
The local preview's unencoded GLBs remain part of its actual wire counts.
The existing gzip-based meshopt choice also rejects these three candidates;
changing it based on raw byte size would worsen the measured Brotli cases.
O6 stays open for the remaining entry gap. No transport, decoder, content,
quality or admission policy changes in this inspection.
