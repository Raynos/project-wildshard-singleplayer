import * as v from 'valibot';
import { saves } from '#engine';

export const nalatiSkinsSave = saves.define({ key: 'nalati.skins', scope: 'shard', version: 1,
  schema: v.object({ owned: v.array(v.string()), worn: v.record(v.string(), v.string()) }),
  initial: () => ({ owned: [] as string[], worn: {} as Record<string, string> }) });
