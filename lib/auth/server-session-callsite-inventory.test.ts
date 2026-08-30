import assert from "node:assert/strict";
import {
  readdirSync,
  readFileSync,
  type Dirent,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const EXCLUDED_DIRECTORIES = new Set([
  ".agents",
  ".codex",
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "docs",
  "e2e",
  "node_modules",
  "out",
  "playwright-report",
  "public",
  "test-results",
]);

const EXPECTED_LEGACY_CONSUMER_CALLS = Object.freeze({
  "app/(shop)/order/success/page.tsx": 1,
  "app/(shop)/payment/failed/page.tsx": 1,
  "app/(shop)/payment/success/page.tsx": 1,
  "app/(user)/layout.tsx": 1,
  "app/(user)/moj-nalog/favoriti/page.tsx": 1,
  "app/(user)/moj-nalog/page.tsx": 1,
  "app/(user)/moj-nalog/porudzbine/[id]/page.tsx": 1,
  "app/(user)/moj-nalog/porudzbine/page.tsx": 1,
  "app/admin/layout.tsx": 1,
  "app/admin/page.tsx": 1,
  "app/api/admin/articles/[id]/route.ts": 3,
  "app/api/admin/articles/route.ts": 2,
  "app/api/admin/attributes/[id]/route.ts": 3,
  "app/api/admin/attributes/route.ts": 2,
  "app/api/admin/banners/[id]/route.ts": 2,
  "app/api/admin/banners/route.ts": 2,
  "app/api/admin/brands/[id]/route.ts": 2,
  "app/api/admin/brands/route.ts": 2,
  "app/api/admin/categories/[id]/route.ts": 2,
  "app/api/admin/categories/route.ts": 2,
  "app/api/admin/chat/messages/route.ts": 2,
  "app/api/admin/chat/route.ts": 4,
  "app/api/admin/colors/route.ts": 4,
  "app/api/admin/newsletter/images/route.ts": 3,
  "app/api/admin/newsletter/route.ts": 2,
  "app/api/admin/orders/[id]/status/route.ts": 1,
  "app/api/admin/orders/export/route.ts": 1,
  "app/api/admin/product-types/[id]/route.ts": 3,
  "app/api/admin/product-types/route.ts": 2,
  "app/api/admin/products/[id]/route.ts": 3,
  "app/api/admin/products/route.ts": 2,
  "app/api/admin/promotions/[id]/route.ts": 3,
  "app/api/admin/promotions/route.ts": 2,
  "app/api/admin/settings/route.ts": 2,
  "app/api/admin/store-locations/[id]/route.ts": 2,
  "app/api/admin/store-locations/route.ts": 2,
  "app/api/admin/ticker/[id]/route.ts": 3,
  "app/api/admin/ticker/route.ts": 3,
  "app/api/admin/upload/route.ts": 1,
  "app/api/admin/wishlist-alerts-log/route.ts": 1,
  "app/api/cron/wishlist-alerts/route.ts": 1,
  "app/api/orders/[id]/route.ts": 1,
  "app/api/payments/nestpay/start/route.ts": 1,
  "app/api/promotions/route.ts": 1,
  "app/api/reviews/[productCode]/[id]/route.ts": 2,
  "app/api/reviews/[productCode]/route.ts": 1,
  "app/api/user/addresses/[id]/default/route.ts": 1,
  "app/api/user/addresses/[id]/route.ts": 1,
  "app/api/user/addresses/route.ts": 2,
  "app/api/user/checkout-data/route.ts": 1,
  "app/api/user/password/route.ts": 1,
  "app/api/user/profile/route.ts": 2,
  "app/api/wishlist/route.ts": 3,
  "lib/checkout/order-handler.ts": 1,
} as const);

const EXPECTED_SERVER_SESSION_WIRING = Object.freeze({
  "lib/auth/server-session.ts": 1,
} as const);

const EXPECTED_GET_TOKEN_CALLS = Object.freeze({
  "app/api/auth/verify-email/[token]/route.ts": 1,
  "proxy.ts": 1,
} as const);

const NEXTAUTH_HANDLER = "app/api/auth/[...nextauth]/route.ts";
const RAW_SERVER_SESSION_NAMES = [
  "getServerSession",
  "unstable_getServerSession",
] as const;
const RAW_CREDENTIAL_MEMBER_NAMES = [
  ...RAW_SERVER_SESSION_NAMES,
  "getToken",
] as const;
const COMMONJS_FACTORY_MEMBER = "createRequire";
const APPROVED_COMMONJS_CONFIGS = new Set([
  "ecosystem.config.js",
  "postcss.config.js",
]);
const APPROVED_PROCESS_MEMBERS = new Set([
  "argv",
  "cwd",
  "env",
  "exit",
  "exitCode",
  "stdin",
  "stdout",
]);

type CountMap = Record<string, number>;

interface ImportedBinding {
  declaration: ts.Identifier;
  localName: string;
}

interface FileInventory {
  authOptionsImports: number;
  authOptionsReferences: number;
  getServerSessionCalls: number;
  getServerSessionImports: number;
  getTokenCalls: number;
  getTokenImports: number;
}

function isProductionSource(relativePath: string): boolean {
  if (!/\.(?:[cm]?[jt]sx?)$/.test(relativePath)) return false;
  if (/\.d\.(?:[cm]?[jt]s)$/.test(relativePath)) return false;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relativePath)) return false;
  return !relativePath.startsWith("prisma/migrations/");
}

function collectProductionSourceFiles(): string[] {
  const files: string[] = [];

  function visit(absoluteDirectory: string): void {
    const isRepositoryRoot = absoluteDirectory === REPOSITORY_ROOT;
    const entries = readdirSync(absoluteDirectory, {
      withFileTypes: true,
    }).sort((left: Dirent, right: Dirent) =>
      left.name.localeCompare(right.name),
    );

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        if (isRepositoryRoot && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relativePath = path
        .relative(REPOSITORY_ROOT, absolutePath)
        .split(path.sep)
        .join("/");
      if (isProductionSource(relativePath)) files.push(relativePath);
    }
  }

  visit(REPOSITORY_ROOT);
  return files.sort();
}

function scriptKind(relativePath: string): ts.ScriptKind {
  if (/\.(?:tsx)$/.test(relativePath)) return ts.ScriptKind.TSX;
  if (/\.(?:jsx)$/.test(relativePath)) return ts.ScriptKind.JSX;
  if (/\.(?:[cm]?js)$/.test(relativePath)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function increment(map: CountMap, relativePath: string, amount = 1): void {
  map[relativePath] = (map[relativePath] ?? 0) + amount;
}

function location(
  sourceFile: ts.SourceFile,
  relativePath: string,
  node: ts.Node,
): string {
  const point = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return `${relativePath}:${point.line + 1}:${point.character + 1}`;
}

function namedImportBindings(
  declaration: ts.ImportDeclaration,
  importedName: string,
): ImportedBinding[] {
  const bindings = declaration.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return [];
  const matches: ImportedBinding[] = [];
  for (const element of bindings.elements) {
    const originalName = (element.propertyName ?? element.name).text;
    if (originalName === importedName) {
      matches.push({
        declaration: element.name,
        localName: element.name.text,
      });
    }
  }
  return matches;
}

function normalizeModuleName(moduleName: string): string {
  const normalized = path.posix.normalize(moduleName);
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function isNextAuthModule(moduleName: string): boolean {
  const normalizedModuleName = normalizeModuleName(moduleName);
  return (
    normalizedModuleName === "next-auth" ||
    normalizedModuleName.startsWith("next-auth/")
  );
}

function isRawNextAuthDefaultModule(moduleName: string): boolean {
  const normalizedModuleName = normalizeModuleName(moduleName);
  return (
    isNextAuthModule(normalizedModuleName) &&
    !normalizedModuleName.startsWith("next-auth/providers/")
  );
}

function isCommonJsFactoryModule(moduleName: string): boolean {
  return ["module", "node:module"].includes(normalizeModuleName(moduleName));
}

function isProcessBuiltinModule(moduleName: string): boolean {
  return ["process", "node:process"].includes(normalizeModuleName(moduleName));
}

function isAuthOptionsModule(
  moduleName: string,
  importerRelativePath: string,
): boolean {
  const normalizedModuleName = normalizeModuleName(moduleName);
  const authIndexPattern =
    /^@\/lib\/auth(?:\/index)?(?:\.[cm]?[jt]sx?)?$/;
  if (authIndexPattern.test(normalizedModuleName)) return true;
  if (!normalizedModuleName.startsWith(".")) return false;

  const resolvedModuleName = normalizeModuleName(
    path.posix.join(path.posix.dirname(importerRelativePath), moduleName),
  );
  return /^lib\/auth(?:\/index)?(?:\.[cm]?[jt]sx?)?$/.test(
    resolvedModuleName,
  );
}

function readStaticString(expression: ts.Expression): string | null {
  if (ts.isStringLiteralLike(expression)) return expression.text;
  if (ts.isParenthesizedExpression(expression)) {
    return readStaticString(expression.expression);
  }
  if (
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return readStaticString(expression.expression);
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = readStaticString(expression.left);
    const right = readStaticString(expression.right);
    return left === null || right === null ? null : `${left}${right}`;
  }
  return null;
}

function readStaticPropertyName(
  property: ts.PropertyName | ts.BindingName,
): string | null {
  if (ts.isIdentifier(property) || ts.isStringLiteralLike(property)) {
    return property.text;
  }
  if (ts.isComputedPropertyName(property)) {
    return readStaticString(property.expression);
  }
  return null;
}

function isCommonJsLoader(expression: ts.LeftHandSideExpression): boolean {
  if (ts.isIdentifier(expression)) return expression.text === "require";
  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression)
  ) {
    return (
      expression.expression.text === "module" &&
      expression.name.text === "require"
    );
  }
  return (
    ts.isElementAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "module" &&
    readStaticString(expression.argumentExpression) === "require"
  );
}

function isBareRequireIdentifier(node: ts.Identifier): boolean {
  return !(
    ts.isPropertyAccessExpression(node.parent) && node.parent.name === node
  ) && node.text === "require";
}

function isDirectCallCallee(node: ts.LeftHandSideExpression): boolean {
  return ts.isCallExpression(node.parent) && node.parent.expression === node;
}

function isApprovedCommonJsExportReference(
  node: ts.Identifier,
  relativePath: string,
): boolean {
  if (!APPROVED_COMMONJS_CONFIGS.has(relativePath)) return false;
  const access = node.parent;
  if (
    !ts.isPropertyAccessExpression(access) ||
    access.expression !== node ||
    access.name.text !== "exports"
  ) {
    return false;
  }
  const assignment = access.parent;
  return (
    ts.isBinaryExpression(assignment) &&
    assignment.left === access &&
    assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );
}

function isApprovedProcessReference(node: ts.Identifier): boolean {
  const access = node.parent;
  return (
    ts.isPropertyAccessExpression(access) &&
    access.expression === node &&
    APPROVED_PROCESS_MEMBERS.has(access.name.text)
  );
}

function isApprovedFacadeAuthOptionsDestructure(
  node: ts.BindingElement,
  relativePath: string,
  sourceFile: ts.SourceFile,
): boolean {
  if (relativePath !== "lib/auth/server-session.ts") return false;
  if (node.propertyName || node.dotDotDotToken || node.initializer) return false;
  if (!ts.isIdentifier(node.name) || node.name.text !== "authOptions") {
    return false;
  }

  const bindingPattern = node.parent;
  if (
    !ts.isObjectBindingPattern(bindingPattern) ||
    bindingPattern.elements.length !== 1 ||
    bindingPattern.elements[0] !== node
  ) {
    return false;
  }
  const declaration = bindingPattern.parent;
  if (!ts.isVariableDeclaration(declaration) || !declaration.initializer) {
    return false;
  }
  const declarationList = declaration.parent;
  if (
    !ts.isVariableDeclarationList(declarationList) ||
    declarationList.declarations.length !== 1 ||
    !(declarationList.flags & ts.NodeFlags.Const)
  ) {
    return false;
  }
  const initializer = declaration.initializer;
  if (!ts.isAwaitExpression(initializer)) return false;
  const importCall = initializer.expression;
  if (
    !ts.isCallExpression(importCall) ||
    importCall.expression.kind !== ts.SyntaxKind.ImportKeyword ||
    importCall.arguments.length !== 1
  ) {
    return false;
  }
  return importCall.arguments[0].getText(sourceFile) === '"./index"';
}

function isDirectCallReference(node: ts.Identifier): boolean {
  return ts.isCallExpression(node.parent) && node.parent.expression === node;
}

function inspectFile(
  relativePath: string,
  violations: string[],
  sourceOverride?: string,
): FileInventory {
  const source =
    sourceOverride ??
    readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(relativePath),
  );
  const inventory: FileInventory = {
    authOptionsImports: 0,
    authOptionsReferences: 0,
    getServerSessionCalls: 0,
    getServerSessionImports: 0,
    getTokenCalls: 0,
    getTokenImports: 0,
  };
  let authOptionsBinding: ImportedBinding | null = null;
  let serverSessionBinding: ImportedBinding | null = null;
  let getTokenBinding: ImportedBinding | null = null;
  let nextAuthHandlerBinding: ts.Identifier | null = null;
  let facadeAuthOptionsBinding: ts.Identifier | null = null;
  let facadeAuthOptionsReferences = 0;

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const moduleName = statement.moduleSpecifier.text;
      const bindings = statement.importClause?.namedBindings;
      if (
        isNextAuthModule(moduleName) &&
        bindings &&
        ts.isNamespaceImport(bindings)
      ) {
        violations.push(
          `${location(sourceFile, relativePath, statement)} namespace NextAuth import nije dozvoljen`,
        );
      }
      if (
        isAuthOptionsModule(moduleName, relativePath) &&
        bindings &&
        ts.isNamespaceImport(bindings)
      ) {
        violations.push(
          `${location(sourceFile, relativePath, statement)} namespace authOptions import nije dozvoljen`,
        );
      }
      if (
        isRawNextAuthDefaultModule(moduleName) &&
        statement.importClause?.name
      ) {
        if (
          moduleName !== "next-auth" ||
          relativePath !== NEXTAUTH_HANDLER ||
          statement.importClause.name.text !== "NextAuth" ||
          nextAuthHandlerBinding
        ) {
          violations.push(
            `${location(sourceFile, relativePath, statement)} neodobren default NextAuth import`,
          );
        } else {
          nextAuthHandlerBinding = statement.importClause.name;
        }
      }
      if (isCommonJsFactoryModule(moduleName)) {
        violations.push(
          `${location(sourceFile, relativePath, statement)} module builtin import nije dozvoljen`,
        );
      }
      if (isProcessBuiltinModule(moduleName)) {
        violations.push(
          `${location(sourceFile, relativePath, statement)} process builtin import nije dozvoljen`,
        );
      }
      if (
        isRawNextAuthDefaultModule(moduleName) &&
        namedImportBindings(statement, "default").length > 0
      ) {
        violations.push(
          `${location(sourceFile, relativePath, statement)} named default NextAuth import nije dozvoljen`,
        );
      }

      const canonicalServerSessions = namedImportBindings(
        statement,
        "getServerSession",
      );
      const unstableServerSessions = namedImportBindings(
        statement,
        "unstable_getServerSession",
      );
      const rawServerSessions = [
        ...canonicalServerSessions,
        ...unstableServerSessions,
      ];
      if (rawServerSessions.length > 0) {
        inventory.getServerSessionImports += rawServerSessions.length;
        if (
          moduleName !== "next-auth" ||
          serverSessionBinding ||
          canonicalServerSessions.length !== 1 ||
          unstableServerSessions.length !== 0
        ) {
          violations.push(
            `${location(sourceFile, relativePath, statement)} nekanonski ili dupli getServerSession import`,
          );
        } else {
          serverSessionBinding = canonicalServerSessions[0];
        }
      }

      const rawGetTokens = namedImportBindings(statement, "getToken");
      if (rawGetTokens.length > 0) {
        inventory.getTokenImports += rawGetTokens.length;
        if (
          moduleName !== "next-auth/jwt" ||
          getTokenBinding ||
          rawGetTokens.length !== 1
        ) {
          violations.push(
            `${location(sourceFile, relativePath, statement)} nekanonski ili dupli getToken import`,
          );
        } else {
          getTokenBinding = rawGetTokens[0];
        }
      }

      const rawAuthOptions = namedImportBindings(statement, "authOptions");
      if (rawAuthOptions.length > 0) {
        inventory.authOptionsImports += rawAuthOptions.length;
        if (
          moduleName !== "@/lib/auth" ||
          authOptionsBinding ||
          rawAuthOptions.length !== 1
        ) {
          violations.push(
            `${location(sourceFile, relativePath, statement)} nekanonski ili dupli authOptions import`,
          );
        } else {
          authOptionsBinding = rawAuthOptions[0];
        }
      }
    }

    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteralLike(statement.moduleReference.expression) &&
      (isNextAuthModule(statement.moduleReference.expression.text) ||
        isCommonJsFactoryModule(
          statement.moduleReference.expression.text,
        ) ||
        isProcessBuiltinModule(statement.moduleReference.expression.text) ||
        isAuthOptionsModule(
          statement.moduleReference.expression.text,
          relativePath,
        ))
    ) {
      violations.push(
        `${location(sourceFile, relativePath, statement)} import-equals credential put nije dozvoljen`,
      );
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isProcessBuiltinModule(statement.moduleSpecifier.text)
    ) {
      violations.push(
        `${location(sourceFile, relativePath, statement)} process builtin re-export nije dozvoljen`,
      );
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isCommonJsFactoryModule(statement.moduleSpecifier.text)
    ) {
      violations.push(
        `${location(sourceFile, relativePath, statement)} module builtin re-export nije dozvoljen`,
      );
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isNextAuthModule(statement.moduleSpecifier.text)
    ) {
      const exportModuleName = statement.moduleSpecifier.text;
      const exported = statement.exportClause;
      if (
        !exported ||
        ts.isNamespaceExport(exported) ||
        (ts.isNamedExports(exported) &&
          exported.elements.some((element) => {
            const originalName = (element.propertyName ?? element.name).text;
            return (
              RAW_CREDENTIAL_MEMBER_NAMES.includes(
                originalName as (typeof RAW_CREDENTIAL_MEMBER_NAMES)[number],
              ) ||
              (isRawNextAuthDefaultModule(exportModuleName) &&
                originalName === "default")
            );
          }))
      ) {
        violations.push(
          `${location(sourceFile, relativePath, statement)} raw session re-export nije dozvoljen`,
        );
      }
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some(
        (element) =>
          (element.propertyName ?? element.name).text === "authOptions",
      )
    ) {
      violations.push(
        `${location(sourceFile, relativePath, statement)} authOptions re-export nije dozvoljen`,
      );
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isAuthOptionsModule(statement.moduleSpecifier.text, relativePath) &&
      (!statement.exportClause || ts.isNamespaceExport(statement.exportClause))
    ) {
      violations.push(
        `${location(sourceFile, relativePath, statement)} authOptions namespace/star re-export nije dozvoljen`,
      );
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const argument = node.arguments[0];
        const moduleName = argument ? readStaticString(argument) : null;
        if (
          moduleName !== null &&
          (isNextAuthModule(moduleName) ||
            isCommonJsFactoryModule(moduleName) ||
            isProcessBuiltinModule(moduleName) ||
            (isAuthOptionsModule(moduleName, relativePath) &&
              !(
                relativePath === "lib/auth/server-session.ts" &&
                moduleName === "./index"
              )))
        ) {
          violations.push(
            `${location(sourceFile, relativePath, node)} dynamic NextAuth import nije dozvoljen`,
          );
        } else if (
          moduleName === null &&
          !(
            relativePath === "i18n/request.ts" &&
            argument?.getText(sourceFile) === "`../messages/${locale}.json`"
          )
        ) {
          violations.push(
            `${location(sourceFile, relativePath, node)} neodobren neliteralni dynamic import`,
          );
        }
      }
      if (
        isCommonJsLoader(node.expression) &&
        node.arguments.length > 0
      ) {
        const moduleName = readStaticString(node.arguments[0]);
        if (
          moduleName === null ||
          isNextAuthModule(moduleName) ||
          isCommonJsFactoryModule(moduleName) ||
          isProcessBuiltinModule(moduleName) ||
          isAuthOptionsModule(moduleName, relativePath)
        ) {
          violations.push(
            `${location(sourceFile, relativePath, node)} neodobren require credential put`,
          );
        }
      }
      if (
        node.expression.kind !== ts.SyntaxKind.ImportKeyword &&
        !isCommonJsLoader(node.expression) &&
        node.arguments.some((argument) => {
          const moduleName = readStaticString(argument);
          return (
            moduleName !== null &&
            (isNextAuthModule(moduleName) ||
              isCommonJsFactoryModule(moduleName) ||
              isProcessBuiltinModule(moduleName) ||
              isAuthOptionsModule(moduleName, relativePath))
          );
        })
      ) {
        violations.push(
          `${location(sourceFile, relativePath, node)} neodobren indirektni credential module loader`,
        );
      }

      if (ts.isIdentifier(node.expression)) {
        const calledName = node.expression.text;
        if (serverSessionBinding?.localName === calledName) {
          inventory.getServerSessionCalls += 1;
          const argument = node.arguments[0];
          const hasExpectedArgument =
            node.arguments.length === 1 &&
            ts.isIdentifier(argument) &&
            (relativePath === "lib/auth/server-session.ts"
              ? argument.text === facadeAuthOptionsBinding?.text
              : argument.text === authOptionsBinding?.localName);
          if (!hasExpectedArgument) {
            violations.push(
              `${location(sourceFile, relativePath, node)} getServerSession mora dobiti tačno kanonski authOptions`,
            );
          }
        } else if (calledName === "getServerSession") {
          violations.push(
            `${location(sourceFile, relativePath, node)} nepoznat getServerSession binding`,
          );
        }

        if (calledName === "unstable_getServerSession") {
          violations.push(
            `${location(sourceFile, relativePath, node)} unstable_getServerSession nije dozvoljen`,
          );
        }

        if (getTokenBinding?.localName === calledName) {
          inventory.getTokenCalls += 1;
        } else if (calledName === "getToken") {
          violations.push(
            `${location(sourceFile, relativePath, node)} nepoznat getToken binding`,
          );
        }
        if (calledName === "NextAuth") {
          const argument = node.arguments[0];
          if (
            relativePath !== NEXTAUTH_HANDLER ||
            !nextAuthHandlerBinding ||
            node.expression.text !== nextAuthHandlerBinding.text ||
            node.arguments.length !== 1 ||
            !ts.isIdentifier(argument) ||
            argument.text !== authOptionsBinding?.localName
          ) {
            violations.push(
              `${location(sourceFile, relativePath, node)} neodobren NextAuth handler wiring`,
            );
          }
        }
        if (calledName === COMMONJS_FACTORY_MEMBER) {
          violations.push(
            `${location(sourceFile, relativePath, node)} nepoznat createRequire binding`,
          );
        }
      }
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "authOptions"
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} namespace/property authOptions nije dozvoljen`,
      );
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      RAW_CREDENTIAL_MEMBER_NAMES.includes(
        node.name.text as (typeof RAW_CREDENTIAL_MEMBER_NAMES)[number],
      )
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} namespace/property session pristup nije dozvoljen`,
      );
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === COMMONJS_FACTORY_MEMBER
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} createRequire property pristup nije dozvoljen`,
      );
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "process"
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} indirektan process pristup nije dozvoljen`,
      );
    }
    if (
      ts.isElementAccessExpression(node) &&
      readStaticString(node.argumentExpression) === "authOptions"
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} computed authOptions nije dozvoljen`,
      );
    }
    if (
      ts.isElementAccessExpression(node) &&
      RAW_CREDENTIAL_MEMBER_NAMES.includes(
        readStaticString(
          node.argumentExpression,
        ) as (typeof RAW_CREDENTIAL_MEMBER_NAMES)[number],
      )
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} computed session pristup nije dozvoljen`,
      );
    }
    if (
      ts.isElementAccessExpression(node) &&
      readStaticString(node.argumentExpression) === COMMONJS_FACTORY_MEMBER
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} computed createRequire pristup nije dozvoljen`,
      );
    }
    if (
      ts.isElementAccessExpression(node) &&
      readStaticString(node.argumentExpression) === "process"
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} computed process pristup nije dozvoljen`,
      );
    }
    if (
      ((ts.isIdentifier(node) && isBareRequireIdentifier(node)) ||
        ((ts.isPropertyAccessExpression(node) ||
          ts.isElementAccessExpression(node)) &&
          isCommonJsLoader(node))) &&
      !isDirectCallCallee(node)
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} CommonJS loader ne sme da se prosleđuje ili aliasuje`,
      );
    }
    if (
      ts.isBindingElement(node) &&
      readStaticPropertyName(node.propertyName ?? node.name) === "authOptions"
    ) {
      if (
        !isApprovedFacadeAuthOptionsDestructure(
          node,
          relativePath,
          sourceFile,
        ) ||
        facadeAuthOptionsBinding
      ) {
        violations.push(
          `${location(sourceFile, relativePath, node)} dynamic/destructured authOptions nije dozvoljen`,
        );
      } else {
        facadeAuthOptionsBinding = node.name as ts.Identifier;
      }
    }
    if (
      ts.isBindingElement(node) &&
      RAW_CREDENTIAL_MEMBER_NAMES.includes(
        readStaticPropertyName(
          node.propertyName ?? node.name,
        ) as (typeof RAW_CREDENTIAL_MEMBER_NAMES)[number],
      )
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} destructured raw session credential nije dozvoljen`,
      );
    }
    if (
      ts.isBindingElement(node) &&
      readStaticPropertyName(node.propertyName ?? node.name) ===
        COMMONJS_FACTORY_MEMBER
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} destructured createRequire nije dozvoljen`,
      );
    }

    if (ts.isIdentifier(node)) {
      if (node.text === "process" && !isApprovedProcessReference(node)) {
        violations.push(
          `${location(sourceFile, relativePath, node)} process sme samo kroz odobreni direktni član`,
        );
      }
      if (
        node.text === "module" &&
        !isApprovedCommonJsExportReference(node, relativePath)
      ) {
        violations.push(
          `${location(sourceFile, relativePath, node)} bare CommonJS module pristup nije dozvoljen`,
        );
      }
      if (
        facadeAuthOptionsBinding &&
        node.text === facadeAuthOptionsBinding.text &&
        node !== facadeAuthOptionsBinding
      ) {
        facadeAuthOptionsReferences += 1;
        const parent = node.parent;
        if (
          !(
            ts.isCallExpression(parent) &&
            parent.arguments.length === 1 &&
            parent.arguments[0] === node &&
            ts.isIdentifier(parent.expression) &&
            parent.expression.text === serverSessionBinding?.localName
          )
        ) {
          violations.push(
            `${location(sourceFile, relativePath, node)} facade authOptions ima neodobrenog potrošača`,
          );
        }
      }
      if (
        serverSessionBinding &&
        node.text === serverSessionBinding.localName &&
        node !== serverSessionBinding.declaration &&
        !isDirectCallReference(node)
      ) {
        violations.push(
          `${location(sourceFile, relativePath, node)} getServerSession binding ne sme da se prosleđuje ili aliasuje`,
        );
      }
      if (
        getTokenBinding &&
        node.text === getTokenBinding.localName &&
        node !== getTokenBinding.declaration &&
        !isDirectCallReference(node)
      ) {
        violations.push(
          `${location(sourceFile, relativePath, node)} getToken binding ne sme da se prosleđuje ili aliasuje`,
        );
      }
      if (
        nextAuthHandlerBinding &&
        node.text === nextAuthHandlerBinding.text &&
        node !== nextAuthHandlerBinding &&
        !isDirectCallReference(node)
      ) {
        violations.push(
          `${location(sourceFile, relativePath, node)} NextAuth binding ne sme da se prosleđuje ili aliasuje`,
        );
      }
      if (
        authOptionsBinding &&
        node.text === authOptionsBinding.localName &&
        node !== authOptionsBinding.declaration
      ) {
        inventory.authOptionsReferences += 1;
        const parent = node.parent;
        const allowedConsumerArgument =
          ts.isCallExpression(parent) &&
          parent.arguments.length === 1 &&
          parent.arguments[0] === node &&
          ts.isIdentifier(parent.expression) &&
          parent.expression.text === serverSessionBinding?.localName;
        const allowedNextAuthHandler =
          relativePath === NEXTAUTH_HANDLER &&
          ts.isCallExpression(parent) &&
          parent.arguments.length === 1 &&
          parent.arguments[0] === node &&
          ts.isIdentifier(parent.expression) &&
          parent.expression.text === "NextAuth";
        if (!allowedConsumerArgument && !allowedNextAuthHandler) {
          violations.push(
            `${location(sourceFile, relativePath, node)} authOptions ima neodobrenog potrošača`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (
    relativePath === "lib/auth/server-session.ts" &&
    (!facadeAuthOptionsBinding || facadeAuthOptionsReferences !== 1)
  ) {
    violations.push(
      `${relativePath}: facade mora imati jedan const authOptions binding i jedan direktan read`,
    );
  }
  return inventory;
}

function sortedRecord(record: CountMap): CountMap {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function sum(record: CountMap): number {
  return Object.values(record).reduce((total, count) => total + count, 0);
}

test("legacy session reads remain on the exact shrinking transitional allowlist", () => {
  const violations: string[] = [];
  const serverSessionCalls: CountMap = {};
  const serverSessionImports: CountMap = {};
  const getTokenCalls: CountMap = {};
  const getTokenImports: CountMap = {};
  const authOptionsImports: CountMap = {};
  const authOptionsReferences: CountMap = {};

  for (const relativePath of collectProductionSourceFiles()) {
    const inventory = inspectFile(relativePath, violations);
    increment(serverSessionCalls, relativePath, inventory.getServerSessionCalls);
    increment(
      serverSessionImports,
      relativePath,
      inventory.getServerSessionImports,
    );
    increment(getTokenCalls, relativePath, inventory.getTokenCalls);
    increment(getTokenImports, relativePath, inventory.getTokenImports);
    increment(authOptionsImports, relativePath, inventory.authOptionsImports);
    increment(
      authOptionsReferences,
      relativePath,
      inventory.authOptionsReferences,
    );
  }

  const expectedConsumerCalls = sortedRecord(EXPECTED_LEGACY_CONSUMER_CALLS);
  const expectedAllServerCalls = sortedRecord({
    ...EXPECTED_LEGACY_CONSUMER_CALLS,
    ...EXPECTED_SERVER_SESSION_WIRING,
  });
  const expectedServerSessionImports = sortedRecord(
    Object.fromEntries(
      Object.keys(expectedAllServerCalls).map((relativePath) => [
        relativePath,
        1,
      ]),
    ),
  );
  const expectedAuthOptionsImports = sortedRecord({
    ...Object.fromEntries(
      Object.keys(EXPECTED_LEGACY_CONSUMER_CALLS).map((relativePath) => [
        relativePath,
        1,
      ]),
    ),
    [NEXTAUTH_HANDLER]: 1,
  });
  const expectedAuthOptionsReferences = sortedRecord({
    ...EXPECTED_LEGACY_CONSUMER_CALLS,
    [NEXTAUTH_HANDLER]: 1,
  });

  assert.deepEqual(violations, []);
  assert.deepEqual(sortedRecord(serverSessionCalls), expectedAllServerCalls);
  assert.deepEqual(
    sortedRecord(serverSessionImports),
    expectedServerSessionImports,
  );
  assert.deepEqual(sortedRecord(getTokenCalls), EXPECTED_GET_TOKEN_CALLS);
  assert.deepEqual(sortedRecord(getTokenImports), EXPECTED_GET_TOKEN_CALLS);
  assert.deepEqual(sortedRecord(authOptionsImports), expectedAuthOptionsImports);
  assert.deepEqual(
    sortedRecord(authOptionsReferences),
    expectedAuthOptionsReferences,
  );

  assert.equal(Object.keys(expectedConsumerCalls).length, 54);
  assert.equal(sum(expectedConsumerCalls), 97);
  assert.equal(Object.keys(sortedRecord(serverSessionCalls)).length, 55);
  assert.equal(sum(sortedRecord(serverSessionCalls)), 98);
  assert.equal(Object.keys(sortedRecord(getTokenCalls)).length, 2);
  assert.equal(sum(sortedRecord(getTokenCalls)), 2);
});

test("inventory rejects reviewed import, alias and re-export bypass forms", () => {
  const fixtures: Array<{
    name: string;
    relativePath?: string;
    source: string;
    expected: RegExp;
  }> = [
    {
      name: "unstable-subpath",
      source: `
        import { unstable_getServerSession as read } from "next-auth/next";
        import { authOptions } from "@/lib/auth";
        void read(authOptions);
      `,
      expected: /nekanonski ili dupli getServerSession import/,
    },
    {
      name: "namespace-alias",
      source: `
        import * as Legacy from "next-auth/next";
        import * as Auth from "@/lib/auth";
        const read = Legacy.getServerSession;
        void read(Auth.authOptions);
      `,
      expected: /namespace NextAuth import nije dozvoljen/,
    },
    {
      name: "namespace-re-export",
      source: `export * as Legacy from "next-auth/next";`,
      expected: /raw session re-export nije dozvoljen/,
    },
    {
      name: "template-dynamic-import",
      source: "void import(`next-auth/next`);",
      expected: /dynamic NextAuth import nije dozvoljen/,
    },
    {
      name: "concatenated-require",
      source: `void require("next-" + "auth/jwt");`,
      expected: /neodobren require credential put/,
    },
    {
      name: "duplicate-alias-import",
      source: `
        import {
          getServerSession as first,
          getServerSession as second,
        } from "next-auth";
      `,
      expected: /nekanonski ili dupli getServerSession import/,
    },
    {
      name: "computed-property-call",
      source: `void holder["getToken"]({});`,
      expected: /computed session pristup nije dozvoljen/,
    },
    {
      name: "variable-dynamic-import",
      source: `const moduleName = "next-auth"; void import(moduleName);`,
      expected: /neodobren neliteralni dynamic import/,
    },
    {
      name: "import-equals",
      source: `import Legacy = require("next-auth/next");`,
      expected: /import-equals credential put nije dozvoljen/,
    },
    {
      name: "dynamic-auth-options-index-alias",
      source: `
        const { authOptions: options } = await import("@/lib/auth/index");
        void options;
      `,
      expected: /dynamic NextAuth import nije dozvoljen/,
    },
    {
      name: "require-auth-options-index-alias",
      source: `
        const { authOptions: options } = require("@/lib/auth/index");
        void options;
      `,
      expected: /neodobren require credential put/,
    },
    {
      name: "auth-options-index-star-re-export",
      source: `export * from "@/lib/auth/index";`,
      expected: /authOptions namespace\/star re-export nije dozvoljen/,
    },
    {
      name: "auth-options-trailing-slash-star-re-export",
      source: `export * from "@/lib/auth/";`,
      expected: /authOptions namespace\/star re-export nije dozvoljen/,
    },
    {
      name: "relative-auth-options-star-re-export",
      source: `export * from "../lib/auth/";`,
      expected: /authOptions namespace\/star re-export nije dozvoljen/,
    },
    {
      name: "next-auth-default-re-export",
      source: `export { default as HiddenNextAuth } from "next-auth";`,
      expected: /raw session re-export nije dozvoljen/,
    },
    {
      name: "next-auth-named-default-import",
      source: `import { default as HiddenNextAuth } from "next-auth";`,
      expected: /named default NextAuth import nije dozvoljen/,
    },
    {
      name: "next-auth-indirect-alias",
      relativePath: NEXTAUTH_HANDLER,
      source: `
        import NextAuth from "next-auth";
        import { authOptions } from "@/lib/auth";
        const handler = NextAuth(authOptions);
        export const HiddenNextAuth = NextAuth;
        export { handler as GET, handler as POST };
      `,
      expected: /NextAuth binding ne sme da se prosleđuje ili aliasuje/,
    },
    {
      name: "module-require-aliased-destructure",
      source: `
        const { getServerSession: read } = module.require("next-auth");
        const { authOptions: options } = module.require("@/lib/auth");
        void read(options);
      `,
      expected: /neodobren require credential put/,
    },
    {
      name: "computed-module-require",
      source: `void module["re" + "quire"]("next-auth/jwt");`,
      expected: /neodobren require credential put/,
    },
    {
      name: "aliased-module-require-member-extraction",
      source: `
        const load = module["re" + "quire"];
        const rawRead = load("next-auth")["get" + "ServerSession"];
        void rawRead({});
      `,
      expected: /CommonJS loader ne sme da se prosleđuje ili aliasuje/,
    },
    {
      name: "indirect-static-credential-loader",
      source: `
        const load = createRequire(import.meta.url);
        const rawRead = load("next-auth").getServerSession;
        void rawRead({});
      `,
      expected: /neodobren indirektni credential module loader/,
    },
    {
      name: "create-require-variable-module-and-member",
      source: `
        import { createRequire } from "node:module";
        const load = createRequire(import.meta.url);
        const packageName = "next-auth";
        const memberName = "getServerSession";
        const rawRead = load(packageName)[memberName];
        void rawRead({});
      `,
      expected: /module builtin import nije dozvoljen/,
    },
    {
      name: "module-named-export-create-require",
      source: `
        import { Module } from "node:module";
        const factoryName = "createRequire";
        const load = Module[factoryName](import.meta.url);
        const packageName = "next-auth";
        const memberName = "getServerSession";
        const rawRead = load(packageName)[memberName];
        void rawRead({});
      `,
      expected: /module builtin import nije dozvoljen/,
    },
    {
      name: "module-named-default-create-require",
      source: `
        import { default as Module } from "node:module";
        const factoryName = "createRequire";
        const make = Module[factoryName];
        const load = make(import.meta.url);
        const packageName = "next-auth";
        const memberName = "getServerSession";
        const rawRead = load(packageName)[memberName];
        void rawRead({});
      `,
      expected: /module builtin import nije dozvoljen/,
    },
    {
      name: "global-module-computed-loader-constants",
      source: `
        const loaderName = "require";
        const packageName = "next-auth";
        const memberName = "getServerSession";
        const rawRead = module[loaderName](packageName)[memberName];
        void rawRead({});
      `,
      expected: /bare CommonJS module pristup nije dozvoljen/,
    },
    {
      name: "process-get-builtin-module-loader",
      source: `
        const Module = process.getBuiltinModule("module");
        const factoryName = "createRequire";
        const load = Module[factoryName](import.meta.url);
        const packageName = "next-auth";
        const memberName = "getServerSession";
        const rawRead = load(packageName)[memberName];
        void rawRead({});
      `,
      expected: /process sme samo kroz odobreni direktni član/,
    },
    {
      name: "process-builtin-import",
      source: `import Process from "node:process"; void Process;`,
      expected: /process builtin import nije dozvoljen/,
    },
    {
      name: "mutable-facade-auth-options",
      relativePath: "lib/auth/server-session.ts",
      source: `
        import { getServerSession } from "next-auth";
        async function read() {
          let { authOptions } = await import("./index");
          return getServerSession(authOptions);
        }
        void read;
      `,
      expected: /dynamic\/destructured authOptions nije dozvoljen/,
    },
    {
      name: "facade-auth-options-second-consumer",
      relativePath: "lib/auth/server-session.ts",
      source: `
        import { getServerSession } from "next-auth";
        async function read() {
          const { authOptions } = await import("./index");
          void authOptions;
          return getServerSession(authOptions);
        }
        void read;
      `,
      expected: /facade authOptions ima neodobrenog potrošača/,
    },
    {
      name: "next-auth-trailing-slash-default",
      source: `import HiddenNextAuth from "next-auth/";`,
      expected: /neodobren default NextAuth import/,
    },
  ];

  for (const fixture of fixtures) {
    const violations: string[] = [];
    inspectFile(
      fixture.relativePath ?? `fixture/${fixture.name}.ts`,
      violations,
      fixture.source,
    );
    assert.match(violations.join("\n"), fixture.expected, fixture.name);
  }
});
