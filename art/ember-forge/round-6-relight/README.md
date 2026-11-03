# Ember Forge · round 6 · G992 relight (2026-11-03, sp-o1)

Jake (G992, 08:45): *"Ember Forge and Moss Light just look really fucking dark … the minimalistic art style does not
match the dark look."* One round only (G994). The change is the plot's own `outputs.json` look row (`1cc6b48123`):
key 0.35 → 2.5 (a cool moon), fill 1.4 navy → 6.0 (blue from above, lava-warm from below). Shared graphs and sky keys
are untouched (sp-o2 owns the sun / moon disc).

`board.jpg`: the 8 golden cameras (`art/open-plots/golden-2026-11-03/ember-forge/cameras.json`, plot-local, placed on
the plot's current cell after G986's move), BEFORE `308a77e` · AFTER `1cc6b48`, Chromium as iPhone 16 Pro portrait,
phone tier, 2x, muted. AFTER is HEAD at that commit, so it also carries the grid's G993 centre restore (other
neighbours in views 3, 7 and 8).

**Ruling (G941, the builder decides and logs): AFTER ships.** Halls, roofs and paving read slate blue at eye level
instead of flat navy; the lava, windows and blue lamps (emissive, unchanged) still carry the night. The furnace draws
in its own landmark graph and is unchanged. No further look round (G994).
