# Training dummy variants · Model Explorer

Three portrait iOS PWA UI mockups, based on the existing Model Explorer and the approved training dummy designs. These are layout proposals, not engine captures; model statistics and source paths in the images are illustrative.

| Choice | Image | Interaction |
| --- | --- | --- |
| A | [One family card, variant picker](A-one-family-variant-picker.jpg) | One catalog card; a Wood / Straw + Cloth / Wood + Steel selector changes the turntable specimen. This follows Pine Hollow's existing creature variant pattern. |
| B | [Three model cards](B-three-model-cards.jpg) | Three individually searchable catalog entries with a shared training-dummy heading. |
| C | [Family lineup](C-family-lineup.jpg) | One family entry opens a side-by-side comparison before inspecting one variant. |

After seeing the live Pine Hollow capture, Jake delegated the choice. We chose A: one family card with three material variants. The turntable now supports shared prop variants, and the picker follows the measured top of the details panel on portrait screens. [Live training dummy model](live-dummy-model.jpg) is an engine capture of the first implementation. It still needs the shape and material polish visible in the approved target sheets.

## Existing Pine Hollow behavior — live production capture

[Short portrait video](pine-hollow-live-variants.mp4) and screenshots [Hind](pine-hollow-live-variant.jpg) / [Stag](pine-hollow-live-stag.jpg) show the current, deployed Model Explorer with the deer family. One **Deer** catalog card opens the turntable. A horizontal strip below the model selects Hind, Stag, White Hind, White Stag, Great Stag, Piebald Hind or Ghost Stag. The selected chip turns amber, the rig is rebuilt in place, and the same source/stats card remains underneath. The clip and screenshots are engine captures, unlike A–C above.
