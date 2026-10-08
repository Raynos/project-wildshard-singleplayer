/** No substitution when process ownership is ambiguous. */
export function ownedWebContentPid(text: string, owner: number): number | null;
export interface ProcessMemoryFile { name: string; text?: string; error?: string }
export interface ProcessMemorySnapshot { pid: number | null; unavailable: string | null; files: ProcessMemoryFile[] }
/** Raw same-process native maps, kept separate from JS heap capacity. */
export function processMemory(pid: number | null, execute: (command: string, args: string[]) => string): ProcessMemorySnapshot;
