import type { ShardContext } from '../plugin/context';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { HookPracticeLayout } from '@wildshard/format/practiceCourse';

/** Client-only course cards load admitted layouts into the native practice rooms. */
export function installPracticeCourse(ctx: ShardContext, row: ClientFeatureRow): void {
  if (row.kind !== 'practice.course') throw new Error('Invalid practice course');
  ctx.playground({ id: row.course, title: row.title, blurb: row.blurb, icon: row.icon, art: ctx.product.url(row.art),
    load: async () => {
      const { PracticeCourse } = await import('./course');
      if (row.course === 'horse') {
        const { practice } = await ctx.product.json<{ practice: unknown }>(row.file);
        return class extends PracticeCourse { constructor(host: PlaygroundHost) { super(host, ctx, {kind:'horse',layout:practice}); } };
      }
      const { practice } = await ctx.product.json<{ practice: HookPracticeLayout }>(row.file);
      return class extends PracticeCourse { constructor(host: PlaygroundHost) { super(host, ctx, {kind:'grapple',layout:practice}); } };
    },
  });
}
