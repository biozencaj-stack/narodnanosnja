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
  "app/api/user/password/route.ts": 1,
  "app/api/user/profile/route.ts": 2,
  // Jedan zajednički pomoćnik za ADMIN provere na admin STRANICAMA. Postoji da
  // bi spisak rastao za jedan unos umesto za svaku novu admin stranicu;
  // postojeće stranice mogu kasnije da pređu na njega i time ga smanje.
  "lib/auth/admin-stranica.ts": 1,
  "lib/checkout/order-handler.ts": 1,
} as const);

const EXPECTED_SERVER_SESSION_WIRING = Object.freeze({
  "lib/auth/server-session.ts": 1,
} as const);

const EXPECTED_GET_TOKEN_CALLS = Object.freeze({
  "app/api/auth/verify-email/[token]/route.ts": 1,
  "proxy.ts": 1,
} as const);

const CHECKOUT_DATA_ROUTE = "app/api/user/checkout-data/route.ts";
const CHECKOUT_DATA_FACTORY_MODULE =
  "@/lib/checkout/checkout-data-route";
const WISHLIST_ROUTE = "app/api/wishlist/route.ts";
const WISHLIST_FACTORY_MODULE = "@/lib/wishlist/wishlist-route";
const SEKCIJE_ROUTE = "app/api/admin/sekcije/route.ts";
const SEKCIJA_ROUTE = "app/api/admin/sekcije/[id]/route.ts";
const SEKCIJE_REDOSLED_ROUTE = "app/api/admin/sekcije/redosled/route.ts";
const SEKCIJE_OBJAVI_ROUTE = "app/api/admin/sekcije/objavi/route.ts";
const SEKCIJE_FACTORY_MODULE = "@/lib/sekcije/rute";
const MEDIJATEKA_ROUTE = "app/api/admin/medijateka/route.ts";
const MEDIJATEKA_ASSET_ROUTE = "app/api/admin/medijateka/[id]/route.ts";
const MEDIJATEKA_FACTORY_MODULE = "@/lib/media/medijateka-rute";
const SERVER_SESSION_FACADE_MODULE = "@/lib/auth/server-session";
const NEXTAUTH_HANDLER = "app/api/auth/[...nextauth]/route.ts";
const ROUTE_HTTP_METHOD_NAMES = new Set([
  "CONNECT",
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
  "TRACE",
]);
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

interface SessionFactorySpec {
  dependencyKeys: readonly string[];
  factoryModule: string;
  factoryName: string;
  handlerExport: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  routePath: string;
}

const SESSION_FACTORY_SPECS = Object.freeze([
  {
    routePath: CHECKOUT_DATA_ROUTE,
    factoryModule: CHECKOUT_DATA_FACTORY_MODULE,
    factoryName: "createCheckoutDataGetHandler",
    handlerExport: "GET",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "findUserById",
      "reportFailure",
    ]),
  },
  {
    routePath: WISHLIST_ROUTE,
    factoryModule: WISHLIST_FACTORY_MODULE,
    factoryName: "createWishlistGetHandler",
    handlerExport: "GET",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "findItemsByUserId",
      "reportFailure",
    ]),
  },
  {
    routePath: WISHLIST_ROUTE,
    factoryModule: WISHLIST_FACTORY_MODULE,
    factoryName: "createWishlistPostHandler",
    handlerExport: "POST",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "upsertItem",
      "reportFailure",
    ]),
  },
  {
    routePath: WISHLIST_ROUTE,
    factoryModule: WISHLIST_FACTORY_MODULE,
    factoryName: "createWishlistDeleteHandler",
    handlerExport: "DELETE",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "deleteItems",
      "reportFailure",
    ]),
  },
  {
    routePath: SEKCIJE_ROUTE,
    factoryModule: SEKCIJE_FACTORY_MODULE,
    factoryName: "createSekcijeGetHandler",
    handlerExport: "GET",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "nadjiSekcije",
      "reportFailure",
    ]),
  },
  {
    routePath: SEKCIJE_ROUTE,
    factoryModule: SEKCIJE_FACTORY_MODULE,
    factoryName: "createSekcijePostHandler",
    handlerExport: "POST",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "prebrojTipNaStrani",
      "poslednjiRedosled",
      "napravi",
      "reportFailure",
    ]),
  },
  {
    routePath: SEKCIJA_ROUTE,
    factoryModule: SEKCIJE_FACTORY_MODULE,
    factoryName: "createSekcijaPutHandler",
    handlerExport: "PUT",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "nadjiSekciju",
      "izmeniUslovno",
      "ucitaj",
      "ponistiKes",
      "reportFailure",
    ]),
  },
  {
    routePath: SEKCIJA_ROUTE,
    factoryModule: SEKCIJE_FACTORY_MODULE,
    factoryName: "createSekcijaDeleteHandler",
    handlerExport: "DELETE",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "nadjiSekciju",
      "obrisiUslovno",
      "ponistiKes",
      "reportFailure",
    ]),
  },
  {
    routePath: SEKCIJE_REDOSLED_ROUTE,
    factoryModule: SEKCIJE_FACTORY_MODULE,
    factoryName: "createRedosledPostHandler",
    handlerExport: "POST",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "presloziUTransakciji",
      "ponistiKes",
      "reportFailure",
    ]),
  },
  {
    routePath: SEKCIJE_OBJAVI_ROUTE,
    factoryModule: SEKCIJE_FACTORY_MODULE,
    factoryName: "createObjaviPostHandler",
    handlerExport: "POST",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "objaviStranicu",
      "ponistiKes",
      "reportFailure",
    ]),
  },
  {
    routePath: MEDIJATEKA_ROUTE,
    factoryModule: MEDIJATEKA_FACTORY_MODULE,
    factoryName: "createMedijatekaGetHandler",
    handlerExport: "GET",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "nadjiAssete",
      "reportFailure",
    ]),
  },
  {
    routePath: MEDIJATEKA_ASSET_ROUTE,
    factoryModule: MEDIJATEKA_FACTORY_MODULE,
    factoryName: "createMedijatekaDeleteHandler",
    handlerExport: "DELETE",
    dependencyKeys: Object.freeze([
      "resolveSession",
      "nadjiUpotrebe",
      "obrisiAsset",
      "reportFailure",
    ]),
  },
] satisfies readonly SessionFactorySpec[]);

function buildFactorySpecsByRoute(
  factorySpecs: readonly SessionFactorySpec[],
): ReadonlyMap<string, readonly SessionFactorySpec[]> {
  const specsByRoute = new Map<string, SessionFactorySpec[]>();
  const handlerIdentities = new Set<string>();
  const factoryNames = new Set<string>();

  for (const factorySpec of factorySpecs) {
    const handlerIdentity = `${factorySpec.routePath}\0${factorySpec.handlerExport}`;
    if (handlerIdentities.has(handlerIdentity)) {
      throw new Error(`Duplicate session factory handler: ${handlerIdentity}`);
    }
    if (factoryNames.has(factorySpec.factoryName)) {
      throw new Error(
        `Duplicate session factory identity: ${factorySpec.factoryName}`,
      );
    }
    if (
      factorySpec.dependencyKeys.length !==
        new Set(factorySpec.dependencyKeys).size ||
      !factorySpec.dependencyKeys.includes("resolveSession") ||
      !factorySpec.dependencyKeys.includes("reportFailure")
    ) {
      throw new Error(
        `Invalid dependency registry for ${factorySpec.factoryName}`,
      );
    }

    handlerIdentities.add(handlerIdentity);
    factoryNames.add(factorySpec.factoryName);
    const routeSpecs = specsByRoute.get(factorySpec.routePath) ?? [];
    routeSpecs.push(factorySpec);
    specsByRoute.set(factorySpec.routePath, routeSpecs);
  }

  return new Map(
    [...specsByRoute].map(([routePath, routeSpecs]) => [
      routePath,
      Object.freeze([...routeSpecs]),
    ]),
  );
}

const SESSION_FACTORY_SPECS_BY_ROUTE = buildFactorySpecsByRoute(
  SESSION_FACTORY_SPECS,
);
const SESSION_FACTORY_MODULES = new Set(
  SESSION_FACTORY_SPECS.map((factorySpec) => factorySpec.factoryModule),
);

function expectedNeutralCallsByRoute(
  factorySpecs: readonly SessionFactorySpec[],
): CountMap {
  const expectedCalls: CountMap = {};
  for (const factorySpec of factorySpecs) {
    expectedCalls[factorySpec.routePath] =
      (expectedCalls[factorySpec.routePath] ?? 0) + 1;
  }
  return expectedCalls;
}

function expectedNeutralImportsByRoute(
  specsByRoute: ReadonlyMap<string, readonly SessionFactorySpec[]>,
): CountMap {
  return Object.fromEntries(
    [...specsByRoute.keys()].map((routePath) => [routePath, 1]),
  );
}

const EXPECTED_NEUTRAL_SESSION_CONSUMER_CALLS = Object.freeze(
  expectedNeutralCallsByRoute(SESSION_FACTORY_SPECS),
);
const EXPECTED_NEUTRAL_SESSION_CONSUMER_IMPORTS = Object.freeze(
  expectedNeutralImportsByRoute(SESSION_FACTORY_SPECS_BY_ROUTE),
);

interface FileInventory {
  authOptionsImports: number;
  authOptionsReferences: number;
  getServerSessionCalls: number;
  getServerSessionImports: number;
  getTokenCalls: number;
  getTokenImports: number;
  resolveServerSessionCalls: number;
  resolveServerSessionImports: number;
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

function isUnaliasedNamedImport(binding: ImportedBinding): boolean {
  const importSpecifier = binding.declaration.parent;
  return (
    ts.isImportSpecifier(importSpecifier) &&
    importSpecifier.propertyName === undefined &&
    !importSpecifier.isTypeOnly &&
    binding.localName === importSpecifier.name.text
  );
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

function isServerSessionFacadeModule(
  moduleName: string,
  importerRelativePath: string,
): boolean {
  const normalizedModuleName = normalizeModuleName(moduleName);
  if (
    /^@\/lib\/auth\/server-session(?:\.[cm]?[jt]sx?)?$/.test(
      normalizedModuleName,
    )
  ) {
    return true;
  }
  if (!normalizedModuleName.startsWith(".")) return false;

  const resolvedModuleName = normalizeModuleName(
    path.posix.join(path.posix.dirname(importerRelativePath), moduleName),
  );
  return /^lib\/auth\/server-session(?:\.[cm]?[jt]sx?)?$/.test(
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

function isStaticRequireReference(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) {
    return !(
      ts.isPropertyAccessExpression(node.parent) &&
      node.parent.name === node
    ) && node.text === "require";
  }
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === "require";
  }
  return (
    ts.isElementAccessExpression(node) &&
    readStaticString(node.argumentExpression) === "require"
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

function sessionFactorySpecsForRoute(
  relativePath: string,
): readonly SessionFactorySpec[] {
  return SESSION_FACTORY_SPECS_BY_ROUTE.get(relativePath) ?? [];
}

function registeredSessionFactory(
  factoryName: string,
): SessionFactorySpec | null {
  return (
    SESSION_FACTORY_SPECS.find(
      (factorySpec) => factorySpec.factoryName === factoryName,
    ) ?? null
  );
}

function isExportedSessionFactoryCall(
  factoryCall: ts.CallExpression,
  relativePath: string,
  factorySpec: SessionFactorySpec,
  factoryBinding: ImportedBinding | null,
): boolean {
  if (
    relativePath !== factorySpec.routePath ||
    !factoryBinding ||
    factoryBinding.localName !== factorySpec.factoryName
  ) {
    return false;
  }
  if (
    factoryCall.questionDotToken ||
    (factoryCall.typeArguments?.length ?? 0) !== 0 ||
    factoryCall.arguments.length !== 1 ||
    !ts.isIdentifier(factoryCall.expression) ||
    factoryCall.expression.text !== factorySpec.factoryName
  ) {
    return false;
  }
  const dependencies = factoryCall.arguments[0];
  if (
    !ts.isObjectLiteralExpression(dependencies) ||
    dependencies.properties.length !== factorySpec.dependencyKeys.length ||
    dependencies.properties.some(
      (property) =>
        !ts.isPropertyAssignment(property) ||
        !ts.isIdentifier(property.name),
    )
  ) {
    return false;
  }
  const dependencyNames = new Set(
    dependencies.properties.map((property) =>
      (property as ts.PropertyAssignment).name.getText(),
    ),
  );
  if (
    dependencyNames.size !== factorySpec.dependencyKeys.length ||
    factorySpec.dependencyKeys.some(
      (dependencyName) => !dependencyNames.has(dependencyName),
    )
  ) {
    return false;
  }
  const declaration = factoryCall.parent;
  if (
    !ts.isVariableDeclaration(declaration) ||
    declaration.initializer !== factoryCall ||
    !ts.isIdentifier(declaration.name) ||
    declaration.name.text !== factorySpec.handlerExport ||
    declaration.type !== undefined ||
    declaration.exclamationToken !== undefined
  ) {
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
  const statement = declarationList.parent;
  return (
    ts.isVariableStatement(statement) &&
    statement.parent === factoryCall.getSourceFile() &&
    statement.modifiers?.length === 1 &&
    statement.modifiers[0].kind === ts.SyntaxKind.ExportKeyword
  );
}

function isApprovedNeutralSessionConsumerCall(
  call: ts.CallExpression,
  relativePath: string,
  resolveServerSessionBinding: ImportedBinding | null,
  factoryBindings: ReadonlyMap<string, ImportedBinding>,
): boolean {
  if (
    !resolveServerSessionBinding ||
    call.questionDotToken ||
    (call.typeArguments?.length ?? 0) !== 0 ||
    call.arguments.length !== 0 ||
    !ts.isIdentifier(call.expression) ||
    call.expression.text !== "resolveServerSession"
  ) {
    return false;
  }
  const resolver = call.parent;
  if (
    !ts.isArrowFunction(resolver) ||
    resolver.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
    ) ||
    (resolver.typeParameters?.length ?? 0) !== 0 ||
    resolver.type !== undefined ||
    resolver.parameters.length !== 0 ||
    resolver.body !== call
  ) {
    return false;
  }
  const dependency = resolver.parent;
  if (
    !ts.isPropertyAssignment(dependency) ||
    !ts.isIdentifier(dependency.name) ||
    dependency.name.text !== "resolveSession" ||
    dependency.initializer !== resolver
  ) {
    return false;
  }
  const dependencies = dependency.parent;
  if (!ts.isObjectLiteralExpression(dependencies)) return false;
  const factoryCall = dependencies.parent;
  if (
    !ts.isCallExpression(factoryCall) ||
    factoryCall.arguments[0] !== dependencies ||
    !ts.isIdentifier(factoryCall.expression)
  ) {
    return false;
  }
  const registeredFactory = registeredSessionFactory(
    factoryCall.expression.text,
  );
  return Boolean(
    registeredFactory &&
      isExportedSessionFactoryCall(
        factoryCall,
        relativePath,
        registeredFactory,
        factoryBindings.get(registeredFactory.factoryName) ?? null,
      ),
  );
}

function bindingIdentifierNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  const names: string[] = [];
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) {
      names.push(...bindingIdentifierNames(element.name));
    }
  }
  return names;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true
  );
}

function exportedHttpMethodNames(statement: ts.Statement): string[] {
  if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) return [];

  let exportedNames: string[] = [];
  if (ts.isVariableStatement(statement)) {
    exportedNames = statement.declarationList.declarations.flatMap(
      (declaration) => bindingIdentifierNames(declaration.name),
    );
  } else if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
  ) {
    exportedNames = [statement.name.text];
  } else if (
    (ts.isModuleDeclaration(statement) ||
      ts.isImportEqualsDeclaration(statement)) &&
    statement.name
  ) {
    exportedNames = [statement.name.text];
  }

  return exportedNames.filter((name) => ROUTE_HTTP_METHOD_NAMES.has(name));
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
    resolveServerSessionCalls: 0,
    resolveServerSessionImports: 0,
  };
  let authOptionsBinding: ImportedBinding | null = null;
  let serverSessionBinding: ImportedBinding | null = null;
  let getTokenBinding: ImportedBinding | null = null;
  let resolveServerSessionBinding: ImportedBinding | null = null;
  const sessionFactorySpecs = sessionFactorySpecsForRoute(relativePath);
  const sessionFactoryBindings = new Map<string, ImportedBinding>();
  const sessionFactoryCalls: CountMap = {};
  const exportedHttpMethods: CountMap = {};
  let nextAuthHandlerBinding: ts.Identifier | null = null;
  let facadeAuthOptionsBinding: ts.Identifier | null = null;
  let facadeAuthOptionsReferences = 0;

  for (const statement of sourceFile.statements) {
    if (sessionFactorySpecs.length > 0) {
      for (const httpMethod of exportedHttpMethodNames(statement)) {
        increment(exportedHttpMethods, httpMethod);
      }
      if (ts.isExportDeclaration(statement)) {
        violations.push(
          `${location(sourceFile, relativePath, statement)} session factory ruta ne sme imati re-export`,
        );
      }
      if (
        ts.isExportAssignment(statement) ||
        hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
      ) {
        violations.push(
          `${location(sourceFile, relativePath, statement)} session factory ruta ne sme imati default/export= izvoz`,
        );
      }
    }

    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const moduleName = statement.moduleSpecifier.text;
      const bindings = statement.importClause?.namedBindings;
      if (
        SESSION_FACTORY_MODULES.has(moduleName) &&
        (statement.importClause?.name ||
          (bindings && ts.isNamespaceImport(bindings)))
      ) {
        violations.push(
          `${location(sourceFile, relativePath, statement)} default/namespace session factory import nije dozvoljen`,
        );
      }
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
      if (isServerSessionFacadeModule(moduleName, relativePath)) {
        if (
          statement.importClause?.name ||
          (bindings && ts.isNamespaceImport(bindings))
        ) {
          violations.push(
            `${location(sourceFile, relativePath, statement)} default/namespace server-session facade import nije dozvoljen`,
          );
        }
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

      const neutralSessionResolvers = namedImportBindings(
        statement,
        "resolveServerSession",
      );
      if (neutralSessionResolvers.length > 0) {
        inventory.resolveServerSessionImports +=
          neutralSessionResolvers.length;
        if (
          moduleName !== SERVER_SESSION_FACADE_MODULE ||
          sessionFactorySpecs.length === 0 ||
          statement.importClause?.isTypeOnly === true ||
          resolveServerSessionBinding ||
          neutralSessionResolvers.length !== 1 ||
          neutralSessionResolvers[0].localName !==
            "resolveServerSession" ||
          !isUnaliasedNamedImport(neutralSessionResolvers[0])
        ) {
          violations.push(
            `${location(sourceFile, relativePath, statement)} nekanonski ili dupli resolveServerSession import`,
          );
        } else {
          resolveServerSessionBinding = neutralSessionResolvers[0];
        }
      }

      for (const registeredSpec of SESSION_FACTORY_SPECS) {
        const factoryImports = namedImportBindings(
          statement,
          registeredSpec.factoryName,
        );
        if (factoryImports.length === 0) continue;
        if (
          relativePath !== registeredSpec.routePath ||
          !sessionFactorySpecs.includes(registeredSpec) ||
          moduleName !== registeredSpec.factoryModule ||
          statement.importClause?.isTypeOnly === true ||
          sessionFactoryBindings.has(registeredSpec.factoryName) ||
          factoryImports.length !== 1 ||
          factoryImports[0].localName !== registeredSpec.factoryName ||
          !isUnaliasedNamedImport(factoryImports[0])
        ) {
          violations.push(
            `${location(sourceFile, relativePath, statement)} nekanonski ili dupli ${registeredSpec.factoryName} factory import`,
          );
        } else {
          sessionFactoryBindings.set(
            registeredSpec.factoryName,
            factoryImports[0],
          );
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
        isServerSessionFacadeModule(
          statement.moduleReference.expression.text,
          relativePath,
        ) ||
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
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some(
        (element) =>
          (element.propertyName ?? element.name).text ===
          "resolveServerSession",
      )
    ) {
      violations.push(
        `${location(sourceFile, relativePath, statement)} resolveServerSession re-export nije dozvoljen`,
      );
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isServerSessionFacadeModule(
        statement.moduleSpecifier.text,
        relativePath,
      ) &&
      (!statement.exportClause || ts.isNamespaceExport(statement.exportClause))
    ) {
      violations.push(
        `${location(sourceFile, relativePath, statement)} server-session facade namespace/star re-export nije dozvoljen`,
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
            isServerSessionFacadeModule(moduleName, relativePath) ||
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
          isServerSessionFacadeModule(moduleName, relativePath) ||
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
              isServerSessionFacadeModule(moduleName, relativePath) ||
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

        if (resolveServerSessionBinding?.localName === calledName) {
          inventory.resolveServerSessionCalls += 1;
          if (
            node.arguments.length !== 0 ||
            !isApprovedNeutralSessionConsumerCall(
              node,
              relativePath,
              resolveServerSessionBinding,
              sessionFactoryBindings,
            )
          ) {
            violations.push(
              `${location(sourceFile, relativePath, node)} neodobren request-lazy resolveServerSession wiring`,
            );
          }
        } else if (calledName === "resolveServerSession") {
          violations.push(
            `${location(sourceFile, relativePath, node)} nepoznat resolveServerSession binding`,
          );
        }

        const registeredFactory = registeredSessionFactory(calledName);
        if (registeredFactory) {
          const factoryBinding = sessionFactoryBindings.get(calledName) ?? null;
          if (factoryBinding) {
            increment(sessionFactoryCalls, calledName);
            if (
              !isExportedSessionFactoryCall(
                node,
                relativePath,
                registeredFactory,
                factoryBinding,
              )
            ) {
              violations.push(
                `${location(sourceFile, relativePath, node)} ${calledName} factory poziv mora biti tačno direktna export const ${registeredFactory.handlerExport} composition`,
              );
            }
          } else {
            violations.push(
              `${location(sourceFile, relativePath, node)} nepoznat ${calledName} factory binding`,
            );
          }
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
      node.name.text === "resolveServerSession"
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} namespace/property resolveServerSession pristup nije dozvoljen`,
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
      readStaticString(node.argumentExpression) === "resolveServerSession"
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} computed resolveServerSession pristup nije dozvoljen`,
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
      sessionFactorySpecs.length > 0 &&
      isStaticRequireReference(node)
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} session factory ruta ne sme koristiti require pristup`,
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
        "resolveServerSession"
    ) {
      violations.push(
        `${location(sourceFile, relativePath, node)} destructured resolveServerSession nije dozvoljen`,
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
      if (sessionFactorySpecs.length > 0 && node.text === "exports") {
        violations.push(
          `${location(sourceFile, relativePath, node)} session factory ruta ne sme koristiti bare exports/CommonJS izvoz`,
        );
      }
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
        resolveServerSessionBinding &&
        node.text === resolveServerSessionBinding.localName &&
        node !== resolveServerSessionBinding.declaration &&
        !isDirectCallReference(node)
      ) {
        violations.push(
          `${location(sourceFile, relativePath, node)} resolveServerSession binding ne sme da se prosleđuje ili aliasuje`,
        );
      }
      for (const [factoryName, factoryBinding] of sessionFactoryBindings) {
        if (
          node.text === factoryBinding.localName &&
          node !== factoryBinding.declaration &&
          !isDirectCallReference(node)
        ) {
          violations.push(
            `${location(sourceFile, relativePath, node)} ${factoryName} factory binding ne sme da se prosleđuje ili aliasuje`,
          );
        }
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
  if (sessionFactorySpecs.length > 0) {
    if (
      inventory.getServerSessionCalls !== 0 ||
      inventory.getServerSessionImports !== 0 ||
      inventory.getTokenCalls !== 0 ||
      inventory.getTokenImports !== 0 ||
      inventory.authOptionsImports !== 0 ||
      inventory.authOptionsReferences !== 0
    ) {
      violations.push(
        `${relativePath}: migrirana session factory ruta ne sme mešati raw NextAuth/authOptions put`,
      );
    }
    const expectedHttpMethods: CountMap = Object.fromEntries(
      sessionFactorySpecs.map((factorySpec) => [
        factorySpec.handlerExport,
        1,
      ]),
    );
    if (
      JSON.stringify(sortedRecord(exportedHttpMethods)) !==
      JSON.stringify(sortedRecord(expectedHttpMethods))
    ) {
      violations.push(
        `${relativePath}: mora imati tačan HTTP export skup ${Object.keys(expectedHttpMethods).join("/")}`,
      );
    }
    if (
      !resolveServerSessionBinding ||
      inventory.resolveServerSessionCalls !== sessionFactorySpecs.length
    ) {
      violations.push(
        `${relativePath}: mora imati jedan kanonski resolveServerSession import i po jedan request-lazy poziv za svaki handler`,
      );
    }
    for (const factorySpec of sessionFactorySpecs) {
      if (
        !sessionFactoryBindings.has(factorySpec.factoryName) ||
        sessionFactoryCalls[factorySpec.factoryName] !== 1
      ) {
        violations.push(
          `${relativePath}: mora imati jedan kanonski ${factorySpec.factoryName} import i jedan direktan export const ${factorySpec.handlerExport} poziv`,
        );
      }
    }
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
  const neutralSessionCalls: CountMap = {};
  const neutralSessionImports: CountMap = {};

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
      neutralSessionCalls,
      relativePath,
      inventory.resolveServerSessionCalls,
    );
    increment(
      neutralSessionImports,
      relativePath,
      inventory.resolveServerSessionImports,
    );
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
  assert.deepEqual(
    sortedRecord(neutralSessionCalls),
    EXPECTED_NEUTRAL_SESSION_CONSUMER_CALLS,
  );
  assert.deepEqual(
    sortedRecord(neutralSessionImports),
    EXPECTED_NEUTRAL_SESSION_CONSUMER_IMPORTS,
  );

  assert.equal(Object.keys(expectedConsumerCalls).length, 53);
  assert.equal(sum(expectedConsumerCalls), 94);
  assert.equal(Object.keys(sortedRecord(serverSessionCalls)).length, 54);
  assert.equal(sum(sortedRecord(serverSessionCalls)), 95);
  // Migrirani put raste: checkout-data, wishlist i četiri rute nad sekcijama.
  assert.equal(Object.keys(sortedRecord(neutralSessionCalls)).length, 8);
  assert.equal(sum(sortedRecord(neutralSessionCalls)), 12);
  assert.equal(Object.keys(sortedRecord(neutralSessionImports)).length, 8);
  assert.equal(sum(sortedRecord(neutralSessionImports)), 8);
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
      name: "neutral-facade-namespace",
      source: `
        import * as Session from "@/lib/auth/server-session";
        void Session.resolveServerSession();
      `,
      expected: /default\/namespace server-session facade import nije dozvoljen/,
    },
    {
      name: "neutral-facade-binding-alias",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        const read = resolveServerSession;
        void read();
      `,
      expected: /resolveServerSession binding ne sme da se prosleđuje ili aliasuje/,
    },
    {
      name: "neutral-facade-eager-top-level-call",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        const cachedSession = resolveServerSession();
        void cachedSession;
      `,
      expected: /neodobren request-lazy resolveServerSession wiring/,
    },
    {
      name: "checkout-data-factory-wrong-module",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/fake-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
        });
      `,
      expected:
        /nekanonski ili dupli createCheckoutDataGetHandler factory import/,
    },
    {
      name: "checkout-data-factory-alias",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import {
          createCheckoutDataGetHandler as buildCheckoutDataGet,
        } from "@/lib/checkout/checkout-data-route";
        export const GET = buildCheckoutDataGet({
          resolveSession: () => resolveServerSession(),
        });
      `,
      expected:
        /nekanonski ili dupli createCheckoutDataGetHandler factory import/,
    },
    {
      name: "checkout-data-reviewed-factory-result-unused",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        const reviewedButUnused = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
        });
        export async function GET() {
          void reviewedButUnused;
          return Response.json({ ok: true });
        }
      `,
      expected:
        /createCheckoutDataGetHandler factory poziv mora biti tačno direktna export const GET composition/,
    },
    {
      name: "checkout-data-resolver-spread-override",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        const bypass = {
          resolveSession: async () => ({ status: "anonymous" as const }),
        };
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
          ...bypass,
        });
      `,
      expected:
        /createCheckoutDataGetHandler factory poziv mora biti tačno direktna export const GET composition/,
    },
    {
      name: "checkout-data-resolver-alias",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        const readSession = resolveServerSession;
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => readSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected:
        /resolveServerSession binding ne sme da se prosleđuje ili aliasuje/,
    },
    {
      name: "checkout-data-resolver-optional-call",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession?.(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected: /neodobren request-lazy resolveServerSession wiring/,
    },
    {
      name: "checkout-data-resolver-optional-parameter",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: (_options?: never) => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected: /neodobren request-lazy resolveServerSession wiring/,
    },
    {
      name: "checkout-data-resolver-type-arguments",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession<unknown>(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected: /neodobren request-lazy resolveServerSession wiring/,
    },
    {
      name: "checkout-data-resolver-async",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: async () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected: /neodobren request-lazy resolveServerSession wiring/,
    },
    {
      name: "checkout-data-computed-dependency",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          ["resolveSession"]: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected:
        /createCheckoutDataGetHandler factory poziv mora biti tačno direktna export const GET composition/,
    },
    {
      name: "checkout-data-duplicate-dependency",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected:
        /createCheckoutDataGetHandler factory poziv mora biti tačno direktna export const GET composition/,
    },
    {
      name: "wishlist-factory-method-swap",
      relativePath: WISHLIST_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import {
          createWishlistDeleteHandler,
          createWishlistGetHandler,
          createWishlistPostHandler,
        } from "@/lib/wishlist/wishlist-route";
        export const GET = createWishlistPostHandler({
          resolveSession: () => resolveServerSession(),
          upsertItem: async () => undefined,
          reportFailure: () => undefined,
        });
        export const POST = createWishlistGetHandler({
          resolveSession: () => resolveServerSession(),
          findItemsByUserId: async () => [],
          reportFailure: () => undefined,
        });
        export const DELETE = createWishlistDeleteHandler({
          resolveSession: () => resolveServerSession(),
          deleteItems: async () => undefined,
          reportFailure: () => undefined,
        });
      `,
      expected:
        /createWishlistPostHandler factory poziv mora biti tačno direktna export const POST composition/,
    },
    {
      name: "checkout-data-extra-http-export",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        export const POST = () => new Response();
      `,
      expected: /mora imati tačan HTTP export skup GET/,
    },
    {
      name: "checkout-data-commonjs-handler-overwrite",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        exports.GET = async () => new Response("bypass");
      `,
      expected: /session factory ruta ne sme koristiti bare exports\/CommonJS izvoz/,
    },
    {
      name: "checkout-data-commonjs-define-handler-overwrite",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        Object.defineProperty(exports, "GET", {
          value: async () => new Response("bypass"),
        });
      `,
      expected: /session factory ruta ne sme koristiti bare exports\/CommonJS izvoz/,
    },
    {
      name: "checkout-data-commonjs-self-require-handler-overwrite",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        require("./route").GET = async () => new Response("bypass");
      `,
      expected: /session factory ruta ne sme koristiti require pristup/,
    },
    {
      name: "checkout-data-commonjs-define-self-require-handler-overwrite",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        Object.defineProperty(require("./route"), "GET", {
          value: async () => new Response("bypass"),
        });
      `,
      expected: /session factory ruta ne sme koristiti require pristup/,
    },
    {
      name: "checkout-data-computed-global-require-handler-overwrite",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        globalThis["require"]("./route").GET = async () =>
          new Response("bypass");
      `,
      expected: /session factory ruta ne sme koristiti require pristup/,
    },
    {
      name: "checkout-data-runtime-namespace-http-export",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        export namespace POST {
          export const bypass = true;
        }
      `,
      expected: /mora imati tačan HTTP export skup GET/,
    },
    {
      name: "checkout-data-route-re-export",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        export { GET as POST };
      `,
      expected: /session factory ruta ne sme imati re-export/,
    },
    {
      name: "checkout-data-route-default-export",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        export default GET;
      `,
      expected: /session factory ruta ne sme imati default\/export= izvoz/,
    },
    {
      name: "checkout-data-resolver-import-alias",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import {
          resolveServerSession as readSession,
        } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => readSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected: /nekanonski ili dupli resolveServerSession import/,
    },
    {
      name: "checkout-data-default-factory-import",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import CheckoutFactory from "@/lib/checkout/checkout-data-route";
        export const GET = CheckoutFactory({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected: /default\/namespace session factory import nije dozvoljen/,
    },
    {
      name: "wishlist-namespace-factory-import",
      relativePath: WISHLIST_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import * as WishlistFactories from "@/lib/wishlist/wishlist-route";
        void WishlistFactories;
      `,
      expected: /default\/namespace session factory import nije dozvoljen/,
    },
    {
      name: "checkout-data-duplicate-factory-call",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        void createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
      `,
      expected:
        /createCheckoutDataGetHandler factory poziv mora biti tačno direktna export const GET composition/,
    },
    {
      name: "checkout-data-shorthand-dependency",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        const reportFailure = () => undefined;
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure,
        });
      `,
      expected:
        /createCheckoutDataGetHandler factory poziv mora biti tačno direktna export const GET composition/,
    },
    {
      name: "checkout-data-extra-dependency",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
          bypass: true,
        });
      `,
      expected:
        /createCheckoutDataGetHandler factory poziv mora biti tačno direktna export const GET composition/,
    },
    {
      name: "checkout-data-route-star-re-export",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => null,
          reportFailure: () => undefined,
        });
        export * from "./shadow";
      `,
      expected: /session factory ruta ne sme imati re-export/,
    },
    {
      name: "checkout-data-mixed-legacy-and-neutral-session",
      relativePath: CHECKOUT_DATA_ROUTE,
      source: `
        import { getServerSession } from "next-auth";
        import { authOptions } from "@/lib/auth";
        import { resolveServerSession } from "@/lib/auth/server-session";
        import { createCheckoutDataGetHandler } from "@/lib/checkout/checkout-data-route";
        export const GET = createCheckoutDataGetHandler({
          resolveSession: () => resolveServerSession(),
          findUserById: async () => {
            await getServerSession(authOptions);
            return null;
          },
          reportFailure: () => undefined,
        });
      `,
      expected: /ne sme mešati raw NextAuth\/authOptions put/,
    },
    {
      name: "neutral-facade-star-re-export",
      source: `export * from "@/lib/auth/server-session";`,
      expected: /server-session facade namespace\/star re-export nije dozvoljen/,
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

test("inventory accepts the exact multi-method wishlist composition", () => {
  const violations: string[] = [];
  const inventory = inspectFile(
    WISHLIST_ROUTE,
    violations,
    `
      import { resolveServerSession } from "@/lib/auth/server-session";
      import {
        createWishlistDeleteHandler,
        createWishlistGetHandler,
        createWishlistPostHandler,
      } from "@/lib/wishlist/wishlist-route";

      export const GET = createWishlistGetHandler({
        resolveSession: () => resolveServerSession(),
        findItemsByUserId: async () => [],
        reportFailure: () => undefined,
      });

      export const POST = createWishlistPostHandler({
        resolveSession: () => resolveServerSession(),
        upsertItem: async () => undefined,
        reportFailure: () => undefined,
      });

      export const DELETE = createWishlistDeleteHandler({
        resolveSession: () => resolveServerSession(),
        deleteItems: async () => undefined,
        reportFailure: () => undefined,
      });
    `,
  );

  assert.deepEqual(violations, []);
  assert.equal(inventory.resolveServerSessionCalls, 3);
  assert.equal(inventory.resolveServerSessionImports, 1);
});
