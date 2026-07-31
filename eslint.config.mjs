import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".git/**",
      ".venv-jupyter/**",
      ".venv/**",
      "venv/**",
      ".jupyter/**",
      ".playwright-mcp/**",
      ".pnpm-store/**",
      ".ruff_cache/**",
      ".planning/**",
      "public/**",
      "notebooks/**",
      "data/**",
      // Design reference, not source. `support.js` is the prototyping runtime the handoff
      // was authored in — its own README says to ignore it entirely.
      "design_handoff_watchpeople_live/**",
      "next-env.d.ts",
      "pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Native flat-config exports (not routed through the legacy FlatCompat shim, which
  // crashes on eslint-plugin-react's newer self-referencing `configs.flat` object).
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Type-check-driven correctness only — Prettier owns formatting, so every
      // stylistic/layout rule Next's presets or typescript-eslint might enable is
      // switched off below via eslint-config-prettier (kept last).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // React Compiler readiness rule: flags mutating a ref's `.current` (or a
      // TSL/three.js material's backing array) outside a setter. That's the standard,
      // required react-three-fiber pattern for a per-frame render loop (see
      // app/globe/Earth.tsx) — mutating refs in place, not React state, is exactly how
      // r3f avoids re-rendering every frame. Not applicable to this codebase.
      "react-hooks/immutability": "off",
    },
  },
  // Must stay last: disables any formatting-related rule turned on above.
  eslintConfigPrettier,
);
