import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import perfectionist from "eslint-plugin-perfectionist";

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: [
            "client/src/components/ui/**"
        ]
    },
    {
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
            // -------------------------
            // 1) Code style & readability
            // -------------------------
            curly: ["error", "multi-line"],
            "nonblock-statement-body-position": ["error", "beside"],
            "brace-style": ["error", "1tbs"],
            camelcase: ["error", { properties: "always" }],

            // Prefer named function declarations for top-level stuff,
            // but allow arrow functions for callbacks.
            "func-style": ["error", "declaration", { allowArrowFunctions: true }],

            // -------------------------
            // 2) Types & functions (TS)
            // -------------------------
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/explicit-function-return-type": [
                "error",
                { allowExpressions: true, allowTypedFunctionExpressions: true }
            ],
            "@typescript-eslint/explicit-module-boundary-types": "error",

            // -------------------------
            // 3) Modules & exports
            // -------------------------
            // No default exports
            "import/no-default-export": "error",

            // Force all exports to the bottom
            "import/exports-last": "error",

            // Force exports to be grouped into a single export declaration
            "import/group-exports": "error",

            // No inline exports (no `export const ...` / `export function ...`)
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

            // Sort the names inside `export { ... }`
            // (We can’t perfectly enforce “functions, constants, types” reliably,
            // but this keeps the export list consistent.)
            "perfectionist/sort-named-exports": [
                "error",
                {
                    order: "asc",
                    type: "alphabetical",
                    ignoreCase: false
                }
            ],
            // -------------------------
            // 4) Naming conventions
            // -------------------------
            "@typescript-eslint/naming-convention": [
                "error",

                // Types (type, interface, enum, class) → PascalCase
                {
                    selector: "typeLike",
                    format: ["PascalCase"]
                },

                // Functions that start with capital letter (React components) → PascalCase
                {
                    selector: "function",
                    format: ["PascalCase"],
                    filter: {
                        regex: "^[A-Z]",
                        match: true
                    }
                },

                // Regular functions → camelCase
                {
                    selector: "function",
                    format: ["camelCase"],
                    filter: {
                        regex: "^[A-Z]",
                        match: false
                    }
                },

                // Variables → camelCase (allow PascalCase for components)
                {
                    selector: "variable",
                    format: ["camelCase", "PascalCase", "UPPER_CASE"]
                }

            ],
        }
    }
];
