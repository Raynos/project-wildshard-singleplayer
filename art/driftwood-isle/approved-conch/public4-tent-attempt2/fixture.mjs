/** Exact fixed current-runtime entries. No clock or pose overrides or mutable URL switch. */
export const DIRECTORY='art/driftwood-isle/approved-conch/public4-tent-attempt2';
function entryName(variant){if(variant!=='control'&&variant!=='tent')throw new Error('Only fixed control/tent entries');return variant==='tent'?'candidate':'control';}
export function practiceBootFixture(source,variant='tent') {
 entryName(variant);const seam='prepare: game => preparePracticeContent(game, product), status });';
 if(source.split(seam).length!==2)throw new Error('Original prepare seam changed');
 return "import { firstUse } from '/art/driftwood-isle/approved-conch/tent-shadow-diagnostic/first-use.mjs';\n"+source.replace(seam,`prepare: game => { firstUse(game, '${variant}'); return preparePracticeContent(game, product); }, status });`);
}
export function practiceEntryFixture(source,variant='tent') {
 const name=entryName(variant),seam="await import('./practiceBoot')";
 if(source.split(seam).length!==2)throw new Error('Original entry seam changed');
 return "import { installFirstUseReader } from '/"+DIRECTORY+"/first-use-reader.mjs';\ninstallFirstUseReader();\n"+source.replace(seam,`await import('/${DIRECTORY}/${name}-practiceBoot.ts')`);
}
export function practiceHtmlFixture(source,variant='tent') {
 const name=entryName(variant),seam='src="/src/practice.ts"';
 if(source.split(seam).length!==2)throw new Error('Original HTML seam changed');
 return source.replace(seam,`src="/${DIRECTORY}/${name}-entry.ts"`);
}
