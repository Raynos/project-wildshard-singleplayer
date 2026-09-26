# Nine Dragon Stack — round 3: art styles (E169)

Jake: "How are you going to do a fully custom art style for this? Do research in what would be the most insanely epic
and wow." The same spawn frame (Lantern Square, +125 m) shown in six render styles. Only the style changes. The
composition, the weapon (Neon Jian right hand, Fei Zhua grapple left forearm), the Yamen Well drop on the left and the
phone HUD (navy glass, cyan hairlines, the shard-4 additions) are the same in all six. Each image is a codex
`image_gen` edit of a real iPhone print-screen of the game (`ref-hud.jpg`, 2026-09-25). Prompts: `mkjobs.py` +
`extra-r2.json` / `extra-r3.json` in the session scratchpad. Re-rolls moved the style paragraph to the top of the
prompt, added a harder push, and listed what the first take got wrong.

**Decision board:** [`board.jpg`](board.jpg). The six frames in two rows of three, labelled A–F.

| File | Style | Engine | Re-rolls | Verdict |
|---|---|---|---|---|
| [`A-ink-neon.jpg`](A-ink-neon.jpg) | **Ink & Neon** (水墨霓虹): shanshui ink-wash on rice paper; only the neon, the lanterns and the gate in colour | codex `image_gen` | 1 (take 1 was a timid, detailed grey illustration; take 2 kept) | The most striking and the most original: bare paper where the fog is, splashed ink on the flagstones, a calligraphy inscription with a red seal on the left. The Well reads as paper mist more than as a drop. The HUD is crisp on the light paper. |
| [`B-gongbi-blue-green.jpg`](B-gongbi-blue-green.jpg) | **Gongbi blue-green** (工笔青绿): ruled-line jiehua architecture, flat mineral colours, silk | codex `image_gen` | 1 (take 1 came out as an anime background painting; take 2 kept) | Gorgeous, and clearly a Qingming-scroll city: auspicious-cloud (祥云) bands in the Well, Qingming-style figures. The neon is muted to gold, so it reads more "classical" than "cyberpunk". |
| [`C-chungking-express.jpg`](C-chungking-express.jpg) | **Chungking Express**: Wong Kar-wai / Doyle film, fluorescent-green cast, halation, step-printed smear | codex `image_gen` | 2 (takes 1 and 2 were too clean, too close to F; take 3 kept) | Moody and cinematic: green cast, red halation, a smeared scooter, the Well drop clear in green fog. The frame is still realistic, so it is F with a grade, not a whole new art style. |
| [`D-shadow-theatre.jpg`](D-shadow-theatre.jpg) | **Shadow theatre** (剪纸 / 皮影): backlit paper-cut and leather-puppet planes | codex `image_gen` | 2 (takes 1 and 2 were realistic paintings; take 3 kept) | Only half there: backlit black silhouettes on amber, a lacy cut-paper banyan, puppet-like people and a perforated sword. But it is not true stacked paper planes: codex pulls it back toward a painting. Warm and unique, the weakest execution. |
| [`E-neon-woodblock.jpg`](E-neon-woodblock.jpg) | **Neon woodblock** (年画 / risograph): carved keylines, flat inks, halftone, misregistration | codex `image_gen` | 1 (take 1 was a detailed comic; take 2 kept) | The loudest and most "poster": pink and teal halftone fog down the Well, gouge hatching, misregistered inks. It works as a style, but the frame is very busy and it would fight the HUD in play. |
| [`F-neon-noir-realism.jpg`](F-neon-noir-realism.jpg) | **Baseline**: AAA neon-noir PBR realism (Cyberpunk 2077 / Blade Runner 2049) | codex `image_gen` | 0 | The cleanest read of the space: a dramatic Well drop through fog strata, a glowing cyan jian. The expected look, and the least unique. |

Ranking (wow × uniqueness × readability): **A > E > B > C > F > D**.
