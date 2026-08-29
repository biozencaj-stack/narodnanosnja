import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Existing React 19 code uses several legitimate hydration and URL-sync
    // effects. Keep the new compiler diagnostics visible while the legacy
    // components are migrated incrementally instead of blocking every CI run.
    rules: {
      "react-hooks/error-boundaries": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "public/uploads/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);
