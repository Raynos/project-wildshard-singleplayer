import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact frozen identities reuse unchanged owner metadata, with every tap checked.
import { resolve, relative } from 'node:path';
import { legacyInventory, registeredLegacyFile } from '../scripts/legacy-shards.mjs';
import { API } from 'typescript/unstable/sync';
import { isArrowFunction, isBlock, isCallExpression, isExpressionStatement, isIfStatement, isMethodDeclaration, type Node } from 'typescript/unstable/ast';

const frozen = legacyInventory(resolve('.'));
const sources = import.meta.glob<string>('../src/**/*.ts', { eager: true, query: '?raw', import: 'default' });
const schedulers: Readonly<Record<string, readonly string[]>> = {
  'src/shards/driftwood-isle/runtime/audio/sfx.ts': ['scheduleSurf', 'scheduleGust'],
  'src/engine/audio/Audio.ts': ['scheduleBubble'],
  'src/shards/pine-hollow/runtime/audio/synth.ts': ['scheduleGust', 'scheduleBird'],
  'src/shards/nalati-grasslands/runtime/audio/synth.ts': ['scheduleLark', 'scheduleCricket', 'scheduleCrackle'],
  'src/shards/driftwood-isle/runtime/audio/ambience.ts': ['scheduleBird', 'scheduleDrip', 'scheduleSwell'],
  'src/shards/pine-hollow/runtime/audio/ambience.ts': ['scheduleThrall'],
};

describe('every sound source is observed', () => {
  it('requires a tap on every shipping module that creates sound sources', () => {
    const files = Object.entries(sources).filter(([file, text]) => !file.includes('/dev/') && /createBufferSource|createOscillator/.test(text));
    expect(files.length).toBeGreaterThan(0);
    // Generic audio players accept content ids; R4-12 keeps their literal taps in their shipping owners.
    const owners: Readonly<Record<string, string>> = {
      '../src/engine/audio/Cues.ts': '../src/shards/nine-dragon-stack/runtime/audio/cues.ts',
      '../src/engine/audio/AmbienceBeds.ts': '../src/shards/nine-dragon-stack/runtime/audio/ambience.ts',
      '../src/engine/audio/ambience.ts': '../src/shards/nalati-grasslands/runtime/audio/SteppeAmbience.ts',
      '../src/engine/audio/synth.ts': '../src/engine/audio/playerVoices.ts',
      // Short native AAC windows are subdivisions of the Deck's single content sound, not new sounds.
      '../src/engine/audio/aacSource.ts': '../src/engine/audio/Stems.ts',
    };
    for (const [file, text] of files) {
      const owner = owners[file];
      expect(owner === undefined ? text : sources[owner], file).toContain('tap.sound?.(');
    }
    expect(files.filter(([file]) => !registeredLegacyFile(frozen, relative(resolve('.'), resolve(file.slice(3))))).map(([file]) => file).sort()).toEqual([
      '../src/engine/audio/AmbienceBeds.ts', '../src/engine/audio/Audio.ts', '../src/engine/audio/Music.ts',
      '../src/engine/audio/Stems.ts', '../src/engine/audio/Voices.ts', '../src/engine/audio/ambience.ts',
      '../src/engine/audio/aacSource.ts',
      '../src/engine/audio/synth.ts',
      '../src/shards/driftwood-isle/runtime/audio/ambience.ts', '../src/shards/driftwood-isle/runtime/audio/shrineHum.ts',
      '../src/shards/nalati-grasslands/runtime/audio/synth.ts',
      '../src/shards/pine-hollow/life/index.ts',
    ].sort()); // S3.5 merges three independent players; every remaining source still requires its content tap.
  });

  it('parses every ambient callback and requires exactly one ambientTick statement', () => {
    const api = new API();
    try {
      const snapshot = api.updateSnapshot({ openProjects: ['tsconfig.json'] });
      const project = snapshot.getProject('tsconfig.json');
      if (!project) throw new Error('Missing project for sound scheduler AST check');
      let callbacks = 0, countdowns = 0;
      const checkBody = (node: Node, source: string): void => {
        if (!isBlock(node)) throw new Error('Ambient callback must have a block');
        expect(node.statements).toHaveLength(1);
        const statement = node.statements[0];
        if (!statement || !isExpressionStatement(statement) || !isCallExpression(statement.expression)) throw new Error('Ambient callback must call ambientTick');
        const expr = statement.expression.expression;
        expect(source.slice(expr.pos, expr.end).trim()).toBe('ambientTick');
      };
      for (const [module, methods] of Object.entries(schedulers)) {
        const file = module, source = sources[`../${file}`];
        const ast = project.program.getSourceFile(file);
        if (!source || !ast) throw new Error(`Missing source ${file}`);
        const found: string[] = [];
        const visit = (node: Node): void => {
          if (isMethodDeclaration(node) && node.body) {
            const name = source.slice(node.name.pos, node.name.end).trim();
            if (methods.includes(name)) {
              found.push(name);
              const findArrow = (child: Node): void => {
                if (isArrowFunction(child)) { checkBody(child.body, source); callbacks++; }
                else child.forEachChild(findArrow);
              };
              node.body.forEachChild(findArrow);
            }
          }
          node.forEachChild(visit);
        };
        visit(ast);
        expect(found.sort(), module).toEqual([...methods].sort());
      }
      for (const file of ['src/shards/nalati-grasslands/runtime/audio/SteppeAmbience.ts', 'src/game/systems/looks/gullFlock.ts']) {
        const source = sources[`../${file}`], ast = project.program.getSourceFile(file);
        if (!source || !ast) throw new Error('Missing ambient countdown source');
        const visit = (node: Node): void => {
          if (isIfStatement(node) && /this\.(?:(herd|marmot|eagle)T|callTimer) <= 0/.test(source.slice(node.expression.pos, node.expression.end))) { checkBody(node.thenStatement, source); countdowns++; }
          node.forEachChild(visit);
        };
        visit(ast);
      }
      expect(callbacks).toBe(12); // S4.3: the island bed's gust is its own scheduler (Driftwood's sfx.ts), beside the mixer's forest gust
      expect(countdowns).toBe(4);
      snapshot.dispose();
    } finally { api.close(); }
  });
});
