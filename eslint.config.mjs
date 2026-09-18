// ESLint for the app (Next core-web-vitals + TypeScript). Run: npm run lint
// The engine (plain ESM) and the generated/static folders are out of scope.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: [".next/**", "node_modules/**", "output/**", "deploy/**", "design/**", "future-clips-site/**", "docs/**", "engine/**", "tools/**", "mining/**", "scripts/**", "legal/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Supabase rows and engine state arrive untyped; `any` at those seams is a
      // warning to tighten over time, not a build failure. Everything else is an error.
      "@typescript-eslint/no-explicit-any": "warn",
      // an apostrophe in UI copy is copy, not markup
      "react/no-unescaped-entities": "off",
    },
  },
];
