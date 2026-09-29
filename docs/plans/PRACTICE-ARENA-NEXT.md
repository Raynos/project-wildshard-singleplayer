# Practice arena: what's next

**State:** `in progress` 2026-09-29 — Jake picked row A (E298). A is built (the whole kit lent in the room); B–E stay unapproved, to pick later.

The practice room (HUD + weapon explorer) works on all four shards as of `021767d-mun80nj1`. Each of the rows below would
extend it, and each is independent of the others.

| Row | What | Why | Size |
|---|---|---|---|
| A · Full kit | While in the room, every weapon the shard has is unlocked and swappable (Driftwood: iron sword + AR-15; Pine Hollow: lever-action + Warden's longbow; Nine Dragon: iron sword + AR-15; Nalati already has bow · sabre · spear). The SWAP pill / weapon strip shows; the world's own unlocks are restored on exit | It is called the weapon explorer, but today only the starter weapon is usable | small · **done** (E298): `Weapons.lendAll` / `endLoan`, every kit weapon checked landing on all four shards |
| B · Sparring dummy | One of the three telegraphs and swings on a slow timer (wind-up glow, a short hit). The player's DODGE, lock-on orbit and hurt feedback get something to answer; vitals refill in the room | The dodge and the lock-on orbit have nothing to react to; the dummies only stand | medium |
| C · Readouts + reset | A small panel: last hit, combo count, damage per second over 5 s; a RESET that clears stuck bolts and settles the dummies | Tuning feel needs numbers, not only floating damage | small |
| D · Fei Zhua post (Nine Dragon) | One dragon-hook post in the Nine Dragon room so the grapple and zip can be practised there | Nine Dragon's signature verb is the one thing the room can't show (LOCK there is now plain lock-on, E298) | small |
| E · Open to players | The Explore hub's Practice card shows without Developer mode; the dummies preload for everyone (~3.3 MB of GLBs, about 33 MB decoded) | The room is dev-only today | tiny, plus a phone memory check |

## Audit facts (E298, live `e4405df` → `021767d`)

- Enter via title → Explore → Practice on all four shards. All three rigged meshes (`humanoid`) are there on the first
  frame, the weapon is in hand, and 16.6 ms frames on the phone tier (the 60 fps cap), 55–61 draw calls. Pause ▸ Exit to
  Explore ▸ Practice again works.
- HUD in the room: pause, vitals, minimap, attack, dodge, jump, lock (not on Pine Hollow's crossbow: AIM); hover,
  horse, journal and quest are hidden. The pause menu shows Settings only, titled Practice.
- Fixed in the audit: Nine Dragon's LOCK was taken by the Fei Zhua (the nearest hook 900 m below) and never locked on
  (`021767dc`).
- Open bug: an intermittent Pine Hollow fault, `[faults] system "main" threw: TypeError: Cannot read properties of
  undefined (reading 'alive')`. It showed up in 1 of 4 live runs, after a crossbow hit; the dev server didn't reproduce
  it. Sentry needs a sign-in (`/mcp`) to get its stack.
- Working as designed: the room spawns you 5–11 m back so the lineup fits the portrait frame, and the sword only lunges
  within 4 m (5 m heavy), so the first swing from the spawn whiffs.
