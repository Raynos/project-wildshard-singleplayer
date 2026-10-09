# Mockups, decision boards and review pages

Linked from [AGENTS.md → Mockups](../../AGENTS.md). The mockup flow moved verbatim from AGENTS.md by E423 (2026-10-03);
the board and review rules are Jake's standing preferences.

## Mockups

- To design the best game, you can use the codex CLI to generate mockup images
with openai image generation, the mockup images are screenshots of the wildshard
singleplayer demo running in Chrome, as if a playtester was hitting print screen
on his laptop.
- **Two engines. Pick by the job** (E100, E104, E107):
  - **Qwen-Image-2.1 turbo, local: fast.** `scripts/mockup-local.sh --ref <live capture> --prompt-file <p.txt> --out
    <png>` takes ~20–35 s per image on this Mac, against ~3 min plus upload and reconnect hangs for codex. Use it to
    iterate on a layout, to explore many variants quickly, for text-heavy panels, for asset references on white, and
    whenever codex is out of quota.
    - **For a localised edit** (move a button, add a chip or a panel), pass `--mask <png>`, white where the change
      goes. The frame outside the mask comes back pixel-identical.
    - Inside the mask it is seed-dependent. On the hover-pill job, 2 of 3 seeds placed the new pill correctly; seed 42
      removed the old pill without drawing the new one. Run 2–3 seeds (`--seed <n>`, ~25–35 s each) and keep the one
      that did the edit. Read every image.
    - Its weak spots: it greys Driftwood's toon palette, garbles text under ~10 px, and re-composes the camera when
      given several `--ref`s. Give it one reference and read every image.
    - It runs under the shared model lock, so it can queue behind music, SFX and 3D jobs.
  - **codex `image_gen`: fidelity.** Use it for the final frames on a decision board, whole-frame HUD re-layouts that
    need correct small text, icons and anything shipped. The flow is below.
- **Where they go:** every mockup / concept image / art asset lives in
  `art/<subject>/round-<n>-<label>/` (e.g. `art/hud/round-7-sword-touch/`,
  `art/feedback/round-1-inbox/`; next free round per subject). Never loose in `art/`, never a new
  top-level folder (`mockups/`, `renders/` …). Existing `art/` files are not moved or renamed.
  `art/README.md` is the index. The plan that asked for them lists each file and what it shows.
- **Start from a live capture, not from nothing.** Take the real game's frame first
  (`agent-browser --session <s> set viewport 1600 900`, or `390 844` + `?touch&tier=phone` for the
  phone; `open "https://wildshard-singleplayer.vercel.app/?skipintro&nolock&weapon=sword"`; wait for
  the load (~60–120 s headless); `screenshot`; `close`). Save it in the session scratchpad and pass it
  with `-i`. codex then **edits** that frame, so the world, the camera and the existing HUD stay true
  and only the new thing is invented. Shots in `progress/` have no HUD, so they are poor UI references.
  `scripts/decide/decide.sh qa <png …>` (≈ 1 s a frame, local model, E394) says whether a capture landed in the 3D
  world or caught a loading screen, title card, menu or blank frame: run it instead of opening a frame just to check
  that it loaded. It cannot judge HUD text or render glitches, so read the frames you build on.
- **One image per headless run, runs in parallel** (one `&` per variant, then `wait`; 4–6 at once is
  fine, each takes a few minutes):

  ```bash
  codex exec -s workspace-write --skip-git-repo-check -C "$REPO" --add-dir ~/.codex/generated_images \
    -i "$SP/ref-desktop.png" -o "$SP/<id>.last.txt" "<COMMON><SCREEN>
  TASK FOR CODEX: Use the built-in image_gen tool to EDIT the attached reference screenshot into
  exactly ONE 16:9 landscape image as described above (keep the world, camera and existing HUD; add
  the new UI in the same UI language). One generation only. Then copy the PNG that YOUR image_gen
  call produced (its path is in the tool result; other runs are writing to ~/.codex/generated_images
  at the same time, so never 'the newest file') into
  $REPO/art/<subject>/round-<n>-<label>/<id>.png. Create or modify no other file." > "$SP/<id>.log" 2>&1
  ```

  **Don't wait for codex to copy its own file.** The image lands in
  `~/.codex/generated_images/<session id>/` about 3 min in. codex's follow-up "copy it" turn can then hang 10+ min on
  reconnects over the slow uplink (E41, 2026-09-23). The runner reads `session id:` from each run's log, polls that
  folder, copies the PNG the moment it appears and kills that codex. Pass the reference as a JPEG (~300 KB, not a
  1.4 MB PNG): every run uploads it. More parallel runs don't slow each other; the waiting is per run, not a queue.
  The model and effort come from `~/.codex/config.toml` (gpt-6.1-sol). If a run fails with "model is not
  supported when using Codex with a ChatGPT account", the CLI is stale: `codex update` fixes it (E357: 0.157.1 → 0.159.2). `image_gen` is codex's built-in tool (the
  system `imagegen` skill), so it needs no `OPENAI_API_KEY`. Write the prompts and the runner script
  into the scratchpad with the Write tool: the `dcg` hook blocks shell redirects to computed paths.
- **The prompt has two blocks.** COMMON is shared by every run. It says what the game is (low-poly
  stylized first person, Driftwood Isle) and that the image must read as a real print-screen of it,
  not concept art, with no device frame, browser chrome or watermark. It also carries the UI language:
  dark navy glass `#0d1b26` ~80 %, 1 px cyan `#8fe3ff` hairlines with corner brackets, letter-spaced
  monospace uppercase labels, no gradients or emoji. SCREEN is one variant: what is on screen, where
  (the left 30 %, under PAUSE …), and **every string of UI text verbatim, in quotes**. Unquoted text
  comes back garbled.
- **Look at every image before you report it** (Read the PNG). Re-run a variant whose text is garbled
  or whose HUD drifted from the reference. Say which ones were re-rolled.
- Make several different variants per question (a layout A / B / C…), not one. Then the user can pick
  one and name its letter.
- **Commit JPEG, not PNG.** image_gen hands back 1.4–2 MB PNGs, and the uplink is slow.
  `sips -s format jpeg -s formatOptions 88 X.png --out X.jpg && rm X.png` → ~300–450 KB each.
- **Keep the shard's own style in every prompt.** Driftwood is faceted, flat-shaded, untextured low-poly: say "keep the
  faceted flat-shaded low-poly look, no textures, no photorealism", and regenerate any result that drifts (Jake
  rejected a photoreal granite boulder as "definitely not our style").
- **Mockups are for new UI and new art direction.** For a rendering, pop-in or performance problem, build the change
  behind a Debug row and show real before/after captures ("Mockups don't tell me anything"). Style-lens HUD reskins
  were judged no better than the game (E122): find what bothers Jake in play before another HUD round.
- **New shards use the baseline HUD** with no custom elements: map new verbs onto existing controls and put shard info
  in existing slots. Capture the live HUD fresh for every HUD mockup; never reuse an old `art/hud/` reference.

## Decision boards

- **Every pick is one board image**: the variants side by side (2–4 across), each with a big letter (A, B, C, D) and a
  one-line caption, the question as its title. Text-only choices get a board too. `magick montage` with `-label`, a
  dark background and a title.
- **Every image Jake sees says what it is, inside the image** (Jake, 2026-10-09: *"all these boards need some kind of label on the image … just the file name is not enough. They need text inside the image saying what the hell am I looking at"*): every board, before / after pair, capture sheet, evidence frame and infographic carries burned-in text: a title line (what the question or change is) and a label on every panel (A / B, "BEFORE: today" / "AFTER: …", the shard and pose). A pixel-difference panel is labelled "DIFFERENCE (black = identical)", or left off boards meant for Jake. A raw capture sent alone gets a one-line caption bar. No unlabelled image goes to Jake.
- **iPhone portrait only, for every screenshot**: boards, before/after sheets, audits, evidence. Jake plays the Safari
  PWA and reviews from Claude iOS. Capture as the phone ([MACHINE.md](MACHINE.md)); no desktop frames, even for a
  desktop-only bug.
- **When a board isn't enough:** send one full-resolution in-game photo per variant (HUD hidden, same camera). Anything
  that moves (pop-in, shadows, water) is a **video**, same camera, side by side or blind. If Jake says "they all look
  the same", ship the cheapest.
- **Sets of images go in one send, in order**, so Jake can page through them; a set of per-place views comes with the
  map first, numbered the same way; every image carries a burned-in title strip (number · name · role).
- **Model checkpoints end with a spin clip**: ~10 s portrait clip of the real Model Explorer turning 1–5 models
  (`scripts/model-spin.mjs`), phone-size H.264 of ~2–4 MB.
- **Taste is Jake's call** ([JAKE.md](JAKE.md)): a stylistic change keeps the old look selectable and goes out as a
  variant sheet; he picks.

## Review pages

- A plan with prototypes or mockups gets **one visual review page per plan** (an Artifact: the flow, each prototype as
  a board with its numbers, the open decisions with Jake's answers as text). A dry run or prototype series gets its
  own page; cross-link pages instead of merging them.
- **Read-only**: no buttons, note boxes or lightboxes. Questions go through chat; the page shows the answers.
- Register each page in `docs/reviews/<slug>.md` in the commit that links it ([docs/reviews/README.md](../reviews/README.md)).
