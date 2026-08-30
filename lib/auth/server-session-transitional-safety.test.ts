import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function readModuleSpecifiers(source: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

test("transitional server facade has exactly one legacy credential source", () => {
  const facadeSource = readFileSync(
    new URL("./server-session.ts", import.meta.url),
    "utf8",
  );
  const adapterSource = readFileSync(
    new URL("./legacy-server-session.ts", import.meta.url),
    "utf8",
  );
  const authIndexSource = readFileSync(
    new URL("./index.ts", import.meta.url),
    "utf8",
  );
  const completePath = `${facadeSource}\n${adapterSource}`;

  assert.match(facadeSource, /^import "server-only";/m);
  assert.match(facadeSource, /LEGACY_TRANSITIONAL_IMPLEMENTATION/);
  assert.match(
    facadeSource,
    /import \{ getServerSession \} from "next-auth";/,
  );
  assert.match(facadeSource, /await import\("\.\/index"\)/);
  assert.match(facadeSource, /getServerSession\(authOptions\)/);
  assert.match(facadeSource, /createLegacyServerSessionResolver/);
  assert.equal(
    completePath.match(/\bgetServerSession\s*\(/g)?.length,
    1,
  );
  assert.doesNotMatch(completePath, /authoritative-session/);
  assert.doesNotMatch(completePath, /from\s+["']next\/headers["']/);
  assert.doesNotMatch(completePath, /\bcookies\s*\(/);
  assert.doesNotMatch(completePath, /\bheaders\s*\(/);
  assert.doesNotMatch(completePath, /\bgetToken\s*\(/);
  assert.doesNotMatch(completePath, /authorization/i);
  assert.doesNotMatch(completePath, /authSessionV2CookieName/);
  assert.doesNotMatch(completePath, /process\.env/);
  assert.doesNotMatch(
    authIndexSource,
    /(?:from\s+|import\s*\()["']\.\/(?:server-session|legacy-server-session)["']/,
  );

  assert.deepEqual(
    readModuleSpecifiers(facadeSource, "server-session.ts").sort(),
    [
      "./index",
      "./legacy-server-session",
      "./server-session-contract",
      "./server-session-contract",
      "next-auth",
      "server-only",
    ],
  );
  assert.deepEqual(
    readModuleSpecifiers(adapterSource, "legacy-server-session.ts"),
    ["./server-session-contract"],
  );
  assert.equal(
    readModuleSpecifiers(authIndexSource, "index.ts").some((specifier) =>
      /(?:^|\/)(?:legacy-)?server-session(?:\.[cm]?[jt]sx?)?$/.test(
        specifier,
      ),
    ),
    false,
  );
});
