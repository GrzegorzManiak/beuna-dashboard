import js from '@eslint/js'
import globals from 'globals'
import importPlugin from 'eslint-plugin-import'
import perfectionist from 'eslint-plugin-perfectionist'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    ignores: [
      "src/components/ui/**"
    ]
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
      perfectionist
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    rules: {
      curly: ["error", "multi-line"],
      "nonblock-statement-body-position": ["error", "beside"],
      "brace-style": ["error", "1tbs"],
      camelcase: ["error", { properties: "always" }],
      "func-style": ["error", "declaration", { allowArrowFunctions: true }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "import/no-default-export": "error",
      "import/exports-last": "error",
      "import/group-exports": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportNamedDeclaration[declaration!=null]",
          message:
            "No inline exports. Declare first, then export via a single `export { ... }` block at the bottom."
        },
        {
          selector: "ExportDefaultDeclaration",
          message: "No default exports. Use named exports only."
        }
      ],
      "perfectionist/sort-named-exports": [
        "error",
        {
          order: "asc",
          type: "alphabetical",
          ignoreCase: false
        }
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "typeLike",
          format: ["PascalCase"]
        },
        {
          selector: "function",
          format: ["PascalCase"],
          filter: {
            regex: "^[A-Z]",
            match: true
          }
        },
        {
          selector: "function",
          format: ["camelCase"],
          filter: {
            regex: "^[A-Z]",
            match: false
          }
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"]
        }
      ],
    }
  }
])
