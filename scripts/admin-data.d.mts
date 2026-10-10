import type { CommittedTree } from './admin-data/collect.mjs';
import type { AdminBundle } from './admin-data/types.mjs';

export const SHARE_INPUTS: readonly string[];
export function runSharePlatform(root:string):unknown;
export function committedAdminTree(root:string,rev:string):CommittedTree;
export function exportedAdminTree(root:string,revision:string):CommittedTree;
export function writeAdminData(tree:CommittedTree,output:string):AdminBundle;
