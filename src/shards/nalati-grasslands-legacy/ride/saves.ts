import * as v from 'valibot';
import { saves } from '@wildshard/engine/saves/runtime';

export const tulparSave = saves.define({ key: 'tulpar', scope: 'shard', version: 1, schema: v.nullable(v.string()), initial: () => null });
export const horseNamesSave = saves.define({ key: 'horseNames', scope: 'shard', version: 1, schema: v.record(v.string(), v.string()), initial: () => ({}) });
