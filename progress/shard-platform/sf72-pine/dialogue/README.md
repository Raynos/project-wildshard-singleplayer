# Pine native Hale dialogue — SF72 / E435

The native quest now reads the same authored Hale entry through `NpcDialogue` and the page dialogue clock. Flags commit only after the last line; opening keyboard uses wait 150 ms; another prompt use advances the modal instead; cancel or walking farther than radius + 2.5 m closes without flags. The weapon loadout is disabled while reading. Saved mid-line state and its opening guard restore silently and atomically. The page UI is unchanged.

Focused checks: every Hale entry against the panel clock; input guard, cancellation and corrupted continuation; real native mid-line save/restore, modal use and weapon suppression; the full focused Warden quest sequence. Scoped strict and touched lint pass.

The actual command tape now finishes the night-watch dialogue instead of assuming one press. It reaches the King and dawn alive in 31,222 ticks. All six native checkpoint payloads and the complete compatibility record are byte-identical under ARM64 and Rosetta x64; the 1,200-tick restored fight suffix is exact and restores emit no facts. These are deliberate changed gameplay payloads, not a hash-only refresh.

`compatible:false`: nearest/LOS prompt selection, other NPCs, weather/ranged context, remaining producers, browser-save interop and alternate/grid tapes remain open. The token-focused proof is separate from this uninterrupted route.
