import type { proveSceneClient, proveEquippedItemClient } from '../../src/sdk/headless';

export function productFile(product: string, pathname: string): string;
export function browserOperation(value: unknown): { op: string; code?: string; key?: string; duration?: number };
export function browserPacket(value: unknown): { id: string; message: unknown };
export function proofReaders(sdk: { proveSceneClient: typeof proveSceneClient; proveEquippedItemClient: typeof proveEquippedItemClient }): Promise<Map<string, () => unknown>>;
