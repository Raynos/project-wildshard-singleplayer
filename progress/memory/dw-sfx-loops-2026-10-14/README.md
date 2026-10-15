# Loop-only PCM storage

The four Driftwood/common loop buffers retain the same float32 samples, channel
order, rate, loop duration and random seek. Only unused intro/outro PCM goes;
128 original samples on either side protect native interpolation. No encoding,
resampling, streaming clock, gain or crossfade changes. One-shots stay full-file.
A separate bounded weak content/bounds cache preserves cross-resident sharing.

| Loop | Original PCM, B | Compact PCM, B | Saved, B |
| --- | ---: | ---: | ---: |
| Underwater | 8,448,000 | 4,610,048 | 3,837,952 |
| Pickup | 3,936,000 | 2,306,048 | 1,629,952 |
| Island | 6,240,000 | 4,994,048 | 1,245,952 |
| Shrine | 3,744,000 | 2,306,048 | 1,437,952 |
| Total | 22,368,000 | 14,216,192 | **8,151,808** |

Measured using the actual shipped AAC recordings decoded in Chromium's native
OfflineAudioContext. Every retained sample is identical. Two seek phases and
multiple wraps produce bit-identical 48 kHz output. At 44.1 kHz the native
resampler's changed origin produces at most 9.0153e-7 amplitude difference;
this is reported, and explicitly accepted as inaudible by the coordinator.
The receipt includes every case. Three behaviour tests cover PCM, repeated
sample sequences, independent ownership, fractional-cut retention, compact
content sharing and the untouched full-file decoder entry. This is decoded
PCM capacity, not a claimed native WebContent footprint reduction.
