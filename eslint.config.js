// eslint.config.js
const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/temp/**',
      '**/dist/**',
      '**/*.js',
      '**/*.d.ts',
    ],
  },
  
  js.configs.recommended,
  
  // 配置 1: src/ 和 example/ 目录（需要类型检查）
  {
    files: ['src/**/*.ts', 'example/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        project: './tsconfig.json',  // 使用项目配置
      },
      globals: {
        ...globals.node,
        ...globals.es6,
        NodeJS: 'readonly',
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'lines-between-class-members': ['warn', 'always'],
      'no-undef': 'off',
    },
  },
  
  // 配置 2: tools/ 目录（不需要类型检查）
  {
    files: ['tools/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        // ✅ 不使用 project，避免解析错误
      },
      globals: {
        ...globals.node,
        ...globals.es6,
        NodeJS: 'readonly',
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'lines-between-class-members': ['warn', 'always'],
      'no-undef': 'off',
    },
  },
];