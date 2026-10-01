import { describe, expect, it } from 'vitest';
import { API } from 'typescript/unstable/sync';
import { isArrowFunction, isBlock, isCallExpression, isExpressionStatement, isIfStatement, isMethodDeclaration, type Node } from 'typescript/unstable/ast';

const sources = import.meta.glob<string>('../src/**/*.ts', { eager: true, query: '?raw', import: 'default' });
const schedulers: Readonly<Record<string, readonly string[]>> = {
  Audio: ['scheduleBubble', 'scheduleLark', 'scheduleCricket', 'scheduleCrackle', 'scheduleSurf', 'scheduleGust', 'scheduleBird'],
  IslandAmbience: ['scheduleBird', 'scheduleDrip', 'scheduleSwell'],
  ForestAmbience: ['scheduleThrall'],
};

describe('every sound source is observed', () => {
  it('requires a tap on every shipping module that creates sound sources', () => {
    const files = Object.entries(sources).filter(([file, text]) => !file.includes('/dev/') && /createBufferSource|createOscillator/.test(text));
    expect(files.length).toBeGreaterThan(0);
    for (const [file, text] of files) expect(text, file).toContain('tap.sound?.(');
    expect(files.length).toBeGreaterThanOrEqual(10); // Audio + the nine independent sound modules (R2-F1).
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
        const file = `src/audio/${module}.ts`, source = sources[`../${file}`];
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
      const file = 'src/audio/SteppeAmbience.ts', source = sources[`../${file}`], ast = project.program.getSourceFile(file);
      if (!source || !ast) throw new Error('Missing steppe countdown source');
      const visit = (node: Node): void => {
        if (isIfStatement(node) && /this\.(herd|marmot|eagle)T <= 0/.test(source.slice(node.expression.pos, node.expression.end))) { checkBody(node.thenStatement, source); countdowns++; }
        node.forEachChild(visit);
      };
      visit(ast);
      expect(callbacks).toBe(11);
      expect(countdowns).toBe(3);
      snapshot.dispose();
    } finally { api.close(); }
  });
});
