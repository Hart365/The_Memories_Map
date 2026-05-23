// ESLint 10+ flat config for Memories Map frontend (ESM)
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
    js.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            sourceType: 'module',
            globals: {
                React: 'readonly',
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                sessionStorage: 'readonly',
                HTMLInputElement: 'readonly',
                File: 'readonly',
                FormData: 'readonly',
                HTMLElement: 'readonly',
                Element: 'readonly',
                CSSStyleDeclaration: 'readonly',
                process: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooks,
        },
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'no-undef': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/no-explicit-any': 'off',
            'react-hooks/set-state-in-effect': 'off',
        },
    },
    {
        files: ['vite.config.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {},
            sourceType: 'module',
            globals: {
                process: 'readonly',
            },
        },
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                process: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                fetch: 'readonly',
            },
        },
        rules: {
            'no-undef': 'off',
        },
    },
    {
        ignores: [
            '**/*Old.tsx',
            '**/*Old*.ts',
            '**/*Old*.tsx',
        ],
    },
];
