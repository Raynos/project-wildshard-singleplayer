import { parse } from 'valibot';
import { MountedLoadoutSchema } from '@wildshard/format/loadout';
import { BowVariantSchema } from '@wildshard/format/bowVariantRows';
import { parseHeldSlots, type HeldSlotsRows } from '@wildshard/format/heldArms';

/** Compile the original native arsenal order and reward identities to finite
 * held slot rows. No native owner, view builder or callable leaves this bake. */
export function heldSlotRows(input:unknown,power:unknown):HeldSlotsRows {
  const rows=parse(MountedLoadoutSchema,input),variant=parse(BowVariantSchema,power),page=rows.page;
  if(page===undefined)throw new Error('Held slot bake requires its native firearm declaration');
  const order=page.order.map(id=>id==='sabre'?'blade':id==='spear'?'polearm':id==='rifle'?'firearm':id);
  return parseHeldSlots({version:1,id:'nalati.arsenal',bindAt:'equipment',pause:true,
    slots:[{id:'blade',kind:'blade',item:rows.blade.item,source:{kind:'passes',file:rows.blade.file}},
      {id:'polearm',kind:'polearm',...rows.polearm},{id:'bow',kind:'bow',...rows.bow},{id:'firearm',kind:'firearm',...page.firearm}],
    registration:['bow','blade','polearm','firearm'],equipment:{primary:'blade',rifle:'firearm',extras:['bow','polearm'],order},
    selection:{unlock:['bow','polearm'],initial:rows.initial},mount:['blade','polearm','bow'],
    refills:[{slot:'polearm',kind:'fill-capacity'},{slot:'bow',kind:'add-magazine'}],
    upgrades:[{id:'bow-reward',slot:'bow',kind:'bow',replacement:{item:rows.variants.bow.id,name:rows.variants.bow.name},power:{kind:'charged-pierce',rows:variant}},
      {id:'blade-reward',slot:'blade',kind:'blade-pass',replacement:{item:rows.variants.blade.id,name:rows.variants.blade.name}}]});
}
