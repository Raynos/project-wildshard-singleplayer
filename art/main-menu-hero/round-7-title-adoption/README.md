# G744 · Approved 5×5 title hero

Jake approved the [round-6 retake](../round-6-nalati-terrain/README.md).
The title now uses those square and landscape views at its existing
`main-crossroads-square.jpg` and `main-crossroads-landscape.jpg` paths.
Only the 65-pixel evidence caption was removed from each source; the
remaining 1120×1120 and 1120×630 views were encoded as quality-88 JPEGs.
Their shipped sizes are 216,862 B and 131,510 B, both below 250 KB.

The HTML first-paint shell reads the same square/landscape paths. Its
native iPhone startup image was regenerated with the original 62-pixel
status-area inset and unchanged layout. Lossless PNG compression keeps
the 1206×2622 image at 1,625,877 B, below the prior 1,627,294 B exact pin.
The startup link and storage pin name the new content hash together.

Source commit: `1873e9ca2cb4a3843266e4cfc9f38a4a27e45a6e`, pushed to
`origin/main`. Its pinned production preview built in 57 s as
`1873e9c-mvpowzf8`.

The [HTML first paint](html-first-paint.jpg) and [mounted title](title-phone.jpg)
were captured from that exact preview as iPhone 16 Pro: 402×874 CSS pixels,
3× pixels, mobile/touch user agent and its automatic phone tier. The browser
was muted. Only the application's exact entry script was blocked for the
first-document screenshot; the block was removed before reloading and
capturing the actual title. Both surfaces select the same square URL, whose
observed response body is 216,862 B. The title's hero is 402×402 CSS pixels,
the launch shell is gone after mounting, and page errors are empty.
No layout, card, button or setting was changed for these captures.

All four original first-paint tests pass after the separate shared-discovery
restore. Named typed lint and native-image generation pass. Three earlier
working-tree preview refusals are retained: the Open Plots trim input and two
foreign source snapshot changes. The coordinator moved the capture to an
exact committed preview instead of weakening those guards. Browser and owned
preview are closed; no timing, frame-floor or memory acceptance is claimed.

[Native startup artwork](native-startup.jpg) shows the generated image;
it is not an iOS launch-timing or memory measurement.
