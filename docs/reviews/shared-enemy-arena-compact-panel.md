# Compact shared Arena controls

Owner requested the active in-game panel be smaller at top right on 19 October 2026. The shared controller, four native products and all JavaScript/physics/gameplay remain unchanged. The normal chooser remains available before Start and after Back.

`practice/shared-arena/arena-compact.css` is the editable override. The source HTML links it. Native Site mount entry documents (`arena.html`, `index.html`, `practice.html`) link the same byte-exact stylesheet, without rebuilding or replacing engine bundles. During an active bout the heading/instructions are hidden and selector, Back and Retry remain at top right. Status stays aria-live. CSS activation depends on the existing Start hidden state; no new game state or callbacks.

Cloud Chromium iPhone-emulation checks measured 195.19 × 105 pixels at width320 and218 × 105 at402, without overlapping Pause. Actual Start, Retry, opponent change to Conch and Back passed; one canvas and empty local/session/cookies retained. Four fallback hosts'548 files remained hash-identical. No physical-phone or performance claim.

Native Site75 source `98be80ea49ceb8f667e62bf87cfbf2e7d8ad1d89` deployed successfully. The same change includes the separately owned six-tab current-catalog/Devlog Site redesign. Original media, historical anchors and exact fallback hosts are preserved. Detailed browser reports and actual screenshots are retained in the native Site source evidence.
