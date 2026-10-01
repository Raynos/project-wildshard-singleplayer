# E357 J10: desktop Settings, layout A

Jake picked layout A (`art/settings/round-1-desktop-keybinds/A-two-pane-table.jpg`) with the proposed default keys.
These are real in-game captures of Nalati Grasslands (so the Riding group shows). They come from the clean candidate
`0128895a` (HEAD d0e11533 plus J10), built with `scripts/serve-build.sh --rev`. The capture used Playwright, Chrome with
Metal and muted audio, through the browser lane, at 1440 × 900 desktop. The phone frame is 390 × 844 @3× with a
coarse pointer and touch. The browser and preview were closed after the capture. Every frame was inspected.

| Frame | What it shows |
|---|---|
| [keybindings](desktop-1440x900-keybindings.jpg) | Pause ▸ Settings ▸ Key bindings. The rail (Video · Audio · Controls · Key bindings · Gameplay · Save · Review) is on the left. On the right is ACTION / KEY / ALT in two columns: On foot · Swimming, then Combat · Riding · Menus. The new defaults are in place: Dodge V + Alt, arrows as the movement alt, Bag I + Tab, and a single "Weapon 1–4" row. Ctrl hold-crouch is gone. |
| [conflict](desktop-1440x900-conflict.jpg) | Interact clicked, then F pressed. Both cells turn amber. The bar reads "Key already used by Attack. Swap bindings?" with SWAP KEYS / CANCEL. |
| [swapped](desktop-1440x900-swapped.jpg) | After SWAP KEYS: Interact is F and Attack's alt is E. RESET TO DEFAULTS restores both. |
| [audio](desktop-1440x900-audio.jpg) | A second category, Audio: volume, music and the licence credits. |
| [gameplay](desktop-1440x900-gameplay.jpg) | Gameplay: aim assist, hunter's eye, and the lock-on section. |
| [video](desktop-1440x900-settings-video.jpg) | Video: the quality the page was built with, plus a pointer to main menu ▸ Settings, where the boot-time picks live (E55). |
| [phone](phone-390x844-settings.jpg) | The phone is unchanged: one stacked column, no rail, no Video, no key bindings. |

Desktop means `(pointer: fine) and (min-width: 900px)`. A narrow desktop window keeps the stacked column, with the
key table in one column. Touch-only devices never show key bindings (J7).
