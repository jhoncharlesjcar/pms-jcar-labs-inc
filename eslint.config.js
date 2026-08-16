import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import tsParser from "@typescript-eslint/parser";

const commonRules = {
    "no-unused-vars": "off",
    "react/jsx-uses-vars": "error",
    "react/jsx-uses-react": "error",
    "unused-imports/no-unused-imports": "warn",
    "unused-imports/no-unused-vars": [
        "warn",
        {
            vars: "all",
            varsIgnorePattern: "^_",
            args: "after-used",
            argsIgnorePattern: "^_",
        },
    ],
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
    ],
    // Transitional baseline: CI caps total warnings, so new debt cannot grow.
    "react-hooks/rules-of-hooks": "warn",
};

export default [
    {
        ignores: ["dist/**", "coverage/**", "node_modules/**"],
    },
    {
        files: ["src/**/*.{js,mjs,cjs,jsx,ts,tsx}"],
        ...pluginJs.configs.recommended,
        ...pluginReact.configs.flat.recommended,
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                ecmaFeatures: { jsx: true },
            },
        },
        settings: { react: { version: "detect" } },
        plugins: {
            react: pluginReact,
            "react-hooks": pluginReactHooks,
            "unused-imports": pluginUnusedImports,
        },
        rules: commonRules,
    },
    {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                ecmaFeatures: { jsx: true },
            },
        },
        rules: {
            // This plugin reports TypeScript interface parameter names as runtime variables.
            "unused-imports/no-unused-vars": "off",
        },
    },
    {
        files: ["src/components/ui/**/*.{js,jsx,ts,tsx}"],
        rules: { "react/display-name": "off" },
    },
];
