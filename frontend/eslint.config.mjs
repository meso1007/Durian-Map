import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // iOS（Capacitor）のネイティブプロジェクト。App/App/public は
    // `cap sync` が out/ からコピーしたビルド成果物なので lint しない。
    "ios/**",
  ]),
]);

export default eslintConfig;
