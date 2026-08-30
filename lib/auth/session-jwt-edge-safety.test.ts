import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readSiblingSource(name: string): string {
  return readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
}

function assertNoNodeOnlyRuntimeApi(source: string, fileName: string): void {
  assert.doesNotMatch(source, /from\s+["']node:/, `${fileName} imports node:*`);
  assert.doesNotMatch(source, /require\(\s*["']node:/, `${fileName} requires node:*`);
  assert.doesNotMatch(
    source,
    /(?:^|[;\n])\s*Buffer\s*\./m,
    `${fileName} uses Buffer`,
  );
}

test("Edge JWT path has no Node-only imports or runtime APIs", () => {
  const jwtSource = readSiblingSource("session-jwt.ts");
  const claimsSource = readSiblingSource("session-claims-edge.ts");
  const configSource = readSiblingSource("config.ts");

  assert.match(jwtSource, /from\s+["']\.\/session-claims-edge["']/);
  assert.doesNotMatch(jwtSource, /from\s+["']\.\/session-claims["']/);

  assertNoNodeOnlyRuntimeApi(jwtSource, "session-jwt.ts");
  assertNoNodeOnlyRuntimeApi(claimsSource, "session-claims-edge.ts");
  assertNoNodeOnlyRuntimeApi(configSource, "config.ts");
});
