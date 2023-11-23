import js from '@eslint/js';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import tsEslintParser from '@typescript-eslint/parser';
import google from 'eslint-config-google';
import prettierConfig from 'eslint-config-prettier';
import imports from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  {
    files: ['**/*.{js,ts}'],
  },
  {
    ignores: ['**/dist/**'],
  },
  {
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node, // Node.jsで動かすコードの場合
        ...globals.jest,
      },
    },
    rules: {
      camelcase: ['error', { ignoreDestructuring: true }],
      complexity: ['error', 10],
      'no-invalid-this': 'off',
      'no-unused-vars': 'off',
      'require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: false,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
      'spaced-comment': ['error', 'always', { markers: ['/'] }],
    },
  },
  {
    languageOptions: {
      parser: tsEslintParser,
    },
    plugins: {
      '@typescript-eslint': tsEslintPlugin,
    },
    rules: {
      ...tsEslintPlugin.configs['eslint-recommended'].overrides[0].rules,
      '@typescript-eslint/ban-types': [
        'error',
        {
          extendDefaults: true,
          types: {
            '{}': false,
          },
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-invalid-this': ['error'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    plugins: {
      import: imports,
    },
    rules: {
      'import/order': [
        'error',
        {
          alphabetize: {
            order: 'asc',
            caseInsensitive: false,
          },
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'object', 'index'],
          'newlines-between': 'never',
          pathGroups: [
            {
              pattern: 'react',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: 'next',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: '{{next,react}/**,react-*}',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: '{**,.,..}/*.module.scss',
              group: 'sibling',
              position: 'after',
            },
            {
              pattern: '{@src,@test}/**',
              group: 'parent',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin', 'object'],
        },
      ],
    },
  },
  {
    rules: { ...google.rules },
  },
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': ['error'],
    },
  },
];
