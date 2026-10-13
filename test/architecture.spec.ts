import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkArchitecture } from '../tooling/dependency-rule.cjs';

function check(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'aihn-architecture-'));
  try {
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { baseUrl: '.', target: 'ES2021', skipLibCheck: true },
      }),
    );
    for (const [file, code] of Object.entries(files)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), code);
    }
    return checkArchitecture(root, { noLib: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('dependency gate resolves real TypeScript imports', () => {
  it.each(['../modules/beta', 'src/modules/beta'])(
    'rejects core dependency through %s',
    (specifier) => {
      expect(
        check({
          'src/core/a.ts': `export { value } from '${specifier}'`,
          'src/modules/beta/index.ts': 'export const value = 1',
        }).violations.join('\n'),
      ).toContain('core must not depend on modules');
    },
  );
  it.each(['../beta/internal', 'src/modules/beta/internal'])(
    'rejects private cross-module import %s',
    (specifier) => {
      expect(
        check({
          'src/modules/alpha/a.ts': `import { value } from '${specifier}'; export const a = value;`,
          'src/modules/beta/internal.ts': 'export const value = 1;',
        }).violations.join('\n'),
      ).toContain('public index');
    },
  );
  it('accepts intentional public re-exports', () => {
    expect(
      check({
        'src/modules/alpha/a.ts':
          "import { value } from '../beta'; export const a = value;",
        'src/modules/beta/index.ts': "export { value } from './internal';",
        'src/modules/beta/internal.ts': 'export const value = 1;',
      }).violations,
    ).toEqual([]);
  });
  it('rejects infrastructure imports from pure assessment domain', () => {
    expect(
      check({
        'src/modules/assessment/domain/a.ts':
          "import { value } from '../../../core/a'; export const a = value;",
        'src/core/a.ts': 'export const value = 1;',
      }).violations.join('\n'),
    ).toContain('domain must remain pure');
  });
  it('fails runtime cycles', () => {
    expect(
      check({
        'src/core/a.ts': "import { b } from './b'; export const a = () => b();",
        'src/core/b.ts': "import { a } from './a'; export const b = () => a();",
      }).runtimeCycles,
    ).toHaveLength(1);
  });
  it('reports type-only cycles without failing them', () => {
    const result = check({
      'src/core/a.ts':
        "import type { B } from './b'; export interface A { b: B }",
      'src/core/b.ts':
        "import type { A } from './a'; export interface B { a: A }",
    });
    expect(result.runtimeCycles).toHaveLength(0);
    expect(result.typeCycles).toHaveLength(1);
    expect(result.violations).toEqual([]);
  });
  it('classifies erased interface imports by emitted JS, not import syntax', () => {
    const result = check({
      'src/core/a.ts': "import { B } from './b'; export interface A { b: B }",
      'src/core/b.ts': "import { A } from './a'; export interface B { a: A }",
    });
    expect(result.runtimeCycles).toHaveLength(0);
    expect(result.typeCycles).toHaveLength(1);
  });
  it('does not hide unresolved aliases or computed dependencies', () => {
    const result = check({
      'src/core/a.ts':
        "import { a } from 'src/missing'; const file = 'src/other'; require(file); export { a };",
    });
    expect(result.violations.join('\n')).toContain(
      'unresolved local dependency',
    );
    expect(result.violations.join('\n')).toContain('computed import/require');
  });
});
