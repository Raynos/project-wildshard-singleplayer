# Marketing site audit: Opus 5.5 clean-room (read-only), 2026-10-10 (E473)

Brief: the same as the Codex seat ([codex](2026-10-10-marketing-site-codex.md)): the live site, 32 WebKit screenshots,
`site/`, `api/waitlist.ts`, the tests and the deploy workflow; the plan, the asks and the art rounds were off limits.
Live checks by curl (assets, version.json, waitlist CORS, bad-email probe POSTs that store nothing). Merged, verified
findings and the rows they became: MARKETING-SITE §9.

## 1. Verdict

- **AAA:** close, not there. The HUD look (terminal panes, corner brackets, violet glow, Rajdhani) is distinctive and
  the first phone screen is strong; soft phone media, a broken card layout and a weak author/footer ending hold it back.
- **MMO story:** the first screen tells it well, then the page over-claims multiplayer as live and buries its best
  proof (walking between shards with no loading screen) at screen 10.
- **KISS:** yes in spirit (plain HTML/CSS, ~60 lines of JS, no framework); ~70 lines of style.css are dead and the build
  makes a network call to the game for a decorative JSON panel.

## 2. Bugs (verified)

1. **Blurry shard stills on the phone** (phone-home-02/03/04): the 5:4 cards are ~356 CSS px wide (712 px at 2×,
   1068 at 3×); `shard-driftwood/ninedragon.webp` are 402 px wide, `template` 390, `skyreach/dunes` 555 (dunes also
   `scale(1.3)`). Card loops are 540×432 and the phone trailer 720×406 at 0.59 Mb/s, all upscaled ~2× on the iPhone 17
   Pro. Fix: cards at 1080 wide (or crops of the 1400 px `wide-*.webp`), loops 1080×864, the phone trailer 1080p.
2. **Coming-worlds images stop short of the right edge** (phone-home-08/09, desktop-home-09): `style.css:29`
   `img{max-width:100%}` caps `:244 .idea img{width:calc(100% + 22px)}`: a 22 px gap on phone; ~29 px plus 8 px at the
   top on desktop, where `:401` changes the padding but not the negative margins.
3. **The author section sits 40 px left of every other section, its form 40 px further right** (desktop-home-13/14):
   `.door-end` pads by `--g` and then `.wrap` sits inside it (`style.css:418-419`). Move the padding to `.door-end > .wrap`.
4. **The waitlist takes posts from any origin** (`api/waitlist.ts:86-111`): a POST from `Origin: https://evil.example`
   is processed; any site can sign up anyone's email, and every POST writes a new blob (dedupe only on read, `:141`).
   Fix: 403 on a present, disallowed Origin; key the blob by `sha256(email)` so a repeat overwrites (and the read-time
   dedupe goes).
5. **The honeypot is named `website`** (`index.html:304`): autofill fills "website" fields, and a real signup then gets a
   fake OK and is dropped (`api/waitlist.ts:99`). Give it a meaningless name.
6. **Disclaimers fail contrast:** `--faint #4d6275` on `#050a12` is ~3.1:1 at 10–11 px (`style.css:103` `.note`,
   footer), and that is the "concept art, not the built shard" honesty line. Use `--mute`.
7. **The press page promises screenshots and shows none** (`COPY.md:949`, `press/index.html:40-51`; they are only in
   the zip); the desktop press page is a near-empty screen with the footer mid-viewport (desktop-press-00).
8. **Sharing / SEO:** the press page's `og:title` / `twitter:title` reuse the home title (`press/index.html:14,21`);
   `<title>` is only "Project Wildshard"; no `og:image:alt`; no custom 404 (`/nope` is Vercel's 79-byte text).
9. **Stale copy and docs:** "Twenty-one days" (`COPY.md:559`; 16 Sep → 9 Oct is 23); `COPY.md:11` documents
   `{curly braces}` the build doesn't fill.
10. **Dead controls:** "Discord: coming" styled as a button (`index.html:313`); the footer's blinking `> ▮` (`:320`).

## 3. Story and structure

- **Over-claims, read as live:** "Explore it, fight in it, play it together" (`COPY.md:70`), "Fight, quest and ride
  together" (`:111`), "✓ signed in as you" (`:288`), "Upload it to the world" (`:320`). Today the alpha is single-player
  with no keys. Add one status line under the hero CTAs ("Alpha today: 7 single-player shards. Next: multiplayer,
  uploads, creator keys.") and tag steps 1 and 6 "when keys open".
- **Contradiction:** "Claude Code is the level editor" / "in Claude Code" vs FAQ 3 (`:735`) "any agent". Pick one.
- **Internal jargon:** "Jake picked Thin Ice" (`:354`), "WorldClaw dry run" (`:394`).
- **The best MMO proof is buried:** "walk from one shard into the next with no loading screen" is the last journey
  row; make a real in-engine seam-crossing clip the second beat after the hero.
- **Redundant (~15 phone screens; aim ~10):** "What" repeats the hero tagline (keep its art and bullets); "How" and
  "One sentence" tell the same thing (Thin Ice inside step 3); "Many authors" overlaps "Shards that grow" and FAQ 5
  (merge into "One world, many authors", shard.json to the FAQ or gone); "Who's building it" repeats the journey intro
  (cut); "Play it now" (install) is a second ending before the author door (fold into the FAQ, one Play in the final band).
- **Order:** hero + trailer → grid clip / what → shards you can play → one world, many authors → how (with Thin Ice) →
  journey → coming worlds → become an author → FAQ → footer.

## 4. Look and feel: top 5

1. Crisp media on the phone (bug 1): the single biggest polish gain on an iPhone.
2. The hero shows many worlds, not one: cycle the prompt through 3–4 shards with the world crossfading under it, or an
   in-engine aerial of the grid.
3. Fill the empty sticky left column (desktop-04/05/09/10): the 5×5 grid, the cell of the shard in view lit.
4. Make joining an event: the claim grid at the form's width (capped at 420 px today), the claimed cell lights with the
   visitor's prompt on success, no Discord box, rebalance "BECOME / AN / AUTHOR." (`max-width:8ch` orphans "AN").
5. Finish the edges: a real footer (Play, Press, email, ©), a screenshot strip on the press page, full-bleed
   coming-worlds cards, readable disclaimers.

## 5. Code (KISS / ponytail)

- **Dead CSS, ~70 of 443 lines** with no markup on either page: `.map`/`.ink` (131-149, 434), `.facts` and `#world-sec`
  (154-158, 356-364), `.ritual` (199-202, 393-394), `.road` (217-223, 234, 404-405), `.log` (235-240, 406), `.label`
  (34-35), `.trailer img/.play-btn/.tag` (126-129, 343-344), `.faq .draft` (258), `.world picture`, `.world .loop`
  (75, 81), the `data-accent` pink/violet indirection (16-19).
- **The shardfile peek** (`vite.config.ts:46-66, 86`): every build fetches the live game for a decorative excerpt; a
  static excerpt or no panel (−22 lines).
- **Per-image crop hacks:** inline `object-position` / `transform:scale` (`index.html:96-132`) undone with `!important`
  on desktop (`style.css:370, 377`); export proper crops and delete both.
- `.more-shards`: 4 `!important` rules (`style.css:175-177`) → 2 plain ones. The 25-cell claim grid is one ~3,000-char
  line (`index.html:307`): one cell per line. Inline styles (`index.html:304, 309, 320`, `press:55`) → CSS. Parse
  media.json once in the vite plugin.
- **Fine as is:** `copy.ts` and its guards and test, `deploy.sh`, the CI workflow, self-hosted fonts, the loop
  IntersectionObserver script, the no-JS form fallback, CORS, the timing-safe password check.

## 6. Top 10 (impact ÷ effort)

1. [bug] Phone stills, loops and trailer at ≥ 1080 wide.
2. [bug] `.idea img` max-width and margins (2 lines).
3. [story] The honest "Alpha today / Next" line; steps 1 and 6 "when keys open".
4. [bug] Reject foreign-Origin waitlist posts; key blobs by email hash.
5. [bug] `.door-end` padding; rename the honeypot.
6. [story] Cut "Who", fold "Install" into the FAQ and the final CTA, Thin Ice into "How".
7. [story] The grid-crossing clip as the second beat; FAQ 3 contradiction, "Jake / WorldClaw", "21 days".
8. [code] The ~70 dead CSS lines and the build-time shardfile fetch.
9. [look] Sticky lit 5×5 grid in the left column; full-width claim grid with a success animation.
10. [look] Multi-shard hero cycle; real footer; press screenshot strip; disclaimer contrast; SEO title, og:image:alt, 404.
