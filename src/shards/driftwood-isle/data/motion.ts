/** Existing immutable fixed drivers and their charged transport; runtime owns motion once. */
export const MOTION_FILES = [
  {
    "hash": "9a5171bc3dd84488aae9de29ebd07fdb12dfbd2500c45cf91cf37e5bbbc712f0",
    "kind": "wasm",
    "compressed": 33491,
    "decoded": 33491,
    "gpu": 0,
    "triangles": 0,
    "draws": 0,
    "dependencies": [],
    "critical": true
  },
  {
    "hash": "1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd",
    "kind": "wasm",
    "compressed": 1297,
    "decoded": 1297,
    "gpu": 0,
    "triangles": 0,
    "draws": 0,
    "dependencies": [],
    "critical": true
  }
] as const;
/** One page per module, tripled for guest state and continuation copies. */
export const MOTION_MEMORY = 2 * 65536 * 3;
