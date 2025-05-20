import { defineConfig, globalIgnores } from 'eslint/config';
import tsParser from '@typescript-eslint/parser';
import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import jsxA11Y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as mdx from 'eslint-plugin-mdx';
import unusedImports from 'eslint-plugin-unused-imports';
import react from 'eslint-plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  globalIgnores(['node_modules/', 'build/', '.docusaurus/']),
  {
    ...mdx.flat,
  },
  {
    ...mdx.flatCodeBlocks,
    rules: {
      ...mdx.flatCodeBlocks.rules,
    },
  },
  {
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },

      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },

    extends: fixupConfigRules(
      compat.extends(
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:jsx-a11y/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
        'plugin:prettier/recommended',
        'prettier'
      )
    ),

    plugins: {
      'jsx-a11y': fixupPluginRules(jsxA11Y),
      prettier: fixupPluginRules(prettier),
      'unused-imports': fixupPluginRules(unusedImports),
      react: fixupPluginRules(react),
    },

    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          // This tells ESLint to use tsconfig paths
          project: './tsconfig.json',
        },
        alias: {
          map: [['@site', '.']],
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.mdx'],
        },
      },
    },

    rules: {
      'prettier/prettier': 'error',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'import/no-unresolved': [
        'error',
        {
          ignore: ['^@theme/', '^@docusaurus/'],
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.mdx', '**/*.md'],

    rules: {
      'react/jsx-no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // 👈 suppress false positives
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],

    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
]);
