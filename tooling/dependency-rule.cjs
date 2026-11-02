const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return file.endsWith('.ts') && !file.endsWith('.spec.ts') ? [file] : [];
  });
}
function cycles(edges) {
  const graph = new Map();
  for (const { from, to } of edges) {
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from).add(to);
  }
  const visited = new Set(),
    active = [],
    found = [];
  function visit(node) {
    const index = active.indexOf(node);
    if (index >= 0) {
      found.push([...active.slice(index), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.push(node);
    for (const target of graph.get(node) || []) visit(target);
    active.pop();
  }
  for (const node of graph.keys()) visit(node);
  return found;
}

// Use TS resolution and actual program emit so erased imports/metadata differ
// correctly from runtime imports. Emit goes to memory, never to dist.
function checkArchitecture(root, override = {}) {
  root = path.resolve(root);
  const configPath = path.join(root, 'tsconfig.json');
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(read.error.messageText, '\n'),
    );
  const config = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
  if (config.errors.length)
    throw new Error(
      config.errors
        .map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n'))
        .join('\n'),
    );
  const files = sourceFiles(path.join(root, 'src')).sort();
  const options = {
    ...config.options,
    ...override,
    noEmit: false,
    incremental: false,
    declaration: false,
    sourceMap: false,
    module: ts.ModuleKind.CommonJS,
  };
  const program = ts.createProgram(files, options);
  const emitted = new Map();
  program.emit(undefined, (name, text, _bom, _error, sources) => {
    if (name.endsWith('.js') && sources?.length === 1)
      emitted.set(path.resolve(sources[0].fileName), text);
  });
  const relative = (name) =>
    path.relative(root, name).split(path.sep).join('/');
  const moduleOf = (name) =>
    name.startsWith('src/modules/') ? name.split('/')[2] : undefined;
  const edges = [],
    violations = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    const from = relative(file);
    const runtime = new Set();
    const js = ts.createSourceFile(
      'emit.js',
      emitted.get(path.resolve(file)) || '',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    function collectRequire(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        ts.isStringLiteral(node.arguments[0])
      )
        runtime.add(node.arguments[0].text);
      ts.forEachChild(node, collectRequire);
    }
    collectRequire(js);
    function visit(node) {
      let literal;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        literal = node.moduleSpecifier;
      else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      )
        literal = node.moduleReference.expression;
      else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require'))
      ) {
        literal = node.arguments[0];
        if (!literal || !ts.isStringLiteral(literal))
          violations.push(
            `${from}: computed import/require cannot be verified`,
          );
      }
      if (literal && ts.isStringLiteral(literal)) {
        const specifier = literal.text;
        const resolved = ts.resolveModuleName(
          specifier,
          file,
          options,
          ts.sys,
        ).resolvedModule;
        const local =
          resolved &&
          !resolved.isExternalLibraryImport &&
          relative(resolved.resolvedFileName).startsWith('src/');
        const to = local ? relative(resolved.resolvedFileName) : specifier;
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const at = `${from}:${line} -> ${to}`;
        if (
          !resolved &&
          (specifier.startsWith('.') || specifier.startsWith('src/'))
        )
          violations.push(`${at}: unresolved local dependency`);
        if (local) {
          edges.push({ from, to, runtime: runtime.has(specifier) });
          if (from.startsWith('src/core/') && moduleOf(to))
            violations.push(`${at}: core must not depend on modules`);
          if (
            moduleOf(from) &&
            moduleOf(to) &&
            moduleOf(from) !== moduleOf(to) &&
            to !== `src/modules/${moduleOf(to)}/index.ts`
          )
            violations.push(
              `${at}: cross-module dependency must use public index`,
            );
        }
        if (
          from.startsWith('src/modules/assessment/domain/') &&
          (!local || !to.startsWith('src/modules/assessment/domain/'))
        )
          violations.push(`${at}: assessment domain must remain pure`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const runtimeEdges = edges.filter((edge) => edge.runtime);
  const runtimeCycles = cycles(runtimeEdges);
  violations.push(
    ...runtimeCycles.map((cycle) => `runtime cycle: ${cycle.join(' -> ')}`),
  );
  const runtimePairs = new Set(
    runtimeEdges.map((edge) => `${edge.from}\0${edge.to}`),
  );
  const typeCycles = cycles(edges).filter((cycle) =>
    cycle.some(
      (node, index) =>
        index > 0 && !runtimePairs.has(`${cycle[index - 1]}\0${node}`),
    ),
  );
  return {
    files: files.length,
    edges,
    runtimeCycles,
    typeCycles,
    violations: [...new Set(violations)],
  };
}

if (require.main === module) {
  const result = checkArchitecture(process.cwd());
  if (result.violations.length) {
    console.error(result.violations.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      `Architecture PASS: ${result.files} source files, ${result.edges.length} local dependencies, ${result.typeCycles.length} type-containing cycles; no runtime cycle.`,
    );
}
module.exports = { checkArchitecture };
