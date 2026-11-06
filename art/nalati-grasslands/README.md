# Nalati Grasslands art

The rounds moved to `src/shards/nalati-grasslands/art/` (S2, big shards). An older doc or comment that says
`art/nalati-grasslands/<round>/...` now means `src/shards/nalati-grasslands/art/<round>/...`, unless the file is still here.

What stays here:

- **`round-5-paintover`:** a live product names a file in this round, in its discovery, level section or
  validation record. Those bytes can't change now, so the round waits for the shard's next revision to repoint them.
- **`round-12-faces`, `round-4-camp-9angle`, `round-6-panorama`, `round-7-world-redesign`:** a tool in `scripts/` opens this round, and part of it has to stay, so it stays whole.
- **Pictures over the preview cap, videos and scripts:** `docs/process/STORAGE.md` and the lint layers refuse them
  inside a shard folder, as they did for the template shards.
