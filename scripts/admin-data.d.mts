import type { CommittedTree } from './admin-data/collect.mjs';
import type { AdminBundle } from './admin-data/types.mjs';
export function committedAdminTree(root:string,rev:string):CommittedTree;
export function exportedAdminTree(root:string,revision:string):CommittedTree;
export function writeAdminData(tree:CommittedTree,output:string):AdminBundle;
