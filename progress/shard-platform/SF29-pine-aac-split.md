# Pine AAC frame split — exactness refused

2026-10-11. **OPEN / stopped:** independent lossless packet recordings do not
preserve the original decoded PCM on the tested FFmpeg and Apple decoders.
Original sound bytes, playback, cue data and the 25 MB cap are unchanged.
No candidate recordings were admitted or shipped. No re-encoding was attempted.

Source: `public/assets/sfx/pine-hollow/oneshots-362ce515.m4a`, SHA-256
`c2e8552892361aff20e4355c58f800ce5fd64c68367e8a219447ef7a49cac679`.
Mono AAC-LC, 48 kHz, 7,494 packets. Admission charges **30,695,424 bytes**.
FFmpeg 8.1.2; decoders `aac` and Apple's `aac_at` (AudioToolbox).

The retained diagnostic copies each encoded access unit verbatim into ADTS,
without an encoder. Repeated original-file decodes are byte-identical. The full
ADTS decode, after the original 1,024 priming samples, is byte-identical to the
M4A decode on each decoder separately. Those controls exclude a container,
priming, sample-count or unstable full-decode explanation for the mismatch.
FFmpeg's full PCM SHA-256 is
`6e43460e30264a29569c38742c977f0472f018569476239508edc7cc6d9172a8`;
AudioToolbox's is
`6d6422860908fab25b182c6d90f96b218736599b07a33faa45f94fb424ea03fa`.
Different decoders are never compared against each other for exactness.

Split at packet **3,711**, playable time **5936/75 seconds**: in the silence
between ranger takes, with no cue straddling the boundary. All **84** authored
cue offsets/durations round-trip exactly as rational values after rebasing.
The first recording requires 15,200,256 decoded bytes. Results for the second:

| Preceding packets replayed then trimmed | Decoded bytes | FFmpeg differing samples | Apple differing samples | Changed cues |
|---:|---:|---:|---:|---:|
| 0 | 15,495,168 | 1,305,851 | 1,158,564 | 41 |
| 1 | 15,499,264 | 1,304,827 | 1,158,564 | 41 |
| 16 | 15,560,704 | 1,304,840 | 1,157,425 | 41 |
| 2,320 (largest prefix within cap) | 24,997,888 | 1,304,819 | 1,158,959 | 41 |
| 3,711 (entire original prefix) | **30,695,424** | **0** | **0** | **0** |

The mismatch persists well after the seam: with one replayed packet, FFmpeg's
first changed sample is 28,672 samples after the cut, and its last is 3,852,287.
A previous-frame overlap repair therefore does not establish exactness.

AAC perceptual noise substitution is decoder-stateful. FFmpeg's defining
[8.1.2 decode loop](https://github.com/FFmpeg/FFmpeg/blob/n8.1.2/libavcodec/aac/aacdec_proc_template.c)
advances persistent `random_state` for noise bands;
[decoder initialization](https://github.com/FFmpeg/FFmpeg/blob/n8.1.2/libavcodec/aac/aacdec.c)
seeds a fresh instance. The long-tail mismatch is consistent with resetting
that state. A frame/container copy carries encoded bands, not a portable
snapshot of that decoder state. The Apple control independently demonstrates
that the required PCM restart identity also fails there.

This is a failed exactness proof for stock independent-recording decoding,
not a claim that every imaginable custom decoder or every boundary was tested.
The positive control replays the original prefix but exceeds the unchanged cap;
there is no qualifying split to adopt. Continuing would require a different
state-preserving streaming contract, outside this authorized packet-copy change.

Reproduce (temporary encoded/PCM files are automatically removed):

```sh
python3 scripts/audio/prove-aac-packet-split.py \
  public/assets/sfx/pine-hollow/oneshots-362ce515.m4a \
  public/assets/sfx/pine-hollow/sfx.json --split-packet=3711
```

The command refuses unexpected format, timing, priming, crossing cues, unequal
sample counts or failed full-decode controls. It prints per-case hashes and
counts; no raw PCM or evidence archive is committed.
