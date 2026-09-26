# Nine Dragon Stack — round 1: concept art (E169)

Nine AAA concept / key-art frames for shard 4, **Nine Dragon Stack** (九龍疊城), plus a contact sheet. They follow the
shard brief as revised on 2026-09-25: the shard is a **500 × 500 × 500 m cube**, running from the Sump at −250 m to the
Crown at +250 m, and you spawn on Lantern Square at +125 m.
These are painterly-realistic production concept art, not in-game screenshots: no HUD.

- **Engine:** every frame is codex `image_gen` (OpenAI, cloud), run headless through `scripts/horizon-matte/run_codex.py`.
  None needed the local Qwen fallback.
- **Size:** 1672 × 941 (16:9) each, JPEG q82 (PIL, progressive).
- **Re-roll:** the file shipped here is the best take. "r1" / "r2" is the prompt pass it came from, and the Notes column
  says what that pass fixed.

| File | Shows | Engine | Re-rolls | Notes |
|---|---|---|---|---|
| `01-key-art-slab.jpg` | The whole cube floating over a sea of clouds and karst peaks at blue hour, seen from the grid highway (tiny cars). The lower half is carved rock with stilt houses, waterfalls and a monorail leaving a tunnel portal. The upper half is a Kowloon megablock with neon strata bands, cable cars, a cargo drone and the antenna Crown. | codex image_gen | 2 (ships r2) | The first take read as a floating island, with building-sized neon characters and big cars. r1 got the cube but came out grey. r2 has the cube read, a rock half as tall as the tower half, small signs and vivid colour. |
| `02-section-nine-strata.jpg` | A side-on cutaway of all nine strata. It shows the LED sky screens on each ceiling, fog, the Yamen Well down the centre with the yamen on Old Street, the flooded Sump, the Shelter Market, the Rail Cut and the Crown with its VTOL pad. | codex image_gen | 0 | Every label matches exactly: "9 THE CROWN +250 M" … "1 THE SUMP -250 M", plus "★ SPAWN" beside stratum 6 and "YAMEN WELL" on the shaft. The ~12-floor housing bands between strata are thinner than to scale. |
| `03-lantern-square-spawn.jpg` | The spawn plaza at eye level, blue hour, wet flagstones. A neon-outlined paifang gate reads 九龍疊城, beside a banyan with red ribbons, a shrine, mahjong players, a noodle stall with steam and a scooter. On the right a carved balustrade stands over the Well, with balconies falling away into fog. Overhead: a monorail, skybridges, LED sky-screen panels and a violet sky strip with a drone. | codex image_gen | 0 | Matches the brief's spawn section almost point by point. |
| `04-yamen-well-vertigo.jpg` | Looking straight down the Yamen Well from the Lantern Square balustrade. Brass dragon hooks sit on the rail with a red lantern. Five or six stacked fog layers run down to the tiny yamen roof and a jade glow, and a red cable car crosses the shaft. | codex image_gen | 1 (ships r1) | The first take was a good image but too shallow: the yamen was large. r1 sells the 375 m drop. |
| `05-the-crown-rooftops.jpg` | The Crown at dusk. A heavy cargo drone with a slung container flies low over the roofs (the Kai Tak homage), with pigeons and coops, a kid flying a kite, a grandmother at a rooftop garden and shrine, laundry, water tanks, a VTOL pad and antennas. The sea of clouds lies below the edge. | codex image_gen | 0 | A distant skyline sits on the horizon (read it as neighbouring shards). The drone flies a little higher than "skimming". |
| `06-shelter-market.jpg` | Shelter Market (−150 m): a rock-carved air-raid tunnel painted 防空洞 4號 with wartime slogans, now a hotpot hall and market. Steam, red lanterns, neon, crowds, and LED sky panels bolted to the vault. | codex image_gen | 0 | — |
| `07-old-street-alley.jpg` | An Old Street alley at datum 0: a noodle works with drying noodles and flour sacks, a dentist sign with a tooth, 旅館, 麻雀, dripping pipes, a shrine, steam and puddles. A lone hooded figure walks away, and a slice of LED sky-screen ceiling shows far above. | codex image_gen | 0 | — |
| `08-weapon-neon-jian-fei-zhua.jpg` | A prop sheet on charcoal. The Neon Jian is shown in profile and in 3/4: a cyan heat edge, circuit and cloud-scroll etching, a brass dragon-head guard, a lacquered grip, a red tassel and a fu talisman. The Fei Zhua is shown closed (talons folded) and deployed: a three-talon claw on a glowing line. Labels "NEON JIAN" and "FEI ZHUA". | codex image_gen | 1 (ships r1) | The first take's deployed claw read as a two-pronged anchor. r1 shows all three talons. |
| `09-cast-lineup.jpg` | The cast lineup on a wet street: the Tong enforcer (magenta visor, lacquered plates, dao), a cyborg Jiangshi (Qing robe, QR-code talisman), the paper-crane drone, a cyber-cat, and behind them THE WELL DRAGON, a serpent of linked red cable-car cabins coiling up the Well. | codex image_gen | 0 | Labels exact: "TONG ENFORCER", "JIANGSHI", "CRANE DRONE", "THE WELL DRAGON". |
| `contact-sheet.jpg` | A 3 × 3 sheet of all nine, uncropped 16:9 tiles, each labelled with its number and name. | — | — | — |
