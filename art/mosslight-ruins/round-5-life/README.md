# Mosslight Ruins · round 5 · life at the road entry (OB6, bar 7)

[Before / after board](board.jpg). sp-x1's live check (`scripts/open-plots/life-capture.mjs`, road entry, iPhone 16 Pro,
muted) found one source: a firefly by a ruin, blinking to black half the time. `3f18b9d190` adds emerald motes off the
tower's south window rows and crown (`landmark.motes`; Glow, which the coarse tiles keep) and moves the court motes to
the glow graph's steady mode, lit emerald by a little vertex blue. Named regions: tower motes 166-189 px per 500 ms
(0 before), court motes 102-145 px.

## From the road (`board-road.jpg`, bar 1)

Past 150 m the tower drew as its coarse stand-in in the kit's standard material: a black block from the road entry.
`acc0a955d6` sets the row's `coarseLandmark: "lit"` (as Ember Forge and the Night Market), which draws it in its landmark
graph, so the road sees mossy stone with its emerald motes. The four plaza L1 tiles draw 3 instead of 2 (approved,
wildshard-new); the phone wire falls to 8.15 MB of its 8.22 MB ceiling.
