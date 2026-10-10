# Marketing site audit: Codex clean-room (gpt-6-astra, high, read-only), 2026-10-10 (E473)

Brief: the same as the Opus seat ([opus](2026-10-10-marketing-site-opus.md)); 33 WebKit screenshots of the live site (phone 402 px @2x, desktop 1440 px). Merged, verified findings and the rows they became: MARKETING-SITE §9.

**1. Verdict**

This is a coherent, styled indie site, but not yet AAA: repetitive composition, uneven gameplay imagery, and weak visual hierarchy dilute the presentation. It communicates the player-built MMO ambition immediately, but confuses that future with today’s single-player alpha. The code is mostly KISS; the unnecessary parts are abandoned CSS and a live-game dependency in the marketing build.

**2. Bugs**

Reviewed all 33 supplied captures and the requested source. Verification below combines screenshot inspection, source tracing, and in-memory execution with mock storage; production requests and Safari interactions remain unverified. No repository files were changed.

- **Future functionality presented as available:** [COPY.md:70](../../site/COPY.md:70), `phone-home-00.jpg`, `phone-home-01.jpg`, and both press captures promise playing together; multiplayer is only identified as forthcoming near the bottom. Keep the MMO headline, but place **“Single-player alpha available now · Multiplayer and public authoring in development”** beside the opening actions and in both press blurbs.
- **Ideas silently lose text:** [waitlist.ts:106](../../api/waitlist.ts:106), [index.html:305](../../site/index.html:305). Reproduced: 501 characters → HTTP 200 → 500 stored. Add `maxlength`, a visible limit, and server rejection of oversized input instead of truncation.
- **Rate-limit eviction resets active limits:** [inbox.ts:67](../../api/inbox.ts:67), imported by the waitlist. Reproduced: an already-limited IP becomes unrestricted after the table reaches 501 distinct IPs, without time advancing. Evict expired entries without clearing other active limits; use platform-level limiting for protection across instances.
- **Foreign-origin forms can write signups:** [waitlist.ts:86](../../api/waitlist.ts:86). Reproduced an untrusted-origin URL-encoded POST: one stored entry and a 303 redirect. CORS only restricts reading the response. Reject disallowed browser origins before processing; retain rate limiting because origin checks do not stop direct bots.
- **Server accepts cells the form marks occupied:** [waitlist.ts:65](../../api/waitlist.ts:65), [index.html:307](../../site/index.html:307). Reproduced successful storage of `B2`, labelled Driftwood and unavailable in the UI. Validate against the same claimable-cell set.
- **Essential disclaimers fail text contrast:** [style.css:103](../../site/style.css:103), `phone-home-06.jpg` and `phone-home-09.jpg`. The 10px `--faint` notes measure approximately **2.6–3.1:1** against the background. Raise them to at least 4.5:1 and readable caption size; “concept images, not the built shard” must be easy to see.
- **Motion handling is incomplete:** [index.html:61](../../site/index.html:61) autoplays the trailer regardless of reduced-motion preference; lines 331–344 create indefinitely looping phone videos without pause controls. Disable automatic playback for reduced motion and provide a keyboard-accessible pause mechanism for card loops.
- **Submission status lacks an accessible announcement:** [index.html:370](../../site/index.html:370). Success/failure only changes the button label; the existing `#thanks` message is unused by JavaScript and neither is a live status region. Update a persistent `role="status"` message with success or actionable failure.
- **Downloaded press names disagree with the site:** `site/public/press/wildshard-press-kit.zip` → `README.txt` calls the worlds **Far Reach** and **Sunscar Dunes**, while the page says **Sky Reach** and **Signal Dunes**. Generate the archive’s public names and blurbs from COPY.md; currently the ZIP is copied unchanged.
- **Press page has no primary heading:** [press/index.html:36](../../site/press/index.html:36). “Press kit” is an `h2`, with no `h1`. Make it the page’s `h1` with appropriate page-specific styling.

Verified positives: all **232 copy entries** resolve with none unused; both inline scripts parse; all **10 game links** specify `_blank`; canonical, social-image, robots, and sitemap declarations exist. Waitlist storage requests private access, and listing requires a constant-time password check.

**3. Story and structure**

- **The first screen contains the proposition, but the terminal gets first attention on phone.** Bring the MMO/player-built promise above the simulated build transcript; make the action labels “Play the alpha” and “Join the author waitlist.”
- **Use this order:** promise + availability → compelling gameplay → playable shards → how authors will build → author signup → optional deeper explanation.
- **Combine the hero and “What is Wildshard?” repetition.** Keep one world-grid concept image and three concrete benefits. Remove the second frontier painting from the main sequence.
- **Shorten the gallery without shrinking its imagery:** each shard gets its name, one distinctive activity, and its action. The prompt above and description below currently repeat much of the same information.
- **Move the template into author onboarding.** A grey hut interrupts the playable-world showcase; identify the alpha honestly as six authored worlds plus the template.
- **Make Thin Ice a design case study.** “One sentence to a shard” promises a finished result, but the evidence is a plan and concept images. Put that distinction before the images and show two representative stages, with the full sequence expandable.
- **Replace the manifest on the main page with the player consequence:** adjacent worlds, shared identity, shared inventory. Put JSON, WASM, budgets, and wallet architecture behind “How it works.”
- **Move signup directly after the author explanation.** The hero anchor helps, but a sequential reader currently crosses almost the entire page before reaching the form.
- **Combine the timeline and team section into a compact credibility block.** “Two humans” alone adds little; name the builders and show three milestones, with the full history expandable.
- **Keep optional depth, target roughly 7–9 phone screens for the primary story.** Fold installation instructions into the platform FAQ and replace “Coming worlds” with “What could you build?” to avoid implying announced releases.

**4. Look and feel: five highest-value upgrades**

1. **Stage a stronger opening** — `phone-home-00.jpg`, `desktop-home-00.jpg`: shorten the terminal, foreground the promise, and give a player action the dominant image. The current opening spends substantial space on terminal chrome and then repeats Driftwood in the trailer.
2. **Art-direct the shard media as one set** — `phone-home-03.jpg`, `phone-home-04.jpg`, `desktop-home-04.jpg`: consistent crops, stronger foreground action, and sharper loop frames. The soft aerial views undersell riding and traversal; Pine’s boss is cropped at the edge.
3. **Vary the composition** — `desktop-home-07.jpg` through `desktop-home-11.jpg`: interrupt the repeated sticky-left/stacked-right pattern with one broad world panorama and one compact author sequence. Reduce oversized empty intervals while preserving generous spacing around major moments.
4. **Make the claim map feel like a world** — `desktop-home-13.jpg`, `phone-home-13.jpg`: put small biome images in occupied cells, distinguish open territory clearly, and show the selected coordinate in readable text. Keep native radio inputs underneath.
5. **Make the press page an asset shelf** — `desktop-press-00.jpg`, `phone-press-00.jpg`: add screenshot thumbnails, a compact factual summary, and clearly grouped downloads. A large text box with a logo does not visually demonstrate the promised press kit.

**5. Code: KISS / ponytail**

- **Delete approximately 68 dead CSS lines from the 443-line stylesheet:** unused map/ink, facts, ritual, road/log, old trailer-button styles, associated desktop overrides, and the unused pink accent. Examples: [style.css:131](../../site/style.css:131), lines 199–202, 217–223, 234–240, and 356–364. This removes remnants without reducing polish.
- **Remove the live shardfile fetch and custom JSON painter:** [vite.config.ts:47](../../site/vite.config.ts:47), approximately **26 lines including its helper and invocation**. A marketing copy deploy should not depend on the game endpoint’s availability or schema. If retained in expanded technical content, use a checked-in example.
- **Read media.json once per build transform.** Lines 77 and 81 parse the same file separately; a small local value is sufficient.
- **Generate the press README during packaging.** The committed ZIP duplicates editable prose and has already drifted. Keep binary artwork static; generate text from the existing copy map.
- **Run the focused copy checks before deployment:** [site-deploy.yml:32](../../.github/workflows/site-deploy.yml:32) installs dependencies and proceeds to deploy without invoking them. The build validates slots, but the separate test checks script syntax and new-tab links.
- **Keep:** plain HTML, native `details`, native radios, the **75-line copy utility**, roughly **59 lines of page JavaScript**, self-hosted fonts, and content-hashed video publishing. None warrants a framework or generic component system.

**6. Top 10 — impact ÷ effort**

1. **[story]** Put “single-player alpha now; multiplayer and public authoring coming” beside the opening actions and in press copy.
2. **[bug]** Raise disclaimer contrast and size so concept art cannot be mistaken for delivered gameplay.
3. **[bug]** Stop silently truncating author ideas; align frontend and server limits.
4. **[story]** Move signup immediately after the author explanation and move JSON into optional depth.
5. **[bug]** Fix active rate-limit eviction and reject foreign-origin browser submissions.
6. **[bug]** Respect reduced motion for the trailer and provide pause controls for automatic loops.
7. **[look]** Recompose the phone hero around the promise and a strong player-action image.
8. **[story]** Label Thin Ice as a design case study; remove duplicated prompts, benefits, and history from the primary sequence.
9. **[look]** Replace soft or awkwardly cropped shard media with consistently framed gameplay moments.
10. **[code]** Delete approximately 68 dead CSS lines and remove the live-game fetch from the marketing build.

Live verification limitation: browser approval review rejected opening wildshard.io because permission was declined. This report does not certify production form delivery, asset responses, playback, or Safari runtime behavior.