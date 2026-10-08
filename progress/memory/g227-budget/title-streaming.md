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

## Bounded decode / window foundation

A continuous MediaSource AAC timeline was also tested (copy-remux, appendWindow / timestampOffset splice, no JavaScript seek). It [failed waveform parity](title-stream-foundation/title-stream-piano-mse2-probe.json); the prior [setter-order setup failure](title-stream-foundation/title-stream-piano-mse-probe.json) is preserved too. No stream implementation has shipped.

The native WebCodecs AudioDecoder comparison **does** pass: exact compressed AAC packets, at most8 packets queued,1024 output frames per callback,1024 codec-priming frames discarded, each AudioData closed immediately. Whole-file PCM exists only as the diagnostic reference. Exact WebKit results:

| Title | Compared interleaved samples | Max / RMS difference |
|---|---:|---:|
| [Piano](title-stream-foundation/title-codec-piano-probe.json) | 5,980,160 | 0 / 0 |
| [Folk](title-stream-foundation/title-codec-folk-probe.json) | 6,336,486 | 0 / 0 |
| [Orchestral](title-stream-foundation/title-codec-orchestral-probe.json) | 4,399,042 | 0 / 0 |

The [native-window experiment](title-window-probe.mjs) copies at most0.5s plus guard samples into each short AudioBufferSource. A compact source holds the loop head and tail, with native loopStart / loopEnd performing the seam; the sources feed the unchanged AudioParam fade. Explicit absolute stop times prevent a duration-rounded overlap. **The [actual piano seam + fade](title-stream-foundation/title-window-piano-probe.json) passes exactly at48kHz and96kHz output (384,000 / 768,000 samples; max/RMS0).** The largest window is24,064 source frames, stereo192,512 bytes. This is a scheduling proof, not a complete runtime or a proved peak-residency bound: the offline diagnostic schedules all future windows.

Important exclusions:44.1kHz resampling and nonintegral source-sample loop cuts [fail](title-stream-foundation/title-window-stop-probe.json), as does [duration-based stop scheduling](title-stream-foundation/title-window-probe.json). They must keep the existing decoded path unless separately fixed. A safe initial runtime candidate would require an unpaired track, integral loop cuts, a48kHz live context, validated AAC packet indexing and supported AudioDecoder. Unsupported / rejected conditions must retain the original path, not modify the loop or tolerance. Decoder exactness alone does not prove scheduling correctness.

## Strict packet reader (no playback activation)

The defining [aacIndex.ts](../../../src/engine/audio/aacIndex.ts) now accepts a bounded, deliberately narrow M4A subset: one unfragmented, self-contained 48 kHz stereo AAC-LC track, one contiguous chunk, a rate-one priming edit, fixed1024-frame packets except the final duration. It rejects ambiguous / encrypted / unsupported layouts, oversized inputs, overflowing packet tables and out-of-media references before publishing compact packet metadata. Limits are32MiB compressed bytes,16384 packets and128 visited boxes. The caller owns compressed bytes; the index retains no input buffer or PCM. Unsupported inputs can keep the existing whole-file decoder when the future backend is integrated.

The18 focused tests cover actual shipped files, offset views, owned metadata and malformed input. The [independent ffprobe oracle](aac-index-proof.json) matches **all8165 compressed packet offsets, sizes, presentation timestamps and priming edits** across the three title recordings. Packet metadata is23,373 /24,765 /17,197bytes. This is a reader primitive only: no boot selection, decoder, playback or native saving changes. The production alternative was reviewed and approved before this step; live integration remains behind Memory saver and requires exact output plus three cold native runs per side.

All diagnostic browsers/servers are closed, no live sound was emitted, and no production assets or playback changed. The bounded source / validated demux and lifecycle integration remain open before a3-cold-runs-per-side native candidate can exist.

Next acceptable candidate must preserve the interior seam and the existing AudioParam crossfade, use a bounded decode/streaming window, and pass a recorded-output comparison before any production switch or native saving claim. A small bridge buffer plus a seek does not automatically fix decoder/output timing; no credit is booked. A passing source candidate then needs≥3 cold native boots **per side**, median and min–max spread, at Pine centre. The original audio ownership fix and its no-credit single native comparison remain in [audio-title-retirement.md](audio-title-retirement.md).

Plan-State: unchanged. Title streaming remains open; this is a rejected implementation receipt, not a completed cut.
