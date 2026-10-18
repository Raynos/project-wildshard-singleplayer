# Brine Puffer: proposed arena ideal mockups

Generated on 2026-10-18 with the native image-generation tool. These are
proposed art-direction mockups based on the owner's actual V55 phone
screenshots. They are **not game captures**, implementation evidence, animation
evidence, or an approved replacement for the existing art-direction reference.
All images carry a concept disclosure within the image. The first pair was
rejected; the revised target pair below is proposed and is not owner-approved.

## Revised target pair: proposed

The owner rejected the initial pair because it looked too similar to the
existing model rather than like remastered, ideal versions. The revised prompts
therefore use the approved concept as the primary creature authority and the
phone screenshots only for the camera, arena, weapon, HUD and phone composition.
The screenshot creature was replaced rather than retained as the shape target.

- `health23-target-v2.jpg`: braced charge anticipation still, with a wider low
  mantle, integrated beak and deep eye sockets, sloping grounded fin fans and an
  asymmetric three-ray tail. 850 × 1850; 240,034 bytes.
- `health90-target-v2.jpg`: alert stalking still, with a taller narrower mantle,
  one fin advanced, one retracted, a smaller mouth gap and tail fanned on the
  opposite side. 850 × 1850; 237,889 bytes.

Both carry **AI TARGET MOCKUP / NOT GAME CAPTURE** inside the image. They preserve
the screenshot composition rather than pixels, and do not prove animation,
runtime appearance, collider behavior or implementation quality.

Exact revised prompts:

- `health23-target-v2-prompt.txt`
- `health23-target-v2-correction-prompt.txt`
- `health90-target-v2-prompt.txt`

The 23-health target used one initial generation and one focused image-generation
correction to replace a circular tail, correct the HOLD label and frame the
disclosure. The 90-health target used one generation, with the approved concept,
actual 90-health screenshot and revised 23-health target as references. Every
output was inspected, including the compact JPEGs. Only JPEG compression at
quality 84 was applied after generation; no external content editing was used.

Selected revised raw output SHA-256:

- 23 health: `37554106d09197e2c4174200f345ccca97d5dd0ca30da4fb6f00871cf776dfef`
- 90 health: `759d35c868c0585b8e37a7f94d46359e7fe964d855fba7f76c92bbfc96a1667f`

## Initial pair: rejected, retained for provenance

- `health23-braced-wind-up.jpg`: derived from `IMG_0992.jpeg` (23 health),
  suggesting a wider braced wind-up still pose. 850 × 1850; 234,893 bytes.
- `health90-alert-idle.jpg`: derived from `IMG_0991.jpeg` (90 health),
  suggesting a more upright alert idle still pose. 850 × 1850; 242,887 bytes.

The creature direction follows the existing reference
`../lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`: broad matte low-poly
facets, teal / ochre / cream masses, integrated eyes and mouth, connected fins,
and restrained lighting. The phone framing, navy grid arena, debug panel, main
HUD, crosshair and first-person weapon/arms are retained compositionally, not
pixel-for-pixel. These generated stills do not establish any game behavior.

## Initial-pair reproduction and review

- Exact generation prompts: `health23-prompt.txt` and `health90-prompt.txt`.
- One native generation was used per image. All three original references were
  inspected first. The second generation also used the first output to maintain
  creature consistency. These initial results were subsequently rejected by the
  owner as insufficiently different from the current model.
- Both raw outputs and compact JPEG copies were visually inspected. The only
  post-generation conversion was JPEG compression at quality 86; no compositing,
  painting, added lighting or pose manipulation was applied afterward.
- Each compact JPEG is below the 250 KB preview cap. Raw PNG originals are
  retained outside the commit-ready art folder and are not intended for Git.

Raw output SHA-256:

- 23 health: `9aa148045aa5be25589e98e4dade867d5f8f6d0c47374cd617a32f8e81462264`
- 90 health: `ef11950af40c2e248a2795d30c002b988e044395a2ee772ced7beff09f106a05`

No runtime code, existing art reference, production asset or repository
checkpoint was changed by this mockup generation.
