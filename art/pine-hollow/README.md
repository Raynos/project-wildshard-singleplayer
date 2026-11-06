# Pine Hollow art

The rounds moved to `src/shards/pine-hollow/art/` (S2, big shards). An older doc or comment that says
`art/pine-hollow/<round>/...` now means `src/shards/pine-hollow/art/<round>/...`, unless the file is still here.

What stays here:

- **`round-17-look-loop-3`:** a live product names a file in this round, in its discovery, level section or
  validation record. Those bytes can't change now, so the round waits for the shard's next revision to repoint them.
- **`round-10-horizon`, `round-14-look-loop`, `round-16-birds`, `round-25-e322-king-rig`, `round-8-assets`, `round-9-creature-refs`:** a tool in `scripts/` opens this round, and part of it has to stay, so it stays whole.
- **Pictures over the preview cap, videos and scripts:** `docs/process/STORAGE.md` and the lint layers refuse them
  inside a shard folder, as they did for the template shards.
