# Nine Dragon Stack art

The rounds moved to `src/shards/nine-dragon-stack/art/` (S2, big shards). An older doc or comment that says
`art/nine-dragon-stack/<round>/...` now means `src/shards/nine-dragon-stack/art/<round>/...`, unless the file is still here.

What stays here:

- **`round-15-eight-domes`:** a live product names a file in this round, in its discovery, level section or
  validation record. Those bytes can't change now, so the round waits for the shard's next revision to repoint them.
- **`round-1-concept`, `round-6-baseline-hud`, `round-9-lab-grapple`:** a tool in `scripts/` opens this round, and part of it has to stay, so it stays whole.
- **Pictures over the preview cap, videos and scripts:** `docs/process/STORAGE.md` and the lint layers refuse them
  inside a shard folder, as they did for the template shards.
