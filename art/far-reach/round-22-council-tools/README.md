# Sky Reach council tools (E392 / E399)

The first sky-reach session's capture-and-measure loop, copied from its scratchpad so the next session has it. The
scripts still hard-code that session's scratchpad path: set `SP` to yours before using them.

- `mkexp.sh <dir>`: an export of HEAD (no art/progress/sources) plus this lane's working copies (src/shards/far-reach,
  test/shards/far-reach, public/assets/far-reach), node_modules symlinked, `gen` run. A `pins.txt` next to it (one
  far-reach-relative path per line) pins a subagent's in-progress files back to HEAD before `gen`.
- `rebuild.sh`: mkexp, tsc, oxlint (stops on a lint error), stop the old preview, serve-build; the port goes to `port`.
- `preview.sh <scratch dir> [name]` (E410): the reusable form of mkexp + rebuild for any session or subagent: HEAD plus
  the shard's working copies (and the LUT file), gen, tsc, oxlint, served. `PINS="<far-reach-relative files>"` keeps
  another agent's files at HEAD; `HEAD_ONLY=1` builds HEAD alone. The port goes to `<scratch dir>/port-<name>`.
- `views.mjs <url> <outdir> [extra.json] [--only=ids]`: the progress cameras (art/far-reach/progress/cameras.json, plus
  any extra shots) as iPhone-portrait JPEGs, with the same `stage` / `calm` handling as scripts/shard-progress.mjs.
  Run it under `scripts/browser-lane.sh`. `h4-crown` must come before `mock-D-crown-arena` (it stages the arena's quest).
- `mockside.py <capdir> <out.jpg> [title]`: the five mockups over the five game views, one sheet.
- `measure.py <capdir>`: the council's numbers per view against its mockup: luminance top 1 %, the share above 230, the
  meadow region's mean colour. Measure before asking for a round (the lead's rule after round 5).
- `rerecord.py <sha> <reason>`: re-record far-reach's GPU ceilings from `progress/parity/<sha7>/` after
  `node scripts/parity.mjs --export=<full sha> --lane=m5 --shards=far-reach --tiers=phone,desktop`.
