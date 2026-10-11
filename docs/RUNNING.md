# Running Wildshard locally

```
pnpm install
pnpm assets        # one-time: downloads the CC0 Poly Haven textures/models/HDRIs into public/assets
pnpm dev           # scripts/serve-build.sh: builds, serves on a free port (4400–4999), prints the URL
pnpm build         # full build → dist/ (queued: one app build machine-wide)
```

## Tests
```
pnpm exec vitest                   # watch mode
pnpm exec vitest run test/chunks   # one file
```
Tests live in `test/` (outside `src/`, so no `import.meta.glob` can pull one into the bundle). `pnpm test` runs the
whole suite, queued (one full suite machine-wide); CI's layout is in [process/DEPLOY.md](process/DEPLOY.md).

## Controls
Desktop keys are listed and rebindable in pause ▸ Settings ▸ Key bindings; on the phone it's the touch HUD.

## URL parameters (debug)
- `?x=&z=&yaw=&pitch=` spawn pose · `&nolock=1` no pointer lock (F fires, R spans) · `&skipintro=1` straight into play
- `&tour=1` scripted fly-through camera (`window.__wildshard.world.tour.setTime(seconds)`)
- Variants and debug aids are not URL params (AGENTS.md "No URL switches, ever"): pause ▸ Settings ▸ Debug, declared in `src/engine/ui/debugOptions.ts`

## Capturing progress
- `scripts/timelapse.sh` → `progress/timelapse.mp4` from every screenshot in `progress/`
- `scripts/progress-video.sh [fps] [seconds]` → `progress/progress-video.mp4`, a headless fly-through

`window.__wildshard.world` exposes the live game objects (inspect it in the console).

## Live

https://wildshard-singleplayer.vercel.app ships hourly from the newest CI-green main; `gh workflow run deploy` for now;
details in [process/DEPLOY.md](process/DEPLOY.md).
