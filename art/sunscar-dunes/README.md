# Sunscar Dunes art

The rounds moved to `src/shards/sunscar-dunes/art/` (S2, big shards). An older doc or comment that says
`art/sunscar-dunes/<round>/...` now means `src/shards/sunscar-dunes/art/<round>/...`, unless the file is still here.

What stays here:

- **`round-2-dunes`:** a live product names a file in this round, in its discovery, level section or
  validation record. Those bytes can't change now, so the round waits for the shard's next revision to repoint them.
- **Pictures over the preview cap, videos and scripts:** `docs/process/STORAGE.md` and the lint layers refuse them
  inside a shard folder, as they did for the template shards.
