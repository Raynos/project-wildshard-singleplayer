# Running the Wildshard chunk playtest

```
pnpm install
pnpm assets        # one-time: downloads the CC0 Poly Haven textures/models/HDRIs into public/assets
pnpm dev           # http://localhost:5173
pnpm build         # tsc + vite build → dist/
```

## Tests
```
pnpm test                          # vitest run — the whole suite, well under a second
pnpm exec vitest                   # watch mode
pnpm exec vitest run test/chunks   # one file
```
Unit tests for the pure logic live in `test/*.test.ts` (outside `src/`, so no `import.meta.glob` can pull one into
the bundle): RNG / noise determinism, the boot plan's progress invariants, inventory + harvest yields, achievements /
titles, settings, the species registry and every shard's ChunkDef + terrain contract. They run in plain node
(`vitest.config.ts`, deliberately separate from `vite.config.ts`, which bakes terrain on load); `test/setup.ts` stubs
`localStorage` (fresh per test) and `location`. Tests are in the `tsc` / `oxlint` gates like any source file, and
CI runs `pnpm test` as the **Test** step between Lint and the CSS check — a red test means no deploy.

## Controls
WASD move · Shift sprint · Ctrl/C crouch · Space jump · LMB fire · RMB aim · R span · E interact (doors, harvest carcasses) · Esc release cursor

## URL parameters (debug)
- `?x=&z=&yaw=&pitch=` spawn pose · `&nolock=1` no pointer lock (F fires, R spans) · `&skipintro=1` straight into play
- `&tour=1` scripted fly-through camera (`window.__world.tour.time = s`)
- `&hdri=<polyhaven id>` swap the sky (`qwantani_sunset_puresky` default) · `&sunI=&envI=&bgI=` light levels
- `&debug=card` shows the baked pine branch card

## Capturing progress
- `scripts/timelapse.sh` → `progress/timelapse.mp4` from every screenshot in `progress/`
- `scripts/progress-video.sh [fps] [seconds]` → `progress/progress-video.mp4`, a headless fly-through
- Feature dev harnesses: `dev/animals.html`, `dev/cabins.html`, `dev/grass.html`, `dev/weapon.html`

`window.__world` exposes everything (game, sky, terrain, forest, player, grass, animals, crossbow, hud, audio …).

## Live

https://wildshard-singleplayer.vercel.app — deploy with `vercel deploy --prod --yes` from the repo root (project `wildshard-singleplayer`, Vite auto-detected).
