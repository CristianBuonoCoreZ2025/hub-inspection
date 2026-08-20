import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Marcar variables usadas en JSX como utilizadas (evita falsos no-unused-vars)
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react/jsx-uses-vars": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone Node.js utility scripts (CommonJS, not part of the app)
    "scripts/**",
  ]),
]);

export default eslintConfig;
