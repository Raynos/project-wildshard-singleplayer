# Nine Dragon portrait grapple trailer — review cut

**Status:** Ready for visual review, 2026-09-26. This is a trailer cut, not a claim of iOS performance parity.

## Watch

- [15-second 1080 × 1920 trailer](nine-dragon-portrait-grapple-final.mp4)
- [Full-cut contact sheet](contact.jpg)
- [Grapple beat contact sheet](grapple-contact.jpg)

The 9.00–11.67 s beat was recaptured from clean export `f5f4d5cd` after the Fei Zhua rope, FX, landing, and three-talon flying proxy landed. The shot shows fire, the filament crossing the Well, the pull, and lower-street settle. The flying claw is small at trailer scale and needs Jake's visual judgment. Shots outside this beat and the AAC soundtrack come from [round 19](../round-19-portrait-grapple/README.md). The soundtrack's encoded packets are byte-identical to that cut (MD5 `58cc8ccca6b5f8fdde7e838d4d911ecc`).

## Evidence and reproduction

- [Source commit](source-commit.txt), [capture metadata](capture-meta.json), [one-beat EDL](grapple-edl.json)
- [Fire frame](source-fire.jpg), [filament frame](source-filament.jpg), [settle frame](source-settle.jpg)
- Clean export was built with `git archive` and `vite build`, then served by `vite preview` on port 5190. `scripts/steam-trailer/capture.mjs` captured `nd-grapple` at 1080 × 1920, 60 fps, two subframes per output frame, scale 2. The capture reported zero browser errors. The shot was conformed with `scripts/steam-trailer/edit.mjs` and spliced into frames 540–699 of the prior master; the original AAC stream was remuxed without re-encoding.
- Final probe: H.264/AAC, 1080 × 1920, 60 fps, 900 video frames, 15.018 s container duration, 36.9 MB.

The cinematic capture uses the trailer harness's desktop render tier in a portrait viewport. Live iOS PWA frame rate and memory require separate phone testing.
