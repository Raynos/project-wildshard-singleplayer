# Sky Reach top-10 row 10: the shard LUT, second fit (E407)

The first fit (round-29-lut) never ran in round 13 (the capture's build lacked the file) and, measured live, greyed C's sky and pushed highlights past the mockups, so it came out (de148d881). This fit: scripts/fit-lut.py --shard far-reach --regions art/far-reach/round-32-lut/regions.json art/far-reach/round-29-lut/mockups '<round-14 LUT-off frames>/{n}.jpg' (progress/far-reach/20261003-0823-ce11353e mock-* as 1 proposal B, 2 A, 3 B, 4 C, 5 D), with each frame's sky its own region (the first fit pooled them) and proposal B's sky left out (its mockup sky is grey-lavender where C's is warm, the opposite of the game's two; the round-10 ruling has the sky follow A and C). Predicted dE00: storm 3.4, low sky 1.0, isles 5.5, meadow 0.9, sky A 2.4, B 3.3, C 6.1. Then highlights.py eases it back to identity over input luminance 0.72-0.95 (the fit lifted near-white past the mockups: top 1 % 243-246 live).

Measured live (Rec. 709, 390x844; mockup / LUT off (round 14) / this LUT):
- top 1 %: proposal B 238.8 / 239.0 / 239.1, A 238.4 / 239.2 / 239.1, B 240.3 / 236.4 / 236.7, C 235.7 / 240.2 / 239.7, D 241.4 / 231.4 / 232.2.
- upper sky (y 90-250 of 844): A 195/158/140 / 178/146/128 / 190/155/135; C 202/168/148 / 165/144/143 / 181/155/149 (saturation 55 / 28 / 34); B 179/157/147 / 177/147/133 / 189/156/139.
- meadow: proposal B 102/90/64 / 74/63/29 / 85/72/37; A 95/76/42 / 76/62/29 / 87/71/37; B 96/80/50 / 83/69/38 / 94/78/46; C 95/80/43 / 110/80/51 / 120/87/58 (further); D 107/85/52 / 100/79/43 / 112/87/51.

board.jpg: rows mockup / LUT off / this LUT; columns proposal B, A, B, C, D.

board-heroes.jpg (the lead's condition: the LUT must hold away from the frames it was fitted on): h1, h2, h3, h4, aerial-spawn, aerial-overview; top row LUT off (round 14), bottom row this LUT (cap63, also the weathered bridge and greener sward). p99 / share over 230 / mean luminance: h1 238.1 -> 238.5 / 2.2 -> 2.4 % / 99 -> 106; h2 213.9 -> 224.6 / 0.3 -> 0.8 % / 90 -> 99; h3 230.2 -> 231.4 / 1.0 -> 1.1 % / 91 -> 99; h4 228.5 -> 229.5 / 0.9 -> 1.0 % / 91 -> 97; aerial-spawn 236.3 -> 236.5 / 2.3 -> 2.6 % / 131 -> 140; aerial-overview 236.6 -> 236.9 / 3.0 -> 3.4 % / 164 -> 172.
