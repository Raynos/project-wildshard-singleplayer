# Single-track title streaming: custom loop probe

The base piano / folk / orchestral title slots each contain one full mix, with no tension or extra layers. They do not require paired-stem alignment. They do require the authored **interior loop**: piano27.3995→59.118s, folk15.6735→63.7156s, orchestral14.7911→43.7464s. Whole-file HTML looping would change these recordings’ structure.

The diagnostic [title-stream-probe.mjs](title-stream-probe.mjs) records the real piano AAC through MediaElementAudioSourceNode alongside the current AudioBufferSourceNode loop into a silent AudioWorklet. It begins0.6s before the existing loop end, polls media time every1ms and seeks to loopStart plus overshoot. It estimates **one integer sample alignment before the seam, then keeps it fixed across the seam**; no per-section alignment, gain normalization or time warp hides a gap. Only the diagnostic decodes a full reference buffer; no production source or asset changed.

[Rejected result](title-stream-piano-rejected.json), Mac WebKit / iPhone16Pro context,48kHz, actual AAC SHA256 recorded, pageerrors=[] and all browser/server resources closed:

| Window | Max absolute difference | RMS difference |
|---|---:|---:|
| Before loop | 0.000803016 | 0.000145812 |
| Across loop seam | 0.036299083 | 0.005862123 |
| After loop | 0.174500301 | 0.037218817 |

The timer/seek implementation **fails parity and is not shipped**. Media-element playback remains a good bounded-memory candidate for genuinely whole-file loops, but this probe does not prove a replacement for these interior loops. The W3C [sample-accurate MSE splicing issue](https://github.com/w3c/media-source/issues/37) also records that trimming at coded AAC-frame granularity is insufficient for sample-accurate splice points; an MSE implementation must be proved, not assumed gapless. The [Web Audio source specification](https://www.w3.org/TR/webaudio-1.1/#MediaElementAudioSourceNode) defines routing a media element into the audio graph; it supplies no sample-scheduled seek operation.

Next acceptable candidate must preserve the interior seam and the existing AudioParam crossfade, use a bounded decode/streaming window, and pass a recorded-output comparison before any production switch or native saving claim. A small bridge buffer plus a seek does not automatically fix decoder/output timing; no credit is booked. A passing source candidate then needs≥3 cold native boots **per side**, median and min–max spread, at Pine centre. The original audio ownership fix and its no-credit single native comparison remain in [audio-title-retirement.md](audio-title-retirement.md).

Plan-State: unchanged. Title streaming remains open; this is a rejected implementation receipt, not a completed cut.
