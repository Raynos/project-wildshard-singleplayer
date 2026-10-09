# SF73 independent legacy entry and retirement foundation

The primary and explicitly flagged legacy manifests resolve independently. Arbitrary suffixes and orphan copies gain no routing privilege. No live entry path changes in this slice.

SaveStore.mergeShardEntries durably copies missing local keys at retirement, preserving primary values, opaque future entries, reset barriers, profile and other shards. Refusal preserves the old durable/memory destination and keeps the source for retry. The helper is intentionally not called while both folders coexist.

Focused 10/10 and root-config typed lint pass. Clean export root strict/ratchet/lint green; full 1080 files / 5922 tests passed, 14 skipped. All four real native checkpoint bundles were recaptured: payloads, effects and tapes byte-identical; only input fingerprints refreshed after the SaveStore source hash changed.

The SavePanel/new-game owner's uncommitted SaveSlot.status and inspectShardGeneration hunks are excluded from this private-index commit and remain unchanged on disk.

Next: exact frozen inventory and guards, then six current-HEAD snapshots/routing, full boot/isolation proof. Kit dissolution belongs to sp-x2. Public owned-shell re-soak follows SF73 on the coordinator's pin.
