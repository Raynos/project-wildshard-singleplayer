/** Authored seconds before replacement and its existing night gate. */
export interface RespawnRule { delay: { min: number; max: number }; night?: boolean }

/** One pending return, kept in death order until the configured traversal takes it. */
export interface RespawnEntry { kind: string; variant: string | undefined; herd: number; x: number; z: number; due: number; night: boolean }

