# Variants and toggles: pause ▸ Settings ▸ Debug, never a URL switch

Linked from [AGENTS.md → No URL switches](../../AGENTS.md). Moved verbatim from AGENTS.md by E423 (2026-10-03).

Jake plays the game as an iOS home-screen PWA. It has no address bar, so a `?foo=` switch is one he can never flip.

- **Never add a query-string param** for a variant, a look, a tuning value or a feature toggle. Not "just for the
  A/B", not "temporary".
- **Every variant goes in pause ▸ Settings ▸ Debug** (E162, Jake: "we are going to have an ungodly amount of toggles
  and we need to organize them"). Its owner declares it, in one of two places:
  - **A shard's toggle: `ctx.debugRow` in the shard's own folder** (13-lead-resolutions 05/06#12). The shard declares
    its own key and row; no shard name ever lands in `src/engine/ui/Settings.ts` or `debugOptions.ts`.
    1. In the plugin's `play` hook (or the shard's `debug.ts`): `ctx.debugRow({ id: '<slug-prefix>.<name>', group,
       label, choices: [{ value, text }], initial, change(value), reload?, note, ask: 'E<n>', reviewBy: 'YYYY-MM-DD' })`.
       Strings come from the shard's `strings.ts`.
    2. The row shows only on that shard. Its value is a per-device save (`debug.plugin.<slug>.<id>`); `change` runs on
       a pick, and once at load when the saved value differs from `initial`. The row goes when the shard unloads.
    3. A test or capture drives it through a handle the shard exposes with `ctx.debug.expose(name, value)`
       (`window.__wildshard.shard[name]`).
    4. A shard never reads an engine option it doesn't own (`wildshard/shard-sandbox`). To show an existing engine row
       on a shard, list its key in the manifest's `debugOptions`.
  - **An engine-wide toggle: the registry.** Only for a variant of engine code, never named after a shard:
    1. `src/engine/ui/Settings.ts`: a key in `OPTION_VALUES` (the first value is the default) and `OPTION_SPECS` → `DEBUG_ONLY`.
    2. `src/engine/ui/debugOptions.ts`: one `opt(key, group, label, choices, { reload?, when?, note, ask: 'E<n>', reviewBy: 'YYYY-MM-DD' })`
       row in `DEBUG_ROWS`, under the group whose domain it is. `when` shows it only where it applies; `reload: true` if
       the thing is built once. `src/engine/ui/DebugMenu.ts` renders it — no Menu.ts edit. `test/debug-options.test.ts`
       fails an option with no row.
    3. The game reads it with `setting(key)` (at load for a reload row) and `onSettingChange(key, fn)` (live).
    4. A test / capture script sets it before the load: `debugSettings(page, { key: 'value' })` (`scripts/debug-settings.mjs`).
  - Both routes: `pnpm gen` updates `lint/ask-ids.json`; commit that inventory when a new ask owns a flag (Vercel
    excludes docs). Every comparison row raises the Debug-row count capped in `lint/ratchet.json` (`debugRows.max`, the ask in
    `raisedBy`); a reopened shard's lane can't edit `lint/`, so it asks the lead.
  - **Never add a new group without need.** The groups are Look · Ground cover & foliage · Sky & weather · Audio ·
    Combat & weapons · Creatures & NPCs · Performance · Loading & memory · Developer tools; lighting, shadows, post and
    water are Look. A new group is for a new domain with several rows, not for one toggle.
  - When Jake picks a winner, delete the row, the option and the losing code in one commit (E136 / E162 style).
- **Developer vs Debug rows** (E451, Jake 2026-10-07: *"the whole point of the developer toggle is that we want to have this public build, staging build, developer build. We have one website, one deployment … Anything that is, you know, almost ready to share with friends and family can be public built, staging … Anything that is just something that I'm developing actively with you and it's clearly slop, unfinished, needs an ungodly amount of steering, that goes behind the developer toggle … for me to see all the unfinished slop and to fix it."*):
  - **Settings ▸ Developer** splits the one deployment into two builds. Off: the public / staging build, only work
    that is nearly ready to share with friends and family. On: Jake's developer build, every unfinished thing he is
    actively steering.
  - **New, unfinished work ships behind Developer**: a new shard, mode, menu card or system that still needs steering.
    It leaves Developer (becomes public) only when Jake says it's ready to share.
  - **A Debug row** is for a variant, look or tuning value inside work that's already visible (A/B before a pick); it is
    deleted when Jake picks. A Debug row never stands in for the Developer gate.
  - **Developer tools use the same registry port**, with `purpose: 'developer'` on `DebugRowSpec` / `DebugRow`.
    Both Settings menus render them in a separate Developer-tools card under Developer. They keep ask ownership
    and review dates, but do not count against the comparison-row cap. Outside Developer, saved picks are ignored,
    tool actions are inert, and the shipped initial value runs; the saved pick is retained for the next developer session.
    A reload-only tool still builds on entry; its direct saved-slot reader must apply the same Developer fence.
  - **As few Debug rows as humanly possible** (Jake, 2026-10-07: *"I really want to have as few debug rows as humanly
    possible … if something is … where I need to quickly see in-game version A and version B, then that's what the debug
    row is for. But those are very, very short-lived toggles and feature flags … all the debug row stuff needs to go away
    as fast as possible … debug rows shouldn't be binary toggles … And once I choose my best version, you just delete all
    the dead code and get rid of the debug row slash feature flag."*). A row is a feature flag or an A / B / C choice
    for an in-game comparison, short-lived by design; it can have as many choices as the comparison needs. The pick
    commit deletes the row, every losing choice and its dead code. A row with no pending pick is debt: retire it.
- **The params the game may read are a fixed allowlist**, `lint/url-params.json`. `harness` is what the test, capture
  and bench scripts pass to drive the game headless (tier, touch, chunk, spawn, skipintro, mute, …). Adding to it needs
  Jake's explicit OK. `legacy` (the old switches, E162) is empty: never add to it.
- **The lint enforces it.** `wildshard/no-url-switch` (`lint/wildshard-plugin.js`, on for `src/` except the `src/dev/`
  harness pages) refuses `.get` / `.has` / `.getAll` of any param not on the list, a param name it cannot read as a
  string, and raw `location.search` parsing. Don't disable it; move the variant to the menu.
