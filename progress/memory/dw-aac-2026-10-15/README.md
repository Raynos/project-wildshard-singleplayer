# Driftwood paired AAC music

The existing bounded AAC reader now admits mono tension alongside stereo calm.
The real score loader uses it for paired music without boss layers, including
with Memory saver off. A Deck keeps the existing shared start time, independent
gains, bar changes and fades. Both loops round to the same source sample (at
most half a sample). Unsupported native codecs/files or device rates keep PCM.
No music asset or download changed. The two compressed files total 1,190,986 B.

On iPhone 17 Pro Simulator Safari 26.5, the real `decodeStyle` island path used
AAC for **both** stems, at the default native context rate of 48 kHz. No PCM
fallback, scheduling failure or restart occurred during 66 seconds across the
loop seam and two tension changes. Output was muted. Tested audio source
hashes are in `safari.json`; this focused proof reads the shared checkout, not
an exported repo. The commit hook checks the staged source separately.

| Storage / native reading | Full PCM | Bounded AAC |
| --- | ---: | ---: |
| Prepared PCM bytes | 33,444,864 | 5,774,976 |
| WebContent footprint, final ~66 s, all Simulator WC processes | 119,051,448 | 105,305,200 |

PCM capacity falls **27,669,888 B**. The separate fresh-document native AAC
comparison ends at 103,208,144 B. Native footprint is lower, but codec/JIT/GC
costs mean capacity is not a 27.67 MB physical-footprint claim. The final
shipping-loader run retains 7,219,200 B of observed PCM windows at its last
sample, including not-yet-collected ended buffers. All decoders/sources are
scoped; replay reprimes bounded windows rather than retaining full PCM.

The focused behavior fixture reads the shipped stereo/mono M4As, injects a
bounded codec, and checks aligned plans, channels, rounding, short preparation
and transfer of prebuffer ownership. Three existing loop-window behaviors also
pass. Safari/proxy/Simulator were closed afterwards.

This is Simulator Safari regression evidence, not a physical-device or PWA
absolute-cap pass. Grid admission and the G258 runtime claim are unchanged in
this commit; the grid must be measured after landing, not inferred from PCM
capacity. Any claim change requires the matched cold-road G258 protocol.
